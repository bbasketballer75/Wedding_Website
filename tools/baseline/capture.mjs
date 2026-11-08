#!/usr/bin/env node
/**
 * Baseline capture: production bundle shape, legacy gate timings, coverage and
 * the Lighthouse roll-up, assembled into `contracts/baseline/metrics.json`
 * (committed, validates against `baselineMetricsSchema`).
 *
 * Heavy/raw artifacts stay gitignored under `contracts/baseline/`:
 *   - bundle.json        every dist asset/chunk with raw/gzip/brotli bytes
 *   - coverage.json      parsed coverage-summary + test counts
 *   - lighthouse/        raw LHR JSON per run (-summary.json is the roll-up)
 *
 * Commands the script itself runs (each exactly once, serialized):
 *   npx tsc --noEmit
 *   npm run lint
 *   npm run test:run
 *   npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary
 *
 * It never runs `npm run build` (Lead-owned) or the Playwright suites. The
 * current `dist/` is measured as-is and the build wall time is recorded from
 * the Lead-provided build log, with that provenance stated in the output.
 *
 * Usage:
 *   node tools/baseline/capture.mjs                # bundle + gates + coverage + existing LH summary
 *   node tools/baseline/capture.mjs --skip-timings
 *   node tools/baseline/capture.mjs --skip-coverage
 *   node tools/baseline/capture.mjs --lighthouse   # also run the live Lighthouse capture
 *   node tools/baseline/capture.mjs --out <path>
 */
import { spawn } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { readJsonIfExists, writeJson } from '../lib/fs.mjs'
import { baselineDir, repoPath, repoRoot } from '../lib/paths.mjs'
import { info, ok, step, warn } from '../lib/log.mjs'
import { COVERAGE_COMMAND, runCoverage } from './coverage.mjs'
import { CATEGORIES, DEFAULT_PROFILES, DEFAULT_ROUTES, captureLighthouse } from './lighthouse.mjs'

/**
 * Build facts measured by the Lead on this machine for the frozen commit
 * (metrics-eng is not allowed to run `npm run build`). Re-record if the frozen
 * build is ever re-cut; `source` is part of the metric so a reader can tell
 * measured-from-log vs measured-from-dist.
 */
const BUILD_LOG_FACTS = {
  source: 'Lead-provided build log for the frozen commit (metrics-eng did not run npm run build)',
  totalWallSeconds: 20.2,
  viteBuildSeconds: 12.02,
  viteBuildCommand: 'vite build',
  postbuildSteps: [
    'scripts/prune-local-media.js',
    'scripts/copy-public-images.js',
    'scripts/generate-sitemap.js',
    'scripts/prune-sourcemaps.js',
  ],
  nodeVersion: 'v26.8.1',
  platform: 'win32',
  note:
    '20.2 s total = vite build 12.02 s + postbuild prune/copy/sitemap/sourcemap steps. ' +
    'Measured while unrelated workloads and other agents were active on the same machine.',
}

const GATE_COMMANDS = {
  typecheck: 'npx tsc --noEmit',
  typecheckLegacy: 'npx tsc6 --noEmit',
  lint: 'npm run lint',
  unit: 'npm run test:run',
}

const TIMEOUT_MS = {
  typecheck: 300_000,
  typecheckLegacy: 300_000,
  lint: 300_000,
  unit: 600_000,
}

const toPosix = value => value.split(path.sep).join('/')

function spawnCommand(command, { cwd, timeoutMs }) {
  return new Promise(resolve => {
    const startedAt = Date.now()
    const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('close', exitCode => {
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr, timedOut, wallMs: Date.now() - startedAt })
    })
  })
}

function outputTail(stdout, stderr, lines = 20) {
  return `${stdout}\n${stderr}`.trim().split('\n').slice(-lines)
}

async function walkDist(distDir) {
  const files = []

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      const buffer = await readFile(fullPath)
      const fileStat = await stat(fullPath)
      files.push({
        relPath: toPosix(path.relative(distDir, fullPath)),
        bytes: buffer.byteLength,
        mtimeMs: fileStat.mtimeMs,
        buffer,
      })
    }
  }

  await visit(distDir)
  return files
}

function compress(buffer) {
  return {
    gzipBytes: gzipSync(buffer, { level: 9 }).length,
    brotliBytes: brotliCompressSync(buffer).length,
  }
}

function categoryOfDistFile(relPath) {
  if (relPath.startsWith('images/')) return 'copied-public-images'
  if (relPath.startsWith('icons/')) return 'pwa-icons'
  if (relPath.startsWith('captions/')) return 'captions'
  const extension = path.extname(relPath)
  if (extension === '.js') return 'js'
  if (extension === '.css') return 'css'
  if (extension === '.woff' || extension === '.woff2') return 'fonts'
  if (extension === '.html') return 'html'
  return 'app-static'
}

function aggregateCategories(files) {
  const groups = new Map()
  for (const file of files) {
    const category = categoryOfDistFile(file.relPath)
    const group = groups.get(category) || { category, files: 0, bytes: 0 }
    group.files += 1
    group.bytes += file.bytes
    groups.set(category, group)
  }
  return [...groups.values()].sort((left, right) => right.bytes - left.bytes)
}

function parseIndexHtml(html) {
  const collect = pattern => [...new Set([...html.matchAll(pattern)].map(match => match[1]))]
  const scripts = collect(/<script\b[^>]*\bsrc="([^"]+)"/g)
  const modulePreloads = collect(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)
  const preloads = collect(/<link\b[^>]*\brel="preload"[^>]*\bhref="([^"]+)"/g)
  const stylesheets = collect(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)
  const inlineScriptCount = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)].length
  return { scripts, modulePreloads, preloads, stylesheets, inlineScriptCount }
}

async function parsePrecache(swSource, distDir) {
  const entries = []
  const pattern = /\{url:"([^"]+)",revision:(null|"[^"]*")\}/g
  let match = pattern.exec(swSource)
  while (match !== null) {
    entries.push({ url: match[1], revision: match[2] === 'null' ? null : match[2].slice(1, -1) })
    match = pattern.exec(swSource)
  }

  const uniqueUrls = [...new Set(entries.map(entry => entry.url))]
  let totalBytes = 0
  const missing = []
  const fileSizes = []
  for (const url of uniqueUrls) {
    const relative = decodeURIComponent(url).replace(/^\/+/, '')
    const file = path.join(distDir, relative)
    try {
      const fileStat = await stat(file)
      totalBytes += fileStat.size
      fileSizes.push({ url, bytes: fileStat.size })
    } catch {
      missing.push(url)
    }
  }
  fileSizes.sort((left, right) => right.bytes - left.bytes)

  const groups = { js: 0, css: 0, html: 0, icons: 0, images: 0, other: 0 }
  for (const fileSize of fileSizes) {
    if (fileSize.url.endsWith('.js')) groups.js += fileSize.bytes
    else if (fileSize.url.endsWith('.css')) groups.css += fileSize.bytes
    else if (fileSize.url.endsWith('.html')) groups.html += fileSize.bytes
    else if (fileSize.url.startsWith('icons/')) groups.icons += fileSize.bytes
    else if (/\.(png|jpe?g|webp|svg)$/i.test(fileSize.url)) groups.images += fileSize.bytes
    else groups.other += fileSize.bytes
  }
  const jsCssHtmlBytes = groups.js + groups.css + groups.html

  // The vite build log quotes "63 entries / 1800.52 KiB" for the JS/CSS/HTML
  // payload only. The real Workbox manifest also precaches the includeAssets
  // images (icons, favicons, browserconfig), so report both definitions.
  const leadBytes = Math.round(1800.52 * 1024)

  return {
    entries: entries.length,
    uniqueUrls: uniqueUrls.length,
    totalBytes,
    totalKiB: Number((totalBytes / 1024).toFixed(2)),
    missing,
    largestPrecached: fileSizes.slice(0, 10),
    duplicates: entries.length - uniqueUrls.length,
    groups,
    jsCssHtmlBytes,
    jsCssHtmlKiB: Number((jsCssHtmlBytes / 1024).toFixed(2)),
    leadReported: {
      source: 'Lead-provided build log',
      entries: 63,
      totalKiB: 1800.52,
      definition: 'emitted JS+CSS+HTML payload only (excludes the includeAssets image precache)',
    },
    matchesLeadReport: {
      entries: entries.length === 63,
      jsCssHtmlKiB: Math.abs(jsCssHtmlBytes - leadBytes) <= 16,
    },
  }
}

async function summarizeBundle({ distDir, gitFacts }) {
  const files = await walkDist(distDir)
  const categories = aggregateCategories(files)
  const chunks = []

  for (const file of files) {
    if (categoryOfDistFile(file.relPath) !== 'js' && categoryOfDistFile(file.relPath) !== 'css') {
      continue
    }
    chunks.push({
      file: file.relPath,
      kind: categoryOfDistFile(file.relPath),
      bytes: file.bytes,
      ...compress(file.buffer),
    })
  }
  chunks.sort((left, right) => {
    if (right.gzipBytes !== left.gzipBytes) return right.gzipBytes - left.gzipBytes
    return left.file.localeCompare(right.file)
  })

  const sumOf = (entries, key) => entries.reduce((total, entry) => total + entry[key], 0)
  const jsChunks = chunks.filter(chunk => chunk.kind === 'js')
  const cssChunks = chunks.filter(chunk => chunk.kind === 'css')
  const fontFiles = files.filter(file => categoryOfDistFile(file.relPath) === 'fonts')
  const appFiles = files.filter(file => !file.relPath.startsWith('images/'))

  const indexHtml = files.find(file => file.relPath === 'index.html')
  const swFile = files.find(file => file.relPath === 'sw.js')
  const entry = indexHtml ? parseIndexHtml(indexHtml.buffer.toString('utf8')) : null
  const pwa = swFile
    ? { precache: await parsePrecache(swFile.buffer.toString('utf8'), distDir) }
    : { precache: null }

  const chunkByAssetUrl = new Map(chunks.map(chunk => [`/${chunk.file}`, chunk]))
  const initialPayload = entry
    ? {
        files: [...entry.scripts, ...entry.modulePreloads, ...entry.stylesheets]
          .map(url => chunkByAssetUrl.get(url))
          .filter(Boolean),
      }
    : null

  const bundle = {
    source: {
      distPath: 'dist',
      distBuiltAt: indexHtml ? new Date(indexHtml.mtimeMs).toISOString() : null,
      measuredBy: 'node tools/baseline/capture.mjs',
      commit: gitFacts.legacyCommit,
      freezeTag: gitFacts.freezeTag,
      captureHeadCommit: gitFacts.captureHeadCommit,
      build: BUILD_LOG_FACTS,
      compression:
        'gzipSync(buffer, { level: 9 }) and brotliCompressSync(buffer) (zlib library default quality) ' +
        'computed over the raw emitted files; no build-time compressed variants exist in dist/.',
    },
    dist: {
      files: files.length,
      bytes: sumOf(files, 'bytes'),
      appFiles: appFiles.length,
      appBytes: sumOf(appFiles, 'bytes'),
      categories,
    },
    javascript: {
      files: jsChunks.length,
      bytes: sumOf(jsChunks, 'bytes'),
      gzipBytes: sumOf(jsChunks, 'gzipBytes'),
      brotliBytes: sumOf(jsChunks, 'brotliBytes'),
    },
    css: {
      files: cssChunks.length,
      bytes: sumOf(cssChunks, 'bytes'),
      gzipBytes: sumOf(cssChunks, 'gzipBytes'),
      brotliBytes: sumOf(cssChunks, 'brotliBytes'),
    },
    fonts: { files: fontFiles.length, bytes: sumOf(fontFiles, 'bytes') },
    entry: entry
      ? {
          html: 'dist/index.html',
          ...entry,
          entryScript: entry.scripts[0] || null,
          entryStylesheet: entry.stylesheets[0] || null,
        }
      : null,
    initialPayload: initialPayload
      ? {
          definition:
            'entry <script> + <link rel="modulepreload"> + entry stylesheet from dist/index.html ' +
            '(the JS/CSS a first route needs before it can render); HTML transfer is reported separately',
          htmlBytes: indexHtml ? indexHtml.bytes : null,
          files: initialPayload.files.length,
          assets: initialPayload.files,
          bytes: sumOf(initialPayload.files, 'bytes'),
          gzipBytes: sumOf(initialPayload.files, 'gzipBytes'),
          brotliBytes: sumOf(initialPayload.files, 'brotliBytes'),
        }
      : null,
    chunks: {
      total: chunks.length,
      top20ByGzip: chunks.slice(0, 20),
      all: chunks,
      allFilesSortedByGzip: chunks.map(chunk => chunk.file),
    },
    pwa: {
      ...pwa,
      leadReported: { entries: 63, totalKiB: 1800.52 },
      note: 'Precache manifest parsed from dist/sw.js; byte totals resolve each precached URL in dist/.',
    },
  }

  return { bundle, chunks }
}

function parseGateOutput(gate, result) {
  const text = `${result.stdout}\n${result.stderr}`
  if (gate === 'typecheck' || gate === 'typecheckLegacy') {
    const errorCount = (text.match(/\berror TS\d+/g) || []).length
    const summaryMatch = text.match(/Found (\d+) errors?/)
    return {
      errors: summaryMatch ? Number(summaryMatch[1]) : errorCount,
      clean: result.exitCode === 0,
    }
  }
  if (gate === 'lint') {
    const problemsMatch = text.match(/(\d+) problems? \(/g) || []
    const total = problemsMatch.reduce((sum, match) => sum + Number(match.match(/\d+/)[0]), 0)
    return { problems: total, clean: result.exitCode === 0 }
  }
  const numberAfter = label => {
    const match = text.match(new RegExp(`${label}\\s+([\\d,]+)`))
    return match ? Number(match[1].replace(/,/g, '')) : null
  }
  const durationMatch = text.match(/Duration\s+([\d.]+m?s[^\n]*)/)
  return {
    testFiles: numberAfter('Test Files'),
    tests: numberAfter('Tests'),
    failedTests: numberAfter('failed'),
    durationText: durationMatch ? durationMatch[1].trim() : null,
    clean: result.exitCode === 0,
  }
}

async function measureGate(gate) {
  const command = GATE_COMMANDS[gate]
  process.stdout.write(`[baseline] ${gate}: ${command} ... `)
  const result = await spawnCommand(command, { cwd: repoRoot, timeoutMs: TIMEOUT_MS[gate] })
  const parsed = parseGateOutput(gate, result)
  process.stdout.write(
    `${result.exitCode === 0 ? 'ok' : 'FAILED'} (${(result.wallMs / 1000).toFixed(1)} s)\n`
  )
  return {
    id: gate,
    command,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    wallMs: result.wallMs,
    ...parsed,
    outputTail: outputTail(result.stdout, result.stderr, 12),
  }
}

async function readGitFacts() {
  const freezeTag = 'legacy-freeze-2026-11-08'
  const tagResult = await spawnCommand(`git rev-list -n 1 ${freezeTag}`, {
    cwd: repoRoot,
    timeoutMs: 30_000,
  })
  const headResult = await spawnCommand('git rev-parse HEAD', { cwd: repoRoot, timeoutMs: 30_000 })
  const legacyCommit = tagResult.exitCode === 0 ? tagResult.stdout.trim() : ''
  const captureHeadCommit = headResult.exitCode === 0 ? headResult.stdout.trim() : ''
  return {
    freezeTag,
    legacyCommit: legacyCommit || captureHeadCommit,
    captureHeadCommit,
  }
}

function summarizeLighthouse(summary) {
  if (!summary) return null
  const failures = summary.runs
    .filter(run => !run.ok)
    .map(run => ({ id: run.id, error: run.error || 'unknown' }))
  return {
    capturedAt: summary.capturedAt,
    siteUrl: summary.siteUrl,
    lighthouseVersion: summary.lighthouseVersion,
    method: summary.method,
    environment: summary.environment,
    pages: summary.pages.map(page => ({
      page: page.page,
      profile: page.profile,
      url: page.url,
      runs: page.runs,
      successfulRuns: page.successfulRuns,
      selectedRun: page.selectedRun,
      scores: page.scores,
      metrics: page.metrics,
    })),
    runs: summary.runs.map(run => ({
      id: run.id,
      page: run.page,
      profile: run.profile,
      ok: run.ok,
      scorePerformance: run.scores ? run.scores.performance : null,
      scoreAccessibility: run.scores ? run.scores.accessibility : null,
      scoreBestPractices: run.scores ? run.scores['best-practices'] : null,
      scoreSeo: run.scores ? run.scores.seo : null,
      lcpMs: run.metrics ? run.metrics.largestContentfulPaintMs : null,
      tbtMs: run.metrics ? run.metrics.totalBlockingTimeMs : null,
      cls: run.metrics ? run.metrics.cumulativeLayoutShift : null,
      totalByteWeight: run.metrics ? run.metrics.totalByteWeight : null,
      requestCount: run.metrics ? run.metrics.requestCount : null,
      error: run.error || null,
    })),
    failures,
  }
}

function summarizeInventory(inventory) {
  if (!inventory) return null
  const cut = name => {
    const found = inventory.files.cuts.find(entry => entry.name === name)
    return found
      ? { files: found.files, lines: found.lines, nonBlankLines: found.nonBlankLines }
      : null
  }
  return {
    generatedBy: 'node tools/inventory/capture.mjs',
    src: {
      rawWalk: cut('rawWalk'),
      typescript: cut('typescript'),
      productionTypeScript: cut('productionTypeScript'),
      tests: cut('tests'),
      stylesheets: cut('stylesheets'),
    },
    routes: inventory.routes.count,
    lazyComponents: inventory.routes.lazyComponents.length,
    importGraph: {
      modules: inventory.importGraph.nodes,
      internalEdges: inventory.importGraph.edges,
      unresolvedCount: inventory.importGraph.unresolvedCount,
      externalReferenceCount: inventory.importGraph.externalReferenceCount,
    },
    deadCode: inventory.deadCode.totals,
    barrels: {
      total: inventory.barrels.length,
      used: inventory.barrels.filter(barrel => barrel.productionInbound > 0).length,
      unused: inventory.barrels.filter(barrel => barrel.productionInbound === 0).length,
    },
    duplicates: {
      sameBasenameGroups: inventory.duplicates.sameBasename.length,
      duplicateExportSymbols: inventory.duplicates.duplicateExportSymbols.length,
      families: inventory.duplicates.families.map(family => ({
        id: family.id,
        files: family.totals.files,
        lines: family.totals.lines,
        crossImports: family.crossImports.length,
      })),
    },
    dependencies: {
      declared: inventory.dependencies.declaredCounts,
      classification: inventory.dependencies.classificationCounts,
      unused: inventory.dependencies.unused.map(entry => entry.name),
      undeclaredDirectUsage: inventory.dependencies.undeclaredDirectUsage.map(entry => entry.name),
    },
  }
}

const E2E_DOCUMENTED = {
  status: 'documented-not-measured',
  command: 'npm run test:e2e (full) / npm run test:e2e:public (gated subset)',
  reason:
    'WP-6 explicitly forbids running the e2e suite (serialized heavy command, Lead-owned). ' +
    'The duration below is quoted from the committed suite description, not measured.',
  evidence: [
    '.github/workflows/ci.yml:61-63 — "full e2e suite takes 10+ min and is flaky on cross-browser matrix at PR-time"',
    'playwright.config.ts:19-26 — fullyParallel:false, workers: process.env.CI ? 1 : 3, retries: 0, timeout 60 s',
    'playwright.config.ts:48-53 — webServer runs `npm run build && npm run preview` with 180 s startup timeout',
    'package.json:63-64 — test:e2e:public gates 10 spec files; test:e2e:admin gates 5; tests/e2e contains 18 specs',
  ],
  documentedFullSuite: '10+ minutes (single CI worker, 18 spec files)',
  documentedGatedSubset: 'not stated; same suite minus admin/visual specs (10 spec files)',
}

function parseArgs(argv) {
  const options = {
    out: path.join(baselineDir, 'metrics.json'),
    bundleOut: path.join(baselineDir, 'bundle.json'),
    coverageOut: path.join(baselineDir, 'coverage.json'),
    lighthouseSummary: path.join(baselineDir, 'lighthouse-summary.json'),
    inventoryPath: path.join(baselineDir, 'inventory.json'),
    skipTimings: false,
    skipCoverage: false,
    runLighthouse: false,
    skipLighthouse: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--skip-timings') options.skipTimings = true
    else if (argument === '--skip-coverage') options.skipCoverage = true
    else if (argument === '--lighthouse') options.runLighthouse = true
    else if (argument === '--skip-lighthouse') options.skipLighthouse = true
    else if (argument === '--out') {
      options.out = path.resolve(argv[index + 1])
      index += 1
    } else if (argument === '--dist') {
      options.dist = path.resolve(argv[index + 1])
      index += 1
    }
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const gitFacts = await readGitFacts()
  const distDir = options.dist || repoPath('dist')
  info(`frozen legacy commit ${gitFacts.legacyCommit} (${gitFacts.freezeTag})`)
  info(`workbench HEAD at capture ${gitFacts.captureHeadCommit}`)
  info(`dist ${toPosix(path.relative(repoRoot, distDir)) || distDir}`)

  if (options.runLighthouse) {
    step('Lighthouse (live capture)')
    await captureLighthouse({
      siteUrl: 'https://www.theporadas.com',
      routes: DEFAULT_ROUTES,
      profiles: DEFAULT_PROFILES,
      runs: 2,
      outDir: path.join(baselineDir, 'lighthouse'),
      summaryPath: options.lighthouseSummary,
    })
    ok('lighthouse summary written')
  }

  step('Production bundle (dist/)')
  const { bundle } = await summarizeBundle({ distDir, gitFacts })
  await writeJson(options.bundleOut, bundle)
  ok(
    `dist ${bundle.dist.files} files / ${bundle.dist.bytes} bytes; ` +
      `JS ${bundle.javascript.files} files ${(bundle.javascript.gzipBytes / 1024).toFixed(2)} KiB gz; ` +
      `CSS ${(bundle.css.gzipBytes / 1024).toFixed(2)} KiB gz`
  )
  ok(
    `entry ${bundle.entry ? bundle.entry.entryScript : 'n/a'}; ` +
      `${
        bundle.pwa.precache
          ? `${bundle.pwa.precache.entries} precache entries / ` +
            `${(bundle.pwa.precache.totalBytes / 1024).toFixed(2)} KiB`
          : 'no sw.js'
      }`
  )

  let coverage = null
  if (!options.skipCoverage) {
    step('Coverage')
    const { record } = await runCoverage({ outPath: options.coverageOut })
    coverage = record
    if (record.totals) {
      ok(
        `lines ${record.totals.lines.pct}% (${record.totals.lines.covered}/${record.totals.lines.total}), ` +
          `statements ${record.totals.statements.pct}%, branches ${record.totals.branches.pct}%, ` +
          `functions ${record.totals.functions.pct}% in ${(record.wallMs / 1000).toFixed(1)} s`
      )
    } else {
      warn('coverage summary not produced')
    }
  }

  const gates = {}
  if (!options.skipTimings) {
    step('Legacy gates (timed once)')
    for (const gate of ['typecheck', 'typecheckLegacy', 'lint', 'unit']) {
      gates[gate] = await measureGate(gate)
    }
  }

  step('Artefacts')
  const lighthouseSummary = options.skipLighthouse
    ? null
    : await readJsonIfExists(options.lighthouseSummary)
  const inventory = await readJsonIfExists(options.inventoryPath)
  if (!lighthouseSummary) warn('no lighthouse-summary.json — lighthouse section omitted')
  if (!inventory) warn('no inventory.json — inventory section omitted')

  const metrics = {
    capturedAt: new Date().toISOString(),
    commit: gitFacts.legacyCommit,
    freezeTag: gitFacts.freezeTag,
    captureCommit: gitFacts.captureHeadCommit,
    gates,
    bundle,
    lighthouse: summarizeLighthouse(lighthouseSummary),
    coverage,
    timings: {
      build: {
        ...BUILD_LOG_FACTS,
        totalWallMs: Math.round(BUILD_LOG_FACTS.totalWallSeconds * 1000),
        viteBuildMs: Math.round(BUILD_LOG_FACTS.viteBuildSeconds * 1000),
      },
      typecheck: gates.typecheck ? { wallMs: gates.typecheck.wallMs } : null,
      typecheckLegacy: gates.typecheckLegacy ? { wallMs: gates.typecheckLegacy.wallMs } : null,
      lint: gates.lint ? { wallMs: gates.lint.wallMs } : null,
      unit: gates.unit ? { wallMs: gates.unit.wallMs } : null,
      coverage: coverage ? { wallMs: coverage.wallMs, command: COVERAGE_COMMAND } : null,
      e2e: E2E_DOCUMENTED,
    },
    inventory: summarizeInventory(inventory),
    provenance: {
      generatedBy: 'node tools/baseline/capture.mjs',
      buildMeasuredBy: 'Lead (npm run build is Lead-owned); wall time copied from the build log',
      lighthouse:
        'live public site (https://www.theporadas.com), read-only GETs, 2 runs per page/profile, ' +
        'better-of-two selected; machine contended by other agents/workloads',
      coverage: COVERAGE_COMMAND,
      gates: Object.values(GATE_COMMANDS),
      note:
        'Timings are wall time on a contended developer machine; they are relative baselines, ' +
        'not clean-machine absolutes. Every number is reproducible from the command recorded next to it.',
    },
  }

  await writeJson(options.out, metrics)

  step('Wrote baseline')
  ok(toPosix(path.relative(repoRoot, options.out)))
  info(toPosix(path.relative(repoRoot, options.bundleOut)))
  if (!options.skipCoverage) info(toPosix(path.relative(repoRoot, options.coverageOut)))
  if (lighthouseSummary) {
    info(
      `${lighthouseSummary.pages.length} lighthouse pages, ` +
        `${lighthouseSummary.runs.filter(run => run.ok).length}/${lighthouseSummary.runs.length} runs ok`
    )
  }
  info(`inventory: ${inventory ? 'embedded' : 'missing'}`)
  info(`categories: ${CATEGORIES.join(', ')}`)
}

main().catch(error => {
  console.error(`\n> baseline capture FAILED: ${error.stack || error.message}`)
  process.exit(1)
})
