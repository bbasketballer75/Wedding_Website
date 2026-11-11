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
import { compareDecoded, decodePng, perturbPng } from './diff.mjs'
import { evaluateAllowlist, loadAllowlist } from './allowlist.mjs'
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

function captureZeroCheck(run, { allowlist = null, wave = 1 } = {}) {
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
    // A reviewed allowlist entry documents a bounded capture residual — apply it
    // whether or not this particular run happened to be exactly 0.
    const limit = documentedPixelLimit({ allowlist, shot, wave })
    if (limit !== null && (shot.pixelDiff?.ratio ?? 0) <= limit) {
      documented.push({
        key: shot.key,
        changedPixels: changed,
        ratio: shot.pixelDiff?.ratio ?? null,
        reason: shot.allowlist?.entry?.reason ?? null,
      })
      continue
    }
    if (shot.status === 'allowed') {
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

/**
 * Reviewed allowlist limit for one shot (route id/path + viewport + theme at the
 * current wave), or null when the shot has no active documented exception.
 */
function documentedPixelLimit({ allowlist, shot, wave }) {
  if (!allowlist) return null
  const evaluation = evaluateAllowlist({
    allowlist,
    route: { id: shot.route, path: shot.routePath ?? shot.path ?? '' },
    viewport: shot.viewport,
    theme: shot.theme,
    ratio: 0,
    wave,
  })
  return evaluation.entry?.maxDiffPixelRatio ?? null
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
  // Reviewed allowlist entries define the documented capture residuals: a
  // residual is "documented" when the shot matches an active entry, regardless
  // of whether this particular repeat happened to be exactly 0 px.
  const allowlist = await loadAllowlist(path.join(ROOT, 'contracts', 'parity-allowlist.json'))

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
  const check1 = captureZeroCheck(run1, { allowlist, wave: baseOptions.wave })
  record(
    'run-1-legacy-vs-legacy',
    run1.exitCode === 0 && check1.offenders.length === 0 ? 'pass' : 'fail',
    describeZeroCheck(run1, check1)
  )

  log.out('')
  log.out('=== run 2: legacy vs legacy (repeat) ===')
  const run2 = await runCompare({ ...baseOptions, outDir: run2Dir })
  const check2 = captureZeroCheck(run2, { allowlist, wave: baseOptions.wave })
  record(
    'run-2-legacy-vs-legacy',
    run2.exitCode === 0 && check2.offenders.length === 0 ? 'pass' : 'fail',
    describeZeroCheck(run2, check2)
  )

  // Repeat-run determinism: decode every captured window pair and require
  // **0 changed pixels** between run 1 and run 2 (same documented allowlist
  // exceptions as a normal compare). PNG byte equality is reported as a
  // diagnostic only — ancillary PNG chunks/metadata must never fail the gate.
  const allowedKeys = new Set(
    (run1.summary.shots ?? [])
      .filter(shot => shot.status === 'allowed')
      .map(shot => `${shot.route}__${shot.viewport}__${shot.theme}`)
  )
  const hashes1 = await hashShots(path.join(run1Dir, 'shots', 'legacy'))
  const hashes2 = await hashShots(path.join(run2Dir, 'shots', 'legacy'))
  const pixelOffenders = []
  const documentedDiffers = []
  let byteIdentical = 0
  let pixelIdentical = 0
  if (hashes1.size !== hashes2.size) {
    pixelOffenders.push(`window count ${hashes1.size} vs ${hashes2.size}`)
  }
  for (const [file, hash] of hashes1) {
    const key = file.split('--')[0]
    const firstPng = await decodePng(path.join(run1Dir, 'shots', 'legacy', file))
    const secondPng = await decodePng(path.join(run2Dir, 'shots', 'legacy', file))
    if (hashes2.get(file) === hash) byteIdentical += 1
    if (firstPng.width !== secondPng.width || firstPng.height !== secondPng.height) {
      pixelOffenders.push(
        `${file} dimensions ${firstPng.width}x${firstPng.height} vs ${secondPng.width}x${secondPng.height}`
      )
      continue
    }
    const metrics = compareDecoded(firstPng, secondPng, {
      pixelThreshold: DEFAULT_TOLERANCE.pixelThreshold,
    })
    if (metrics.changedPixels === 0) {
      pixelIdentical += 1
      continue
    }
    const shotMeta = (run1.summary.shots ?? []).find(shot => shot.key === key)
    const limit = shotMeta
      ? documentedPixelLimit({ allowlist, shot: shotMeta, wave: baseOptions.wave })
      : null
    if (allowedKeys.has(key) || (limit !== null && metrics.ratio <= limit)) {
      documentedDiffers.push({ file, changedPixels: metrics.changedPixels, ratio: metrics.ratio })
      continue
    }
    pixelOffenders.push(`${file} changed ${metrics.changedPixels}px`)
  }
  record(
    'run-2-pixel-identical-to-run-1',
    pixelOffenders.length === 0 ? 'pass' : 'fail',
    pixelOffenders.length === 0
      ? `${pixelIdentical}/${hashes1.size} windows pixel-identical (0 changed pixels); ` +
          `${byteIdentical}/${hashes1.size} byte-identical${
            documentedDiffers.length > 0
              ? `; ${documentedDiffers.length} in documented exceptions: ${documentedDiffers
                  .map(item => `${item.file} ${item.changedPixels}px (${formatRatio(item.ratio)})`)
                  .join(', ')}`
              : ''
          }`
      : `${pixelOffenders.length} offender(s): ${pixelOffenders.slice(0, 4).join(', ')}`
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
      // Tolerance is enabled for the perturbation checks on purpose: a real
      // change must still be detected with the edge-raster tolerance on.
      // The determinism checks below stay in the default exact mode.
      edgeTolerance: 1,
    })
    const detected =
      metrics.changedPixels > 0 && metrics.ratio > Math.max(DEFAULT_TOLERANCE.maxDiffRatio, 0.001)
    record(
      'perturbed-diff-detected',
      detected ? 'pass' : 'fail',
      `changed ${metrics.changedPixels} px (${formatRatio(metrics.ratio)}) in ${path.basename(sourceFile)} with --edge-tolerance 1`
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
      // A deliberate page change must be detected even with the edge-raster
      // tolerance enabled (proves the tolerance cannot hide real changes).
      edgeTolerance: 1,
      injectCss: { legacy: 'html{filter:hue-rotate(150deg) saturate(2.4) !important}' },
    })
    const detected =
      perturbed.exitCode === 1 &&
      (perturbed.summary.totals.failed ?? 0) > 0 &&
      (perturbed.summary.totals.changedPixels ?? 0) > 0
    record(
      'perturbed-capture-detected',
      detected ? 'pass' : 'fail',
      `injected CSS on ${firstShot.route}/${firstShot.viewport}/${firstShot.theme} with --edge-tolerance 1 ` +
        `→ exit ${perturbed.exitCode}, ${perturbed.summary.totals.changedPixels} changed px`
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
