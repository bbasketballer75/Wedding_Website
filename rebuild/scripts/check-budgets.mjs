#!/usr/bin/env node
/* global console, process, URL */
/**
 * Bundle budget gate (Wave 8 W8-2).
 *
 * Measures the Lead-built `rebuild/dist` and enforces the QUALITY_BAR budgets:
 *   - initial JS (entry module script + `<link rel="modulepreload">`) ≤ 180 KiB gzip
 *   - any route/lazy chunk ≤ 120 KiB gzip
 *   - total JS ≤ 450 KiB gzip
 *   - initial CSS tracked (regression-gated; 40 KiB target)
 *
 * Modes:
 *   --mode strict    enforce the fixed QUALITY_BAR targets (default)
 *   --mode baseline  ignore fixed targets, fail only on regressions vs the
 *                    recorded `perf/budgets.baseline.json` (temporary CI mode
 *                    until the initial-payload optimisation lands)
 *
 * The Lead owns builds: this script never runs Vite. Point it at an existing
 * build (`--dist`) and optionally at a Vite manifest (`--manifest`) when
 * `build.manifest: true` is enabled.
 *
 * Usage:
 *   node scripts/check-budgets.mjs
 *   node scripts/check-budgets.mjs --mode baseline
 *   node scripts/check-budgets.mjs --json --report-json perf/last-budget-report.json
 *   node scripts/check-budgets.mjs --write-baseline          # refresh the baseline
 *   node scripts/check-budgets.mjs --manifest dist/.vite/manifest.json
 *
 * Exit codes: 0 pass, 1 budget/regression failure, 2 usage/IO error.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import {
  DEFAULT_BUDGET_TARGETS,
  buildBudgetReport,
  formatKiB,
  formatReportTable,
  parseBudgetBaseline,
  parseIndexHtmlReferences,
  reportToBaseline,
} from '../src/shared/media/build-budget.ts'

const REBUILD_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEFAULT_DIST = join(REBUILD_ROOT, 'dist')
const DEFAULT_BASELINE = join(REBUILD_ROOT, 'perf', 'budgets.baseline.json')

const HELP = `Usage: node scripts/check-budgets.mjs [options]

Options:
  --dist <dir>            Built app directory (default: rebuild/dist)
  --baseline <file>       Baseline file (default: rebuild/perf/budgets.baseline.json)
  --mode <strict|baseline>  strict = QUALITY_BAR targets (default); baseline = regressions only
  --manifest <file>       Vite build manifest (requires build.manifest: true in vite config)
  --json                  Print the full report as JSON to stdout
  --report-json <file>    Also write the JSON report to a file (CI artifact)
  --write-baseline        Rewrite the baseline from this build
  --documented-at <date>  Baseline "documentedAt" value (default: today, YYYY-MM-DD)
  --source <text>         Baseline "source" description (default: build path + mtime)
  --note <text>           Extra baseline note (repeatable)
  --help                  Show this help
`

function parseArgs(argv) {
  const options = {
    dist: DEFAULT_DIST,
    baseline: DEFAULT_BASELINE,
    mode: 'strict',
    manifest: null,
    json: false,
    reportJson: null,
    writeBaseline: false,
    documentedAt: new Date().toISOString().slice(0, 10),
    source: null,
    notes: [],
    help: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const next = () => {
      const value = argv[++index]
      if (value === undefined) throw new Error(`${arg} requires a value`)
      return value
    }
    switch (arg) {
      case '--dist':
        options.dist = resolve(REBUILD_ROOT, next())
        break
      case '--baseline':
        options.baseline = resolve(REBUILD_ROOT, next())
        break
      case '--mode': {
        const mode = next()
        if (mode !== 'strict' && mode !== 'baseline') throw new Error(`invalid --mode ${mode}`)
        options.mode = mode
        break
      }
      case '--manifest':
        options.manifest = resolve(REBUILD_ROOT, next())
        break
      case '--json':
        options.json = true
        break
      case '--report-json':
        options.reportJson = resolve(REBUILD_ROOT, next())
        break
      case '--write-baseline':
        options.writeBaseline = true
        break
      case '--documented-at':
        options.documentedAt = next()
        break
      case '--source':
        options.source = next()
        break
      case '--note':
        options.notes.push(next())
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`unknown option ${arg}`)
    }
  }

  return options
}

function walkFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

/**
 * Optional Vite-manifest mode: derive the initial JS closure from the entry
 * chunk's static `imports` instead of parsing index.html. Falls back to the
 * html contract with a warning when the manifest is missing/unreadable.
 */
function refsFromViteManifest(manifestPath, htmlRefs) {
  if (!existsSync(manifestPath)) {
    console.warn(`[budgets] manifest not found at ${manifestPath}; using index.html references`)
    return htmlRefs
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.warn(`[budgets] could not parse manifest (${error.message}); using index.html`)
    return htmlRefs
  }

  const keys = Object.keys(manifest)
  const entryKey =
    keys.find(key => key === 'index.html') ?? keys.find(key => manifest[key]?.isEntry === true)
  if (!entryKey) {
    console.warn('[budgets] manifest has no entry chunk; using index.html references')
    return htmlRefs
  }

  const entryScripts = []
  const modulePreloads = []
  const stylesheets = new Set()
  const seen = new Set()

  const visit = key => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk?.file) return
    if (key === entryKey) entryScripts.push(chunk.file)
    else modulePreloads.push(chunk.file)
    for (const css of chunk.css ?? []) stylesheets.add(css)
    for (const imported of chunk.imports ?? []) visit(imported)
  }
  visit(entryKey)

  return { entryScripts, modulePreloads, stylesheets: [...stylesheets] }
}

function measureAssets(dist) {
  const assetsDir = join(dist, 'assets')
  const files = walkFiles(assetsDir).filter(file => /\.(js|css)$/.test(file))
  const assets = files.map(file => {
    const raw = readFileSync(file)
    return {
      file: relative(assetsDir, file).split('\\').join('/'),
      rawBytes: raw.length,
      gzipBytes: gzipSync(raw, { level: 9 }).length,
      brotliBytes: brotliCompressSync(raw).length,
    }
  })
  return {
    jsAssets: assets.filter(asset => asset.file.endsWith('.js')),
    cssAssets: assets.filter(asset => asset.file.endsWith('.css')),
  }
}

function loadBaseline(path, mode) {
  if (!existsSync(path)) {
    if (mode === 'baseline') {
      throw new Error(
        `baseline mode needs a recorded baseline at ${path}. Run --write-baseline on a known build first.`
      )
    }
    return undefined
  }
  return parseBudgetBaseline(JSON.parse(readFileSync(path, 'utf8')))
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return 0
  }

  const dist = options.dist
  const indexHtmlPath = join(dist, 'index.html')
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`no build found: ${indexHtmlPath}. The Lead owns builds; pass --dist.`)
  }

  const baseline = loadBaseline(options.baseline, options.mode)
  const targets = baseline?.targets ?? DEFAULT_BUDGET_TARGETS
  const htmlRefs = parseIndexHtmlReferences(readFileSync(indexHtmlPath, 'utf8'))
  if (htmlRefs.entryScripts.length === 0) {
    throw new Error(`could not find the entry module script in ${indexHtmlPath}`)
  }
  const refs = options.manifest ? refsFromViteManifest(options.manifest, htmlRefs) : htmlRefs
  const { jsAssets, cssAssets } = measureAssets(dist)

  const report = buildBudgetReport({
    mode: options.mode,
    dist,
    refs,
    jsAssets,
    cssAssets,
    targets,
    ...(baseline ? { baseline } : {}),
  })

  // Baseline comparison summary (always useful, even in strict mode).
  if (baseline) {
    const deltas = [
      ['initial JS', report.measurement.initialJsGzBytes, baseline.measured.initialJsGzBytes],
      ['total JS', report.measurement.totalJsGzBytes, baseline.measured.totalJsGzBytes],
      ['initial CSS', report.measurement.initialCssGzBytes, baseline.measured.initialCssGzBytes],
    ]
    if (!options.json) {
      console.log('vs recorded baseline:')
      for (const [label, current, recorded] of deltas) {
        const delta = current - recorded
        const sign = delta >= 0 ? '+' : '-'
        console.log(`  ${label}: ${sign}${formatKiB(Math.abs(delta))} (${formatKiB(current)} now)`)
      }
      console.log('')
    }
  }

  if (options.writeBaseline) {
    const entry = refs.entryScripts[0] ?? 'unknown'
    const buildMtime = statSync(join(dist, 'index.html')).mtime.toISOString()
    const source =
      options.source ?? `rebuild/dist @ ${buildMtime} (entry ${entry}, mode ${options.mode})`
    const nextBaseline = reportToBaseline(report, {
      documentedAt: options.documentedAt,
      source,
      compression: 'gzip level 9 / brotli default over raw emitted bytes (zlib)',
      notes: [
        'QUALITY_BAR targets: initial JS ≤180 KiB gz, any route ≤120 KiB gz, total JS ≤450 KiB gz.',
        'Measured with scripts/check-budgets.mjs (Lead-built rebuild/dist; no build run by this script).',
        ...options.notes,
      ],
    })
    mkdirSync(dirname(options.baseline), { recursive: true })
    writeFileSync(options.baseline, `${JSON.stringify(nextBaseline, null, 2)}\n`)
    if (!options.json) console.log(`baseline written: ${options.baseline}\n`)
  }

  if (options.reportJson) {
    mkdirSync(dirname(options.reportJson), { recursive: true })
    writeFileSync(options.reportJson, `${JSON.stringify(report, null, 2)}\n`)
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(
      `bundle budgets — ${dist} (${options.mode} mode${options.manifest ? ', vite manifest' : ''})`
    )
    console.log('')
    console.log(formatReportTable(report))
    if (report.violations.length > 0 && options.mode === 'strict') {
      console.log('')
      console.log(
        'NOTE: fixed QUALITY_BAR targets are not met by this build. Use --mode baseline to gate'
      )
      console.log('regressions only while the initial-payload optimisation is in progress.')
    }
  }

  return report.verdict === 'pass' ? 0 : 1
}

try {
  const exitCode = main()
  process.exitCode = exitCode
} catch (error) {
  console.error(`[budgets] ${error.message}`)
  process.exitCode = 2
}
