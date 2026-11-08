/**
 * Parity self-check — proves the harness itself is trustworthy before it is
 * used to judge a rebuild wave.
 *
 * Checks:
 *  1. legacy vs legacy compare #1 → every shot must have 0 changed pixels
 *  2. legacy vs legacy compare #2 → same, and screenshots must be byte-identical
 *     to run #1 (sha256 of every slice)
 *  3. diff perturbation: a deliberately altered copy of a real screenshot must
 *     be detected by the pixel threshold
 *  4. capture perturbation: a legacy page captured with an injected CSS change
 *     must fail the ordinary compare pipeline (exit code 1)
 *
 * Exit codes: 0 = harness trustworthy, 1 = a self-check failed. 2 = harness error.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_TOLERANCE, loadUiContract, probeUrl } from './config.mjs'
import { DEFAULT_OUT_DIR } from './util.mjs'
import { perturbPng } from './diff.mjs'
import { HarnessError, ROOT, formatRatio, log, nowIso, sha256, writeJsonFile } from './util.mjs'
import { runCompare } from './compare.mjs'

export const DEFAULT_LEGACY_URL = 'http://127.0.0.1:4174'

const USAGE = `Usage: node tools/parity/selfcheck.mjs [--url <legacy-url>] [--routes <selector>] [--matrix <selector>] [--themes <selector>] [--out <dir>] [--json]

Defaults: --url ${DEFAULT_LEGACY_URL} --routes priority --matrix desktop --themes dark
Exit codes: 0 = self-check passed, 1 = self-check failed, 2 = harness error.`

function parseArgs(argv) {
  const options = {
    url: DEFAULT_LEGACY_URL,
    routes: 'priority',
    matrix: 'desktop',
    themes: 'dark',
    outDir: DEFAULT_OUT_DIR,
    json: false,
    help: false,
  }
  const args = [...argv]
  const readValue = flag => {
    const value = args.shift()
    if (value === undefined || value.startsWith('--'))
      throw new HarnessError(`${flag} needs a value`)
    return value
  }
  while (args.length > 0) {
    const arg = args.shift()
    switch (arg) {
      case '--url':
        options.url = readValue(arg)
        break
      case '--routes':
        options.routes = readValue(arg)
        break
      case '--matrix':
        options.matrix = readValue(arg)
        break
      case '--themes':
        options.themes = readValue(arg)
        break
      case '--out':
        options.outDir = path.resolve(readValue(arg))
        break
      case '--json':
        options.json = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new HarnessError(`unknown argument "${arg}"\n\n${USAGE}`)
    }
  }
  return options
}

async function listRelativeFiles(rootDir) {
  const files = []
  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else files.push(path.relative(rootDir, full).split(path.sep).join('/'))
    }
  }
  await walk(rootDir)
  files.sort()
  return files
}

async function hashShots(rootDir) {
  const files = await listRelativeFiles(rootDir)
  const hashes = new Map()
  for (const file of files) {
    const buffer = await fs.readFile(path.join(rootDir, file))
    hashes.set(file, sha256(buffer))
  }
  return hashes
}

function describeZeroCheck(run, check) {
  const strict = `${run.summary.totals.shots} shots, 0 changed pixels`
  const parts = [strict]
  if (check.documented.length > 0) {
    parts.push(
      `${check.documented.length} documented exception(s): ${check.documented
        .map(item => `${item.key} ${item.changedPixels}px (${formatRatio(item.ratio ?? 0)})`)
        .join(', ')}`
    )
  }
  if (check.offenders.length > 0) {
    parts.push(
      `${check.offenders.length} offender(s): ${JSON.stringify(check.offenders.slice(0, 4))}`
    )
  }
  return parts.join(' · ')
}

function captureZeroCheck(run) {
  const offenders = []
  const documented = []
  for (const shot of run.summary.shots ?? []) {
    const changed = shot.pixelDiff?.changedPixels ?? null
    const textStatus = shot.textDiff?.status ?? 'unknown'
    if (shot.status !== 'pass' && shot.status !== 'allowed') {
      offenders.push({ key: shot.key, status: shot.status, reasons: shot.failureReasons })
      continue
    }
    if (textStatus !== 'pass') offenders.push({ key: shot.key, textStatus })
    if (changed === 0) continue
    if (shot.status === 'allowed') {
      // Reviewed expiring allowlist entry: a documented capture residual, not a
      // silent pass. Surfaced in the check detail either way.
      documented.push({
        key: shot.key,
        changedPixels: changed,
        ratio: shot.pixelDiff?.ratio ?? null,
        reason: shot.allowlist?.entry?.reason ?? null,
      })
      continue
    }
    offenders.push({ key: shot.key, changedPixels: changed })
  }
  return { offenders, documented }
}

async function runSelfcheck(options) {
  const startedAt = nowIso()
  const startedMs = Date.now()
  const checks = []
  const record = (id, status, detail) => {
    checks.push({ id, status, detail })
    log.out(`${status === 'pass' ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`)
  }

  // Fail fast: the oracle preview must be reachable before the harness runs.
  const probe = await probeUrl(options.url)
  log.step(`oracle reachable: ${options.url} (HTTP ${probe.status})`)
  const ui = await loadUiContract()
  log.step(`fixed clock from ${ui.source}: ${ui.fixedNow}`)

  const baseOptions = {
    legacyUrl: options.url,
    rebuildUrl: options.url,
    routes: options.routes,
    matrix: options.matrix,
    themes: options.themes,
    wave: 1,
    maxDiffRatio: DEFAULT_TOLERANCE.maxDiffRatio,
    pixelThreshold: DEFAULT_TOLERANCE.pixelThreshold,
    headless: true,
    report: true,
  }

  const outDir = options.outDir
  await fs.mkdir(outDir, { recursive: true })
  const run1Dir = path.join(outDir, 'run1')
  const run2Dir = path.join(outDir, 'run2')
  const perturbDir = path.join(outDir, 'perturbed-capture')
  const diffPerturbDir = path.join(outDir, 'perturbed-diff')

  // ── 1 + 2: legacy vs legacy, twice ──────────────────────────────────────
  log.out('')
  log.out(
    `=== run 1: legacy vs legacy (${options.routes} × ${options.matrix} × ${options.themes}) ===`
  )
  const run1 = await runCompare({ ...baseOptions, outDir: run1Dir })
  const check1 = captureZeroCheck(run1)
  record(
    'run-1-legacy-vs-legacy',
    run1.exitCode === 0 && check1.offenders.length === 0 ? 'pass' : 'fail',
    describeZeroCheck(run1, check1)
  )

  log.out('')
  log.out('=== run 2: legacy vs legacy (repeat) ===')
  const run2 = await runCompare({ ...baseOptions, outDir: run2Dir })
  const check2 = captureZeroCheck(run2)
  record(
    'run-2-legacy-vs-legacy',
    run2.exitCode === 0 && check2.offenders.length === 0 ? 'pass' : 'fail',
    describeZeroCheck(run2, check2)
  )

  // Byte-identical repeat: same key → same sha256 for every legacy window,
  // except shots covered by a reviewed allowlist exception (their residual
  // nondeterminism is documented, bounded and surfaced above).
  const allowedKeys = new Set(
    (run1.summary.shots ?? [])
      .filter(shot => shot.status === 'allowed')
      .map(shot => `${shot.route}__${shot.viewport}__${shot.theme}`)
  )
  const hashes1 = await hashShots(path.join(run1Dir, 'shots', 'legacy'))
  const hashes2 = await hashShots(path.join(run2Dir, 'shots', 'legacy'))
  const hashMismatches = []
  const documentedHashMismatches = []
  if (hashes1.size !== hashes2.size) {
    hashMismatches.push(`window count ${hashes1.size} vs ${hashes2.size}`)
  }
  for (const [file, hash] of hashes1) {
    if (hashes2.get(file) === hash) continue
    const key = file.split('--')[0]
    if (allowedKeys.has(key)) documentedHashMismatches.push(file)
    else hashMismatches.push(file)
  }
  record(
    'run-2-byte-identical-to-run-1',
    hashMismatches.length === 0 ? 'pass' : 'fail',
    hashMismatches.length === 0
      ? `${hashes1.size - documentedHashMismatches.length} windows byte-identical across runs${
          documentedHashMismatches.length > 0
            ? `; ${documentedHashMismatches.length} window(s) in documented exceptions`
            : ''
        }`
      : `${hashMismatches.length} mismatch(es): ${hashMismatches.slice(0, 4).join(', ')}`
  )

  // ── 3: diff-level perturbation detection ───────────────────────────────
  const legacySliceFiles = [...hashes1.keys()]
    .filter(file => file.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b))
  if (legacySliceFiles.length === 0) {
    record('perturbed-diff-detected', 'fail', 'no legacy slices were captured to perturb')
  } else {
    await fs.mkdir(diffPerturbDir, { recursive: true })
    const sourceFile = path.join(run1Dir, 'shots', 'legacy', legacySliceFiles[0])
    const targetFile = path.join(diffPerturbDir, 'perturbed.png')
    const metrics = await perturbPng(sourceFile, targetFile, {
      pixelThreshold: DEFAULT_TOLERANCE.pixelThreshold,
    })
    const detected =
      metrics.changedPixels > 0 && metrics.ratio > Math.max(DEFAULT_TOLERANCE.maxDiffRatio, 0.001)
    record(
      'perturbed-diff-detected',
      detected ? 'pass' : 'fail',
      `changed ${metrics.changedPixels} px (${formatRatio(metrics.ratio)}) in ${path.basename(sourceFile)}`
    )
  }

  // ── 4: capture-level perturbation must fail the normal pipeline ────────
  const firstShot = run1.summary.shots?.[0]
  if (!firstShot) {
    record('perturbed-capture-detected', 'fail', 'run 1 captured no shots')
  } else {
    const perturbed = await runCompare({
      ...baseOptions,
      routes: firstShot.route,
      matrix: firstShot.viewport,
      themes: firstShot.theme,
      outDir: perturbDir,
      report: true,
      injectCss: { legacy: 'html{filter:hue-rotate(150deg) saturate(2.4) !important}' },
    })
    const detected =
      perturbed.exitCode === 1 &&
      (perturbed.summary.totals.failed ?? 0) > 0 &&
      (perturbed.summary.totals.changedPixels ?? 0) > 0
    record(
      'perturbed-capture-detected',
      detected ? 'pass' : 'fail',
      `injected CSS on ${firstShot.route}/${firstShot.viewport}/${firstShot.theme} → exit ${perturbed.exitCode}, ` +
        `${perturbed.summary.totals.changedPixels} changed px`
    )
  }

  const passed = checks.every(check => check.status === 'pass')
  const summary = {
    schemaVersion: 1,
    kind: 'parity-selfcheck',
    generatedAt: startedAt,
    durationMs: Date.now() - startedMs,
    oracle: options.url,
    matrix: { routes: options.routes, viewports: options.matrix, themes: options.themes },
    fixedNow: ui.fixedNow,
    checks,
    runs: {
      run1: path.relative(ROOT, run1Dir).split(path.sep).join('/'),
      run2: path.relative(ROOT, run2Dir).split(path.sep).join('/'),
    },
    verdict: { status: passed ? 'passed' : 'failed', exitCode: passed ? 0 : 1 },
  }
  const summaryPath = path.join(outDir, 'selfcheck.json')
  await writeJsonFile(summaryPath, summary)
  log.out('')
  log.out(`Self-check ${passed ? 'PASSED' : 'FAILED'} in ${Math.round(summary.durationMs / 1000)}s`)
  log.out(`Self-check summary: ${summaryPath}`)
  return { summary, exitCode: passed ? 0 : 1, summaryPath }
}

export async function main(argv) {
  let options
  try {
    options = parseArgs(argv)
  } catch (error) {
    log.error(error.message)
    return 2
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  log.setJsonMode(options.json)
  try {
    const { summary, exitCode } = await runSelfcheck(options)
    if (options.json) log.printJson(summary)
    return exitCode
  } catch (error) {
    if (error instanceof HarnessError) {
      log.error(error.message)
      return 2
    }
    log.error(`unexpected error: ${error.stack ?? error.message}`)
    return 2
  }
}

const invokedDirectly = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  process.exitCode = await main(process.argv.slice(2))
}
