#!/usr/bin/env node
/**
 * Bundle-budget measurement for a Vite production build (greenfield `rebuild/dist`).
 *
 * Budgets come from docs/rebuild/QUALITY_BAR.md "Performance budgets":
 *   - initial JS for `/`     <= 180 KiB gzip  (entry <script> + <link rel=modulepreload>)
 *   - any route chunk        <= 120 KiB gzip  (incremental JS a lazy route adds)
 *   - total JS               <= 450 KiB gzip  (reported; the two commands above are the gate)
 *
 * Gzip is computed here over the emitted bytes with zlib level 9 (what a static
 * host would serve; the repo build does not emit .gz variants). Brotli is reported
 * for information only (zlib default quality) and is NOT what the budget is
 * expressed in. KiB = 1024 bytes throughout, matching QUALITY_BAR.
 *
 * Usage:
 *   node tools/perf/bundle.mjs                       # table for rebuild/dist
 *   node tools/perf/bundle.mjs --check               # CI gate: exit 1 on a budget violation
 *   node tools/perf/bundle.mjs --dist rebuild/dist --json
 *   node tools/perf/bundle.mjs --out tools/perf/output/bundle.json
 *
 * Exit codes: 0 within budget (or no --check), 1 budget violation, 2 harness/config error.
 */
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import {
  HarnessError,
  KiB,
  defaultOutDir,
  formatKiB,
  isMainModule,
  log,
  markdownTable,
  repoRoot,
  toPosix,
} from './lib/util.mjs'

export const SCHEMA_VERSION = 1

/** QUALITY_BAR budgets (KiB gzip). */
export const BUDGETS = {
  initialJsKiB: 180,
  routeJsKiB: 120,
  totalJsKiB: 450,
}

/**
 * Route -> Vite chunk filename prefix.
 *
 * Vite names a lazy chunk after the imported module. Since Wave 8 the router
 * imports lazy *route wrappers* (`./routes/{gallery,guestbook,activity}-route`,
 * `./routes/admin-routes`) so the adapter/feature wiring stays out of the entry
 * chunk, hence the `*-route-` prefixes here. Keep this table in sync with
 * `rebuild/src/app/router.tsx`; a route whose prefix matches nothing fails
 * `--check` (so a stale mapping cannot silently skip a budget).
 */
export const ROUTE_CHUNKS = [
  { id: 'home', path: '/', prefixes: ['home-'] },
  { id: 'film', path: '/film', prefixes: ['film-'] },
  { id: 'gallery', path: '/gallery', prefixes: ['gallery-route-'] },
  { id: 'upload', path: '/upload', prefixes: ['UploadPage-'] },
  { id: 'guestbook', path: '/guestbook', prefixes: ['guestbook-route-'] },
  { id: 'guest-photos', path: '/guest-photos', prefixes: ['guest-photos-'] },
  { id: 'activity', path: '/activity', prefixes: ['activity-route-'] },
  { id: 'admin-login', path: '/admin/login', prefixes: ['admin-routes-'] },
  { id: 'admin', path: '/admin', prefixes: ['admin-routes-'] },
  { id: 'guest-share', path: '/guest/:token', prefixes: ['guest-share-'] },
  { id: 'print', path: '/print', prefixes: ['PrintPage-'] },
]

const ENTRY_SCRIPT = /<script[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/i
const ANY_SCRIPT = /<script[^>]*\bsrc="([^"]+)"/i
const MODULE_PRELOAD = /<link[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/gi
const STYLESHEET = /<link[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/gi
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>/gi
/** Relative ES-module chunk reference emitted by the bundler: `from"./chunk-hash.js"`. */
const RELATIVE_CHUNK = /["']\.\/([^"']+\.js)["']/g

const KB = KiB

function normalizeAssetPath(url) {
  return decodeURIComponent(url)
    .replace(/[?#].*$/, '')
    .replace(/^\/+/, '')
}

async function walkFiles(rootDir, directory = rootDir) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, absolute)))
      continue
    }
    if (entry.isFile()) files.push(absolute)
  }
  return files
}

function detectRouteChunks(jsChunks) {
  const claims = new Map()
  for (const route of ROUTE_CHUNKS) {
    const matches = jsChunks.filter(chunk =>
      route.prefixes.some(prefix => path.posix.basename(chunk.file).startsWith(prefix))
    )
    for (const match of matches) claims.set(match.file, route.id)
    route.matches = matches
  }
  return claims
}

function transitiveClosure(startChunks, chunkByFile) {
  const seen = new Set()
  const queue = [...startChunks]
  while (queue.length > 0) {
    const chunk = queue.shift()
    if (seen.has(chunk.file)) continue
    seen.add(chunk.file)
    for (const imported of chunk.imports) {
      const next = chunkByFile.get(imported)
      if (next) queue.push(next)
    }
  }
  return [...seen].sort((left, right) => left.localeCompare(right))
}

function sumBy(files, chunkByFile, key) {
  return files.reduce((total, file) => total + (chunkByFile.get(file)?.[key] ?? 0), 0)
}

export async function measureBundle({ distDir }) {
  const absoluteDist = path.resolve(distDir)
  let distStat
  try {
    distStat = await stat(absoluteDist)
  } catch {
    throw new HarnessError(`dist directory not found: ${absoluteDist} (Lead owns builds)`)
  }
  if (!distStat.isDirectory()) throw new HarnessError(`not a directory: ${absoluteDist}`)

  const absoluteFiles = await walkFiles(absoluteDist)
  const relativeFiles = absoluteFiles.map(file => toPosix(path.relative(absoluteDist, file)))
  const fileSet = new Set(relativeFiles)

  const indexHtmlPath = path.join(absoluteDist, 'index.html')
  if (!fileSet.has('index.html')) throw new HarnessError(`missing index.html in ${absoluteDist}`)
  const indexHtml = await readFile(indexHtmlPath, 'utf8')

  const entryMatch = indexHtml.match(ENTRY_SCRIPT) ?? indexHtml.match(ANY_SCRIPT)
  if (!entryMatch) throw new HarnessError('index.html has no <script src> entry')
  const entry = normalizeAssetPath(entryMatch[1])
  if (!fileSet.has(entry)) throw new HarnessError(`entry asset not found in dist: ${entry}`)

  const preloads = [...new Set([...indexHtml.matchAll(MODULE_PRELOAD)].map(m => m[1]))]
    .map(normalizeAssetPath)
    .filter(url => fileSet.has(url))
  const stylesheets = [...new Set([...indexHtml.matchAll(STYLESHEET)].map(m => m[1]))]
    .map(normalizeAssetPath)
    .filter(url => fileSet.has(url))
  const inlineScripts = [...indexHtml.matchAll(INLINE_SCRIPT)].length

  const initialJs = [entry, ...preloads.filter(url => url !== entry)]
  const initialSet = new Set(initialJs)

  const chunkByFile = new Map()
  const sizes = new Map()
  for (const relative of relativeFiles) {
    const buffer = await readFile(path.join(absoluteDist, relative))
    sizes.set(relative, {
      rawBytes: buffer.byteLength,
      gzipBytes: gzipSync(buffer, { level: 9 }).byteLength,
      brotliBytes: brotliCompressSync(buffer).byteLength,
    })
    if (!relative.endsWith('.js')) continue
    const source = buffer.toString('utf8')
    const imports = new Set()
    // Chunk refs are relative to the emitting chunk's directory (usually
    // assets/), so resolve them against it before testing membership.
    const chunkDirectory = path.posix.dirname(relative)
    for (const match of source.matchAll(RELATIVE_CHUNK)) {
      const imported = path.posix.normalize(
        path.posix.join(chunkDirectory, normalizeAssetPath(match[1]))
      )
      if (fileSet.has(imported) && imported.endsWith('.js')) imports.add(imported)
    }
    chunkByFile.set(relative, { file: relative, imports: [...imports] })
  }

  const jsChunks = relativeFiles.filter(file => file.endsWith('.js'))
  const cssChunks = relativeFiles.filter(file => file.endsWith('.css'))
  const fontChunks = relativeFiles.filter(file => /\.woff2?$/.test(file))

  const initial = {
    files: initialJs.map(file => ({ file, ...sizes.get(file) })),
    rawBytes: initialJs.reduce((total, file) => total + sizes.get(file).rawBytes, 0),
    gzipBytes: initialJs.reduce((total, file) => total + sizes.get(file).gzipBytes, 0),
    brotliBytes: initialJs.reduce((total, file) => total + sizes.get(file).brotliBytes, 0),
    stylesheets: stylesheets.map(file => ({ file, ...sizes.get(file) })),
    inlineScripts,
  }

  detectRouteChunks(jsChunks.map(file => ({ file })))
  const routes = ROUTE_CHUNKS.map(route => {
    const startFiles = route.matches.map(file => file.file)
    const closure = transitiveClosure(
      startFiles.map(file => chunkByFile.get(file)).filter(Boolean),
      chunkByFile
    )
    const incremental = closure.filter(file => !initialSet.has(file))
    return {
      id: route.id,
      path: route.path,
      chunkFiles: startFiles,
      incrementalFiles: incremental.map(file => ({
        file,
        ...sizes.get(file),
      })),
      incrementalGzipBytes: sumBy(incremental, sizes, 'gzipBytes'),
      incrementalRawBytes: sumBy(incremental, sizes, 'rawBytes'),
      missing: startFiles.length === 0,
    }
  })

  const attributed = new Set(routes.flatMap(route => route.incrementalFiles.map(file => file.file)))
  const unattributed = jsChunks
    .filter(file => !initialSet.has(file) && !attributed.has(file))
    .map(file => ({ file, ...sizes.get(file) }))
    .sort((left, right) => right.gzipBytes - left.gzipBytes)

  const totals = {
    allJs: {
      files: jsChunks.length,
      rawBytes: sumBy(jsChunks, sizes, 'rawBytes'),
      gzipBytes: sumBy(jsChunks, sizes, 'gzipBytes'),
      brotliBytes: sumBy(jsChunks, sizes, 'brotliBytes'),
    },
    allCss: {
      files: cssChunks.length,
      rawBytes: sumBy(cssChunks, sizes, 'rawBytes'),
      gzipBytes: sumBy(cssChunks, sizes, 'gzipBytes'),
    },
    fonts: {
      files: fontChunks.length,
      rawBytes: sumBy(fontChunks, sizes, 'rawBytes'),
    },
    distFiles: relativeFiles.length,
  }

  const violations = []
  if (initial.gzipBytes > BUDGETS.initialJsKiB * KB) {
    violations.push({
      budget: 'initial-js',
      limitKiB: BUDGETS.initialJsKiB,
      actualKiB: Number((initial.gzipBytes / KB).toFixed(2)),
      overByKiB: Number((initial.gzipBytes / KB - BUDGETS.initialJsKiB).toFixed(2)),
    })
  }
  for (const route of routes) {
    if (route.missing) {
      violations.push({
        budget: `route-chunk-missing:${route.id}`,
        limitKiB: BUDGETS.routeJsKiB,
        actualKiB: 0,
        overByKiB: 0,
        reason:
          `no emitted chunk matches ${route.prefixes.join('/')} for ${route.path}; ` +
          'update ROUTE_CHUNKS in tools/perf/bundle.mjs to mirror rebuild/src/app/router.tsx',
      })
      continue
    }
    if (route.incrementalGzipBytes > BUDGETS.routeJsKiB * KB) {
      violations.push({
        budget: `route-js:${route.id}`,
        limitKiB: BUDGETS.routeJsKiB,
        actualKiB: Number((route.incrementalGzipBytes / KB).toFixed(2)),
        overByKiB: Number((route.incrementalGzipBytes / KB - BUDGETS.routeJsKiB).toFixed(2)),
      })
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'bundle-budget',
    generatedAt: new Date().toISOString(),
    distDir: toPosix(path.relative(repoRoot, absoluteDist)) || absoluteDist,
    budgets: { ...BUDGETS },
    compression: 'gzipSync(level 9); brotli reported for information only; KiB = 1024 B',
    entry,
    initial,
    routes,
    unattributed,
    totals,
    violations,
  }
}

function buildMarkdown(report) {
  const initialRows = report.initial.files.map(file => [
    path.posix.basename(file.file),
    `${file.rawBytes} B`,
    formatKiB(file.gzipBytes),
    formatKiB(file.brotliBytes),
  ])
  initialRows.push([
    '**initial JS total**',
    `**${report.initial.rawBytes} B**`,
    `**${formatKiB(report.initial.gzipBytes)}**`,
    `**${formatKiB(report.initial.brotliBytes)}**`,
  ])
  initialRows.push([
    `budget: ${report.budgets.initialJsKiB} KiB gzip`,
    '',
    report.initial.gzipBytes <= report.budgets.initialJsKiB * KB ? 'PASS' : 'FAIL',
    '',
  ])

  const routeRows = report.routes.map(route => [
    route.path,
    route.missing
      ? `MISSING — expected a chunk matching ${route.prefixes.join('/')}`
      : route.incrementalFiles.map(file => path.posix.basename(file.file)).join(', '),
    route.missing ? 'n/a' : formatKiB(route.incrementalGzipBytes),
    route.missing
      ? 'FAIL (stale route mapping)'
      : `${route.incrementalGzipBytes <= report.budgets.routeJsKiB * KB ? 'PASS' : 'FAIL'} (<= ${report.budgets.routeJsKiB} KiB)`,
  ])

  const lines = [
    `## Bundle budgets — \`${report.distDir}\``,
    '',
    '### Initial JS (entry + `modulepreload`)',
    '',
    markdownTable(['File', 'Raw', 'gzip', 'brotli'], initialRows, [
      'left',
      'right',
      'right',
      'right',
    ]),
    '',
    '### Route chunks (lazy-route incremental JS, transitive static imports)',
    '',
    markdownTable(['Route', 'Chunk(s)', 'Incremental gzip', 'Budget'], routeRows, [
      'left',
      'left',
      'right',
      'left',
    ]),
    '',
    `- Total JS (all chunks): **${formatKiB(report.totals.allJs.gzipBytes)} gzip** ` +
      `(informational budget ${report.budgets.totalJsKiB} KiB) across ${report.totals.allJs.files} files`,
    `- CSS: ${formatKiB(report.totals.allCss.gzipBytes)} gzip across ${report.totals.allCss.files} files; ` +
      `fonts: ${formatKiB(report.totals.fonts.rawBytes)} raw across ${report.totals.fonts.files} files`,
    report.unattributed.length > 0
      ? `- Unattributed non-initial chunks (no route mapping): ${report.unattributed
          .map(file => `${path.posix.basename(file.file)} (${formatKiB(file.gzipBytes)})`)
          .join(', ')}`
      : '- Unattributed non-initial chunks: none',
  ]

  if (report.violations.length > 0) {
    lines.push('', '### ❌ Budget violations', '')
    for (const violation of report.violations) {
      lines.push(
        violation.reason
          ? `- **${violation.budget}**: ${violation.reason}`
          : `- **${violation.budget}**: ${violation.actualKiB} KiB gzip vs ${violation.limitKiB} KiB budget ` +
              `(+${violation.overByKiB} KiB)`
      )
    }
  } else {
    lines.push('', '### ✅ All bundle budgets met')
  }
  return lines.join('\n')
}

function parseArgs(argv) {
  const options = {
    dist: path.join(repoRoot, 'rebuild', 'dist'),
    check: false,
    json: false,
    out: null,
    help: false,
  }
  const args = [...argv]
  const readValue = flag => {
    const value = args.shift()
    if (value === undefined) throw new HarnessError(`${flag} needs a value`)
    return value
  }
  while (args.length > 0) {
    const argument = args.shift()
    switch (argument) {
      case '--dist':
        options.dist = path.resolve(readValue(argument))
        break
      case '--check':
        options.check = true
        break
      case '--json':
        options.json = true
        break
      case '--out':
        options.out = path.resolve(readValue(argument))
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new HarnessError(`unknown argument "${argument}"`)
    }
  }
  return options
}

async function main(argv) {
  let options
  try {
    options = parseArgs(argv)
    if (options.help) {
      process.stdout.write(
        'Usage: node tools/perf/bundle.mjs [--dist <dir>] [--check] [--json] [--out <file>]\n'
      )
      return 0
    }
    log.step(`Bundle budgets — ${options.dist}`)
    const report = await measureBundle({ distDir: options.dist })

    if (options.out) {
      await mkdir(path.dirname(options.out), { recursive: true })
      await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      process.stdout.write(`${buildMarkdown(report)}\n`)
    }

    log.ok(
      `initial JS ${formatKiB(report.initial.gzipBytes)} (budget ${report.budgets.initialJsKiB} KiB) — ` +
        `${report.initial.gzipBytes <= report.budgets.initialJsKiB * KB ? 'PASS' : 'FAIL'}`
    )
    for (const route of report.routes) {
      log.info(
        `${route.path} -> ${formatKiB(route.incrementalGzipBytes)} incremental JS ` +
          `(${route.incrementalGzipBytes <= report.budgets.routeJsKiB * KB ? 'PASS' : 'FAIL'})`
      )
    }
    if (options.out) log.info(`JSON: ${toPosix(path.relative(repoRoot, options.out))}`)

    if (report.violations.length > 0) {
      log.fail(`${report.violations.length} budget violation(s)`)
      return options.check ? 1 : 0
    }
    log.ok('All bundle budgets met')
    return 0
  } catch (error) {
    if (error instanceof HarnessError) log.fail(error.message)
    else log.fail(`unexpected error: ${error.stack ?? error.message}`)
    return 2
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2))
}

export { defaultOutDir }
