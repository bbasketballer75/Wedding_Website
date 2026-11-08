#!/usr/bin/env node
/**
 * Inventory of the frozen legacy app (`src/**`).
 *
 * Deliverable for WP-6: the rebuild needs a measured picture of what it is
 * replacing before any code is written. This script writes
 * `contracts/baseline/inventory.json` (gitignored, heavy) with:
 *
 *   - per-file lines/bytes and aggregate cuts (raw walk, .ts/.tsx only, code
 *     only, production vs tests, stylesheets, assets);
 *   - the `<Route>` table from src/App.tsx and its lazy modules;
 *   - the resolved static/dynamic/worker import graph, unresolved specifiers,
 *     and the hottest modules by inbound imports;
 *   - dead-code evidence: zero-inbound files, test-only files, stray backups;
 *   - barrel (`index.*`) fan-in and the duplicate-module families;
 *   - dependency inventory with usage evidence and classification.
 *
 * Output is deterministic: no timestamps, every array sorted, so re-running on
 * the unchanged frozen app produces byte-identical JSON.
 *
 * Usage:
 *   node tools/inventory/capture.mjs
 *   node tools/inventory/capture.mjs --out <path>
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readJson, writeJson } from '../lib/fs.mjs'
import { baselineDir, repoPath, repoRoot } from '../lib/paths.mjs'
import { info, ok, step } from '../lib/log.mjs'
import {
  APP_FILE,
  CODE_EXTENSIONS,
  STYLESHEET_EXTENSIONS,
  TEXT_EXTENSIONS,
  analyzeBarrels,
  buildImportGraph,
  categoryOf,
  discoverRouteTable,
  findDeadCodeCandidates,
  findDuplicateFamilies,
  isTestFile,
  topByInbound,
  topByLines,
  walkSourceFiles,
} from './routes.mjs'
import { analyzeDependencies } from './deps.mjs'

const LINE_COUNTABLE_EXTENSIONS = new Set([...TEXT_EXTENSIONS, '.bak'])

function countLines(text) {
  if (text.length === 0) return 0
  const newlines = (text.match(/\n/g) || []).length
  return text.endsWith('\n') ? newlines : newlines + 1
}

function countNonBlankLines(text) {
  if (text.length === 0) return 0
  return text.split('\n').filter(line => /\S/.test(line)).length
}

function sumBy(entries, key) {
  return entries.reduce((total, entry) => total + (entry[key] || 0), 0)
}

function bytesLabel(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function cut(name, description, entries) {
  return {
    name,
    description,
    files: entries.length,
    bytes: sumBy(entries, 'bytes'),
    lines: sumBy(entries, 'lines'),
    nonBlankLines: sumBy(entries, 'nonBlankLines'),
  }
}

async function loadSourceFiles(srcDir) {
  const listed = await walkSourceFiles(srcDir, { prefix: 'src' })
  const files = []

  for (const listedFile of listed) {
    const extension = path.extname(listedFile.relPath).toLowerCase()
    const buffer = await readFile(listedFile.absPath)
    const lineCountable = LINE_COUNTABLE_EXTENSIONS.has(extension)
    const source = lineCountable ? buffer.toString('utf8') : null
    const parseable = CODE_EXTENSIONS.has(extension) || STYLESHEET_EXTENSIONS.has(extension)
    files.push({
      relPath: listedFile.relPath,
      extension,
      ext: extension,
      bytes: buffer.byteLength,
      lines: source === null ? 0 : countLines(source),
      nonBlankLines: source === null ? 0 : countNonBlankLines(source),
      category: categoryOf(listedFile.relPath),
      isTest: isTestFile(listedFile.relPath),
      content: parseable ? source : null,
    })
  }

  return files
}

function aggregateByDirectory(files) {
  const groups = new Map()
  for (const file of files) {
    const directory = path.posix.dirname(file.relPath)
    const group = groups.get(directory) || { directory, files: 0, bytes: 0, lines: 0 }
    group.files += 1
    group.bytes += file.bytes
    group.lines += file.lines
    groups.set(directory, group)
  }
  return [...groups.values()]
    .sort((left, right) => {
      if (right.lines !== left.lines) return right.lines - left.lines
      return left.directory.localeCompare(right.directory)
    })
    .slice(0, 40)
}

function aggregateByExtension(files) {
  const groups = new Map()
  for (const file of files) {
    const extension = file.extension || '(none)'
    const group = groups.get(extension) || { extension, files: 0, bytes: 0, lines: 0 }
    group.files += 1
    group.bytes += file.bytes
    group.lines += file.lines
    groups.set(extension, group)
  }
  return [...groups.values()].sort((left, right) => {
    if (right.files !== left.files) return right.files - left.files
    return left.extension.localeCompare(right.extension)
  })
}

function aggregateByCategory(files) {
  const groups = new Map()
  for (const file of files) {
    const group = groups.get(file.category) || {
      category: file.category,
      files: 0,
      bytes: 0,
      lines: 0,
    }
    group.files += 1
    group.bytes += file.bytes
    group.lines += file.lines
    groups.set(file.category, group)
  }
  return [...groups.values()].sort((left, right) => {
    if (right.lines !== left.lines) return right.lines - left.lines
    return left.category.localeCompare(right.category)
  })
}

function parseArgs(argv) {
  const options = { out: path.join(baselineDir, 'inventory.json') }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out' && argv[index + 1]) {
      options.out = path.resolve(argv[index + 1])
      index += 1
    }
  }
  return options
}

async function buildInventory() {
  const srcDir = repoPath('src')
  const sourceFiles = await loadSourceFiles(srcDir)
  const packageJson = await readJson(repoPath('package.json'))

  step('Source files')
  const codeFiles = sourceFiles.filter(file => CODE_EXTENSIONS.has(file.extension))
  const typeScriptFiles = sourceFiles.filter(
    file => file.extension === '.ts' || file.extension === '.tsx'
  )
  const productionCode = codeFiles.filter(file => !file.isTest)
  const productionTypeScript = typeScriptFiles.filter(file => !file.isTest)
  const testFiles = sourceFiles.filter(file => file.isTest)
  const stylesheetFiles = sourceFiles.filter(file => file.extension === '.css')
  const assetFiles = sourceFiles.filter(
    file => !CODE_EXTENSIONS.has(file.extension) && !STYLESHEET_EXTENSIONS.has(file.extension)
  )

  const cuts = [
    cut('rawWalk', 'all files under src/** (any extension, no filters)', sourceFiles),
    cut('typescript', 'src/**/*.{ts,tsx}', typeScriptFiles),
    cut(
      'productionTypeScript',
      'src/**/*.{ts,tsx} excluding *.test.* / *.spec.* / __tests__',
      productionTypeScript
    ),
    cut('code', 'src/**/*.{ts,tsx,js,jsx,mjs,cjs}', codeFiles),
    cut('productionCode', 'code excluding test files', productionCode),
    cut('tests', '*.test.* / *.spec.* / __tests__ files', testFiles),
    cut('stylesheets', 'src/**/*.css', stylesheetFiles),
    cut('assets', 'non-code, non-stylesheet files (images, svg, .bak, ...)', assetFiles),
  ]

  ok(
    `${sourceFiles.length} files, ${sumBy(sourceFiles, 'lines')} countable lines, ${bytesLabel(sumBy(sourceFiles, 'bytes'))}`
  )
  ok(`.ts/.tsx cut: ${typeScriptFiles.length} files / ${sumBy(typeScriptFiles, 'lines')} lines`)

  step('Routes')
  const appSource = await readFile(repoPath(APP_FILE), 'utf8')
  const routeTable = discoverRouteTable(appSource)
  ok(
    `${routeTable.routes.length} routes in ${APP_FILE}, ${routeTable.lazyComponents.length} lazy components`
  )

  step('Import graph')
  const graph = buildImportGraph(sourceFiles)
  const parsedNodes = sourceFiles.filter(file => typeof file.content === 'string').length
  ok(
    `${parsedNodes} parsed modules, ${graph.edges.length} internal edges, ` +
      `${graph.packages.size} package specifiers`
  )
  if (graph.unresolved.length > 0) {
    info(`${graph.unresolved.length} unresolved internal specifier(s) recorded`)
  }

  const srcPackages = [...graph.packages.entries()]
    .map(([name, record]) => ({
      name,
      importers: record.importers.size,
      occurrences: record.occurrences,
    }))
    .sort((left, right) => {
      if (right.importers !== left.importers) return right.importers - left.importers
      return left.name.localeCompare(right.name)
    })

  step('Dead code + barrels + duplicates')
  const deadCode = findDeadCodeCandidates({ files: sourceFiles, graph })
  const barrels = analyzeBarrels({ files: sourceFiles, graph })
  const duplicates = findDuplicateFamilies({ files: sourceFiles, graph })
  ok(
    `${deadCode.likelyDead.length} zero-inbound candidate(s), ` +
      `${deadCode.testOnly.length} test-only module(s), ${deadCode.strayFiles.length} stray file(s)`
  )
  ok(`${barrels.length} index barrels, ${duplicates.sameBasename.length} same-basename groups`)

  step('Dependencies')
  const dependencies = await analyzeDependencies({ repoRoot, packageJson })
  const classificationSummary = Object.entries(dependencies.classificationCounts)
    .map(([classification, count]) => `${count} ${classification}`)
    .join(', ')
  ok(`${dependencies.declaredCounts.total} declared packages: ${classificationSummary}`)

  return {
    scope: {
      root: 'src/',
      generatedBy: 'node tools/inventory/capture.mjs',
      deterministic: true,
      note:
        'Line counts are newline counts over text files (binary assets count bytes only). ' +
        'The import graph is a static regex parse resolved against the src file set; ' +
        'package specifier counts are src-only (the dependency section is repo-wide).',
    },
    files: {
      cuts,
      byExtension: aggregateByExtension(sourceFiles),
      byCategory: aggregateByCategory(sourceFiles),
      byDirectory: aggregateByDirectory(sourceFiles),
      largestByLines: topByLines({ files: sourceFiles, limit: 20 }),
      bytesLabel: bytesLabel(sumBy(sourceFiles, 'bytes')),
    },
    routes: {
      file: APP_FILE,
      count: routeTable.routes.length,
      lazyComponents: routeTable.lazyComponents,
      entries: routeTable.routes,
      note: 'Route table parsed from the legacy <Routes> tree; route contracts are owned by contracts-eng.',
    },
    importGraph: {
      nodes: parsedNodes,
      edges: graph.edges.length,
      edgesByKind: graph.kindCounts,
      unresolvedCount: graph.unresolved.length,
      unresolved: graph.unresolved.slice(0, 50),
      externalReferenceCount: graph.externalReferences.length,
      externalReferences: graph.externalReferences.slice(0, 30),
      publicAssetReferences: graph.publicAssetReferences,
      virtualModules: [...graph.virtuals.entries()]
        .map(([module, record]) => ({
          module,
          importers: [...record.importers].sort((left, right) => left.localeCompare(right)),
        }))
        .sort((left, right) => left.module.localeCompare(right.module)),
      topPackages: srcPackages.slice(0, 30),
      hottestModules: topByInbound({ files: sourceFiles, graph, limit: 20 }),
    },
    barrels,
    deadCode: {
      likelyDead: deadCode.likelyDead,
      testOnly: deadCode.testOnly,
      strayFiles: deadCode.strayFiles,
      totals: {
        likelyDeadFiles: deadCode.likelyDead.length,
        likelyDeadLines: sumBy(deadCode.likelyDead, 'lines'),
        testOnlyFiles: deadCode.testOnly.length,
        testOnlyLines: sumBy(deadCode.testOnly, 'lines'),
        strayFiles: deadCode.strayFiles.length,
      },
    },
    duplicates,
    dependencies,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const inventory = await buildInventory()
  await writeJson(options.out, inventory)
  const outputPath = path.relative(repoRoot, options.out).split(path.sep).join('/')
  step('Wrote inventory')
  ok(outputPath)
  info(`files: ${inventory.files.cuts[0].files} raw / ${inventory.files.cuts[1].files} ts+tsx`)
  info(
    `dead-code evidence: ${inventory.deadCode.totals.likelyDeadFiles} zero-inbound, ` +
      `${inventory.deadCode.totals.testOnlyFiles} test-only, ${inventory.deadCode.totals.strayFiles} stray`
  )
  info(`unused dependencies: ${inventory.dependencies.unused.length}`)
}

main().catch(error => {
  console.error(`\n> inventory capture FAILED: ${error.stack || error.message}`)
  process.exit(1)
})
