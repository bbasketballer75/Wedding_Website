/**
 * Route + module-graph inventory for the frozen legacy app.
 *
 * This module answers three rebuild questions with evidence instead of opinion:
 *   1. What routes exist, and which page module does each one lazy-load?
 *   2. Which modules are actually reachable, and which have zero inbound
 *      references (dead-code candidates to delete instead of port)?
 *   3. Which barrels, duplicate file families and parallel directories
 *      concentrate coupling, so the target module boundaries can be drawn
 *      deliberately rather than inherited?
 *
 * The legacy app is frozen, so a static regex parse is sufficient and keeps the
 * workbench dependency-free. Both the `@/` alias (vite + tsconfig) and relative
 * specifiers resolve; directory imports resolve to `index.*`; worker imports via
 * `new Worker(new URL(..., import.meta.url))` count as real references so that
 * worker entry points are not misreported as dead code.
 */
import { readdir } from 'node:fs/promises'
import path from 'node:path'

export const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
export const STYLESHEET_EXTENSIONS = new Set(['.css'])
export const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
  '.md',
  '.svg',
  '.html',
])

/** Entry modules that nothing imports, but that start the app/test run. */
export const ENTRY_POINTS = new Set(['src/main.tsx', 'src/setupTests.tsx'])

/** The legacy router lives here; its `<Route>` table is the route inventory. */
export const APP_FILE = 'src/App.tsx'

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css']

const toPosix = value => value.split(path.sep).join('/')

/**
 * Recursively list files under `root` (deterministic order) with paths made
 * repo-relative using posix separators, e.g. `src/pages/Home.tsx`.
 */
export async function walkSourceFiles(root, { prefix = 'src' } = {}) {
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
      const relative = toPosix(path.relative(root, fullPath))
      files.push({ absPath: fullPath, relPath: `${prefix}/${relative}` })
    }
  }

  await visit(root)
  files.sort((left, right) => left.relPath.localeCompare(right.relPath))
  return files
}

function isCommented(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  const before = text.slice(lineStart, index).trimStart()
  return before.startsWith('//') || before.startsWith('/*') || before.startsWith('*')
}

function dedupe(references) {
  const seen = new Set()
  return references.filter(reference => {
    const key = `${reference.kind}\u0000${reference.specifier}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function isTestFile(relPath) {
  return /\.(test|spec)\.[^.]+$/.test(relPath) || relPath.includes('/__tests__/')
}

function isDeclarationFile(relPath) {
  return relPath.endsWith('.d.ts')
}

function isStraySource(relPath) {
  return /\.(bak|old|orig|rej|save|swp)$/i.test(relPath) || /\.eslintrc\.[^/]+$/.test(relPath)
}

/**
 * Every module-ish reference in one source file: static imports, re-exports,
 * dynamic imports, worker URLs, `new URL(..., import.meta.url)` assets,
 * `import.meta.glob` patterns and CSS `@import`s.
 */
export function parseReferences(relPath, text) {
  const references = []
  const workerSpecifiers = new Set()
  const patterns = [
    {
      kind: 'static',
      pattern: /\bimport\s+(?:type\s+)?(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]/g,
    },
    {
      kind: 're-export',
      pattern: /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    },
    { kind: 'dynamic', pattern: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
    { kind: 'require', pattern: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
    {
      kind: 'worker',
      pattern:
        /new\s+Worker\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
    },
    {
      kind: 'url',
      pattern: /new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
    },
    {
      kind: 'glob',
      pattern: /import\.meta\.glob(?:<[^>]+>)?\s*\(\s*['"]([^'"]+)['"]/g,
    },
  ]

  for (const { kind, pattern } of patterns) {
    pattern.lastIndex = 0
    let match = pattern.exec(text)
    while (match !== null) {
      const specifier = match[1]
      if (!isCommented(text, match.index)) {
        if (kind === 'worker') workerSpecifiers.add(specifier)
        // A worker reference also matches the generic new-URL pattern; keep the
        // more specific edge only.
        if (!(kind === 'url' && workerSpecifiers.has(specifier))) {
          references.push({ kind, specifier })
        }
      }
      match = pattern.exec(text)
    }
  }

  if (STYLESHEET_EXTENSIONS.has(path.extname(relPath))) {
    const cssPattern = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g
    let match = cssPattern.exec(text)
    while (match !== null) {
      references.push({ kind: 'css-import', specifier: match[1] })
      match = cssPattern.exec(text)
    }
  }

  return dedupe(references)
}

export function splitSpecifier(specifier) {
  const index = specifier.search(/[?#]/)
  if (index === -1) return { target: specifier, query: '' }
  return { target: specifier.slice(0, index), query: specifier.slice(index) }
}

export function packageNameOf(specifier) {
  const { target } = splitSpecifier(specifier)
  const segments = target.split('/')
  if (target.startsWith('@')) return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : target
  return segments[0]
}

function buildFileIndex(files) {
  const index = new Map()
  for (const file of files) {
    index.set(file.relPath.toLowerCase(), file.relPath)
  }
  return index
}

function resolveFile(candidate, fileIndex) {
  const attempts = [candidate]
  for (const extension of RESOLVE_EXTENSIONS) {
    attempts.push(`${candidate}${extension}`)
    attempts.push(`${candidate}/index${extension}`)
  }
  // TypeScript/bundler convention: `import './foo.js'` resolves to `./foo.ts`.
  const explicitJs = candidate.match(/\.(js|jsx|mjs|cjs)$/)
  if (explicitJs) {
    const base = candidate.slice(0, -explicitJs[0].length)
    for (const extension of ['.ts', '.tsx']) {
      attempts.push(`${base}${extension}`)
      attempts.push(`${base}/index${extension}`)
    }
  }
  for (const attempt of attempts) {
    const found = fileIndex.get(attempt.toLowerCase())
    if (found) return found
  }
  return null
}

/**
 * Resolve one specifier seen in `fromRel` against the src file set.
 * Returns one of: internal | package | virtual | unresolved-internal |
 * public-asset | url-module.
 */
export function resolveSpecifier({ specifier, fromRel, fileIndex }) {
  const { target, query } = splitSpecifier(specifier)

  if (target.startsWith('virtual:')) return { kind: 'virtual', target, query, specifier }
  if (/^https?:\/\//.test(target)) return { kind: 'url-module', target, specifier }

  let candidate = null
  if (target.startsWith('@/')) candidate = `src/${target.slice(2)}`
  else if (target.startsWith('.')) {
    candidate = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), target))
  } else if (target.startsWith('/')) return { kind: 'public-asset', target, specifier }
  else {
    return { kind: 'package', packageName: packageNameOf(target), target, specifier }
  }

  const resolved = resolveFile(candidate, fileIndex)
  if (resolved) return { kind: 'internal', resolved, query, specifier }
  // A relative import that escapes src/ (e.g. a test importing ../../scripts/*)
  // is not dead code: it targets a repo file outside the inventoried tree.
  if (!candidate.startsWith('src/')) return { kind: 'outside-src', candidate, specifier }
  return { kind: 'unresolved-internal', candidate, specifier }
}

/**
 * Build the static module graph. `files` entries must carry `relPath` and, for
 * parseable sources, `content` (non-text files may pass `content: null`).
 */
export function buildImportGraph(files) {
  const fileIndex = buildFileIndex(files)
  const edges = []
  const edgeKeys = new Set()
  const inbound = new Map()
  const outbound = new Map()
  const unresolved = []
  const externalReferences = []
  const packages = new Map()
  const virtuals = new Map()
  const kindCounts = {
    static: 0,
    're-export': 0,
    dynamic: 0,
    require: 0,
    worker: 0,
    url: 0,
    glob: 0,
  }
  let publicAssetReferences = 0

  const edge = (from, to, kind) => {
    const key = `${from}\u0000${to}\u0000${kind}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ from, to, kind })
    if (!inbound.has(to)) inbound.set(to, new Set())
    inbound.get(to).add(from)
    if (!outbound.has(from)) outbound.set(from, new Set())
    outbound.get(from).add(to)
    if (kind in kindCounts) kindCounts[kind] += 1
  }

  for (const file of files) {
    if (typeof file.content !== 'string') continue
    for (const reference of parseReferences(file.relPath, file.content)) {
      const resolution = resolveSpecifier({
        specifier: reference.specifier,
        fromRel: file.relPath,
        fileIndex,
      })

      if (resolution.kind === 'internal') {
        edge(file.relPath, resolution.resolved, reference.kind)
      } else if (resolution.kind === 'package') {
        const record = packages.get(resolution.packageName) || {
          importers: new Set(),
          occurrences: 0,
        }
        record.importers.add(file.relPath)
        record.occurrences += 1
        packages.set(resolution.packageName, record)
      } else if (resolution.kind === 'virtual') {
        const record = virtuals.get(resolution.target) || { importers: new Set(), occurrences: 0 }
        record.importers.add(file.relPath)
        record.occurrences += 1
        virtuals.set(resolution.target, record)
      } else if (resolution.kind === 'unresolved-internal') {
        unresolved.push({
          from: file.relPath,
          specifier: reference.specifier,
          candidate: resolution.candidate,
        })
      } else if (resolution.kind === 'outside-src') {
        externalReferences.push({
          from: file.relPath,
          specifier: reference.specifier,
          candidate: resolution.candidate,
        })
      } else if (resolution.kind === 'public-asset') {
        publicAssetReferences += 1
      }
    }
  }

  return {
    edges,
    inbound,
    outbound,
    unresolved: unresolved.sort((left, right) =>
      `${left.from}${left.specifier}`.localeCompare(`${right.from}${right.specifier}`)
    ),
    externalReferences: externalReferences.sort((left, right) =>
      `${left.from}${left.specifier}`.localeCompare(`${right.from}${right.specifier}`)
    ),
    packages,
    virtuals,
    kindCounts,
    publicAssetReferences,
    fileIndex,
  }
}

function serializeSet(value) {
  return value ? [...value].sort((left, right) => left.localeCompare(right)) : []
}

export function inboundImporters(graph, relPath) {
  return serializeSet(graph.inbound.get(relPath))
}

export function productionImporters(graph, relPath) {
  return inboundImporters(graph, relPath).filter(importer => !isTestFile(importer))
}

/**
 * Dead-code evidence, split by confidence:
 *   - likelyDead: zero inbound references of any kind (not an entry/test file)
 *   - testOnly: only test files import it, so it ships no production value
 *   - strayFiles: backup/editor leftovers that should never be ported
 */
export function findDeadCodeCandidates({ files, graph }) {
  const byPath = new Map(files.map(file => [file.relPath, file]))
  const likelyDead = []
  const testOnly = []

  for (const file of files) {
    if (!CODE_EXTENSIONS.has(file.ext)) continue
    if (isTestFile(file.relPath) || isDeclarationFile(file.relPath)) continue
    if (ENTRY_POINTS.has(file.relPath)) continue
    if (isStraySource(file.relPath)) continue

    const allImporters = inboundImporters(graph, file.relPath)
    const production = allImporters.filter(importer => !isTestFile(importer))
    const testImporters = allImporters.filter(importer => isTestFile(importer))

    if (allImporters.length === 0) {
      likelyDead.push({
        path: file.relPath,
        lines: file.lines,
        bytes: file.bytes,
        reason: 'no static, dynamic, re-export or worker reference resolves to this file',
      })
    } else if (production.length === 0) {
      testOnly.push({
        path: file.relPath,
        lines: file.lines,
        bytes: file.bytes,
        testImporters,
        reason: 'imported only by test/spec files',
      })
    }
  }

  const sortByPath = (left, right) => left.path.localeCompare(right.path)
  const strayFiles = files
    .filter(file => isStraySource(file.relPath))
    .map(file => ({
      path: file.relPath,
      bytes: file.bytes,
      lines: file.lines,
      note: 'backup/editor leftover, not importable production code',
    }))
    .sort(sortByPath)

  return {
    likelyDead: likelyDead.sort(sortByPath),
    testOnly: testOnly.sort(sortByPath),
    strayFiles,
    totalCandidates:
      likelyDead.reduce((sum, entry) => sum + entry.lines, 0) +
      testOnly.reduce((sum, entry) => sum + entry.lines, 0) +
      strayFiles.reduce((sum, entry) => sum + entry.lines, 0),
    byPath,
  }
}

/** Barrel files (`index.*`) and how much the rest of the app funnels through them. */
export function analyzeBarrels({ files, graph }) {
  const barrels = []

  for (const file of files) {
    if (!/^index\.(ts|tsx|js|jsx)$/.test(path.posix.basename(file.relPath))) continue
    const content = typeof file.content === 'string' ? file.content : ''
    const exportMentions = (content.match(/\bexport\b/g) || []).length
    barrels.push({
      path: file.relPath,
      lines: file.lines,
      exports: exportMentions,
      reExports: (content.match(/\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\b/g) || []).length,
      outbound: serializeSet(graph.outbound.get(file.relPath)).length,
      inbound: inboundImporters(graph, file.relPath).length,
      productionInbound: productionImporters(graph, file.relPath).length,
      importers: productionImporters(graph, file.relPath).slice(0, 8),
      kind: file.relPath.includes('/workers/') ? 'worker-entry' : 'barrel',
    })
  }

  return barrels.sort((left, right) => {
    if (right.inbound !== left.inbound) return right.inbound - left.inbound
    return left.path.localeCompare(right.path)
  })
}

/** The `<Route>` table straight out of App.tsx. */
export function discoverRouteTable(appSource) {
  const lazyModules = new Map()
  const lazyPattern =
    /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g
  let match = lazyPattern.exec(appSource)
  while (match !== null) {
    lazyModules.set(match[1], match[2])
    match = lazyPattern.exec(appSource)
  }

  const routes = []
  const blocks = appSource.split(/<Route\b/).slice(1)
  for (const block of blocks) {
    const pathMatch = block.match(/\bpath=['"]([^'"]+)['"]/)
    if (!pathMatch) continue
    const componentMatch = block.match(/<([A-Z][\w]*)\s*\/>/)
    const titleMatch = block.match(/\btitle=['"]([^'"]+)['"]/)
    const component = componentMatch ? componentMatch[1] : null
    routes.push({
      path: pathMatch[1],
      component,
      title: titleMatch ? titleMatch[1] : null,
      lazyModule: component && lazyModules.has(component) ? lazyModules.get(component) : null,
      lazy: Boolean(component && lazyModules.has(component)),
    })
  }

  return { routes, lazyComponents: [...lazyModules.keys()].sort() }
}

function familyEntries(roots, byPath) {
  const entries = []
  const seen = new Set()

  for (const root of roots) {
    if (byPath.has(root)) {
      entries.push(byPath.get(root))
      seen.add(root)
      continue
    }
    const prefix = `${root}/`
    const matches = [...byPath.values()]
      .filter(file => file.relPath.startsWith(prefix))
      .sort((left, right) => left.relPath.localeCompare(right.relPath))
    for (const file of matches) {
      if (seen.has(file.relPath)) continue
      seen.add(file.relPath)
      entries.push(file)
    }
  }

  return entries
}

function exportedSymbols(text) {
  const symbols = new Set()
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s+(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s*(?:\*|\{([^}]*)\})\s*from/g,
    /\bexport\s*\{([^}]*)\}/g,
  ]
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match = pattern.exec(text)
    while (match !== null) {
      if (match[1] !== undefined) {
        for (const part of match[1].split(',')) {
          const name =
            part
              .trim()
              .split(/\s+as\s+/)
              .pop() || ''
          if (/^[A-Za-z_$][\w$]*$/.test(name)) symbols.add(name)
        }
      }
      match = pattern.exec(text)
    }
  }
  return [...symbols].sort((left, right) => left.localeCompare(right))
}

const DUPLICATE_FAMILIES = [
  {
    id: 'gallery-header-duplicate',
    label: 'two GalleryHeader components with the same name',
    roots: [
      'src/components/gallery/GalleryHeader.tsx',
      'src/components/gallery/components/GalleryHeader.tsx',
    ],
  },
  {
    id: 'flat-utils-vs-utils-dir',
    label: 'src/lib/utils.ts vs the src/utils/ module directory',
    roots: ['src/lib/utils.ts', 'src/utils'],
  },
  {
    id: 'design-system-vs-tokens-vs-themes',
    label: 'three overlapping styling sources: src/design-system/, src/tokens/, src/themes/',
    roots: ['src/design-system', 'src/tokens', 'src/themes'],
  },
  {
    id: 'composables-vs-hooks',
    label: 'src/composables/ (Vue-style) vs src/hooks/',
    roots: ['src/composables', 'src/hooks'],
  },
  {
    id: 'context-vs-providers',
    label: 'src/context/ vs src/providers/',
    roots: ['src/context', 'src/providers'],
  },
]

const SYMBOL_STOPWORDS = new Set([
  'default',
  'index',
  'props',
  'React',
  'Component',
  'Fragment',
  'Children',
  'useEffect',
  'useState',
])

/**
 * Duplicate/overlapping module evidence: generic same-basename collisions,
 * named legacy families, and exported symbols declared in more than one module.
 */
export function findDuplicateFamilies({ files, graph }) {
  const byPath = new Map(files.map(file => [file.relPath, file]))
  const families = []

  for (const family of DUPLICATE_FAMILIES) {
    const entries = familyEntries(family.roots, byPath)
    const exportOwners = new Map()

    for (const entry of entries) {
      const content = typeof entry.content === 'string' ? entry.content : ''
      for (const symbol of exportedSymbols(content)) {
        if (SYMBOL_STOPWORDS.has(symbol)) continue
        if (!exportOwners.has(symbol)) exportOwners.set(symbol, [])
        exportOwners.get(symbol).push(entry.relPath)
      }
    }

    const entryPaths = new Set(entries.map(entry => entry.relPath))
    const crosses = graph.edges
      .filter(edge => entryPaths.has(edge.from) && entryPaths.has(edge.to) && edge.from !== edge.to)
      .map(edge => ({ from: edge.from, to: edge.to, kind: edge.kind }))

    families.push({
      id: family.id,
      label: family.label,
      entries: entries.map(entry => ({
        path: entry.relPath,
        bytes: entry.bytes,
        lines: entry.lines,
        importers: productionImporters(graph, entry.relPath).slice(0, 6),
        inbound: inboundImporters(graph, entry.relPath).length,
      })),
      totals: {
        files: entries.length,
        bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
        lines: entries.reduce((sum, entry) => sum + entry.lines, 0),
      },
      sharedExportedSymbols: [...exportOwners.entries()]
        .filter(([, paths]) => paths.length >= 2)
        .map(([symbol, paths]) => ({ symbol, paths: paths.sort() }))
        .sort((left, right) => left.symbol.localeCompare(right.symbol)),
      crossImports: crosses.sort((left, right) =>
        `${left.from}${left.to}`.localeCompare(`${right.from}${right.to}`)
      ),
    })
  }

  const basenameGroups = new Map()
  for (const file of files) {
    if (!CODE_EXTENSIONS.has(file.ext) || isTestFile(file.relPath)) continue
    const basename = path.posix.basename(file.relPath)
    if (basename.startsWith('index.')) continue
    if (!basenameGroups.has(basename)) basenameGroups.set(basename, [])
    basenameGroups.get(basename).push(file)
  }

  const sameBasename = [...basenameGroups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([basename, group]) => ({
      basename,
      files: group
        .map(file => ({
          path: file.relPath,
          bytes: file.bytes,
          lines: file.lines,
          inbound: inboundImporters(graph, file.relPath).length,
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    }))
    .sort((left, right) => {
      if (right.files.length !== left.files.length) return right.files.length - left.files.length
      return left.basename.localeCompare(right.basename)
    })

  const symbolOwners = new Map()
  for (const file of files) {
    if (!CODE_EXTENSIONS.has(file.ext) || isTestFile(file.relPath)) continue
    if (typeof file.content !== 'string') continue
    for (const symbol of exportedSymbols(file.content)) {
      if (SYMBOL_STOPWORDS.has(symbol) || symbol.length < 4) continue
      if (!symbolOwners.has(symbol)) symbolOwners.set(symbol, [])
      symbolOwners.get(symbol).push(file.relPath)
    }
  }

  const duplicateExportSymbols = [...symbolOwners.entries()]
    .filter(([, paths]) => new Set(paths).size >= 2)
    .map(([symbol, paths]) => ({ symbol, paths: [...new Set(paths)].sort() }))
    .sort((left, right) => {
      if (right.paths.length !== left.paths.length) return right.paths.length - left.paths.length
      return left.symbol.localeCompare(right.symbol)
    })

  return { families, sameBasename, duplicateExportSymbols }
}

/** Named top-N helpers used by capture.mjs. */
export function topByInbound({ files, graph, limit = 20 }) {
  return files
    .filter(file => CODE_EXTENSIONS.has(file.ext))
    .map(file => ({
      path: file.relPath,
      lines: file.lines,
      bytes: file.bytes,
      inbound: inboundImporters(graph, file.relPath).length,
      productionInbound: productionImporters(graph, file.relPath).length,
    }))
    .filter(entry => entry.inbound > 0)
    .sort((left, right) => {
      if (right.productionInbound !== left.productionInbound)
        return right.productionInbound - left.productionInbound
      if (right.inbound !== left.inbound) return right.inbound - left.inbound
      return left.path.localeCompare(right.path)
    })
    .slice(0, limit)
}

export function topByLines({ files, limit = 20 }) {
  return files
    .filter(file => !isTestFile(file.relPath) && !isStraySource(file.relPath))
    .sort((left, right) => {
      if (right.lines !== left.lines) return right.lines - left.lines
      return left.relPath.localeCompare(right.relPath)
    })
    .slice(0, limit)
    .map(file => ({ path: file.relPath, lines: file.lines, bytes: file.bytes }))
}

export function categoryOf(relPath) {
  if (relPath === 'src/main.tsx' || relPath === 'src/App.tsx' || relPath === 'src/App.css') {
    return 'app-shell'
  }
  if (isTestFile(relPath)) return 'test'
  if (relPath.includes('/__tests__/')) return 'test'
  const relative = relPath.replace(/^src\//, '')
  const top = relative.includes('/') ? relative.split('/')[0] : 'root'
  const mapping = {
    accessibility: 'provider',
    assets: 'asset',
    components: 'component',
    composables: 'composable',
    config: 'config',
    context: 'provider',
    data: 'data',
    'design-system': 'styling',
    hooks: 'hook',
    lib: 'lib',
    pages: 'page',
    providers: 'provider',
    routes: 'config',
    scripts: 'script',
    services: 'service',
    stores: 'store',
    styles: 'styling',
    themes: 'styling',
    tokens: 'styling',
    types: 'types',
    utils: 'lib',
    validators: 'validator',
    workers: 'worker',
  }
  if (top === 'root') return 'app-shell'
  return mapping[top] || 'other'
}
