/**
 * Parity compare CLI — captures the legacy oracle and the rebuild side under an
 * identical deterministic environment, diffs pixels + text, and writes
 * shots/, text/, summary.json and report.html.
 *
 * Exit codes: 0 = pass, 1 = unexplained parity diff, 2 = harness/config error.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAPTURE,
  DEFAULT_TOLERANCE,
  USAGE,
  announceWarnings,
  loadRoutesContract,
  loadUiContract,
  capturePathOverrides,
  maskSelectorsFor,
  parseCompareArgs,
  probeUrl,
  resolveRoutePath,
  resolveSelection,
} from './config.mjs'
import {
  browserVersionInfo,
  captureShot,
  ensureFreshDir,
  launchBrowser,
  logCaptureSummary,
} from './capture.mjs'
import { compareShotSlices, compareTextPayloads } from './diff.mjs'
import { evaluateAllowlist, loadAllowlist } from './allowlist.mjs'
import { guestShareToken, loadFixtures } from './mocks/fixtures.mjs'
import { loadMediaStub } from './mocks/index.mjs'
import {
  DEFAULT_OUT_DIR,
  HarnessError,
  ROOT,
  formatRatio,
  log,
  nowIso,
  writeJsonFile,
} from './util.mjs'
import { renderReport } from './report.mjs'

export const SCHEMA_VERSION = 1

function normalizeOptions(rawOptions = {}) {
  return {
    legacyUrl: rawOptions.legacyUrl,
    rebuildUrl: rawOptions.rebuildUrl,
    routes: rawOptions.routes ?? 'priority',
    matrix: rawOptions.matrix ?? 'all',
    themes: rawOptions.themes ?? null,
    outDir: path.resolve(rawOptions.outDir ?? DEFAULT_OUT_DIR),
    maxDiffRatio: rawOptions.maxDiffRatio ?? DEFAULT_TOLERANCE.maxDiffRatio,
    pixelThreshold: rawOptions.pixelThreshold ?? DEFAULT_TOLERANCE.pixelThreshold,
    edgeTolerance: rawOptions.edgeTolerance ?? DEFAULT_TOLERANCE.edgeTolerance,
    wave: rawOptions.wave ?? 1,
    allowlistPath: path.resolve(
      rawOptions.allowlistPath ?? path.join(ROOT, 'contracts', 'parity-allowlist.json')
    ),
    json: Boolean(rawOptions.json ?? false),
    headless: rawOptions.headless !== false,
    report: rawOptions.report !== false,
    injectCss: rawOptions.injectCss ?? {},
    masks: rawOptions.masks ?? {},
  }
}

async function prepareOutput(outDir) {
  const shotsRoot = path.join(outDir, 'shots')
  const textRoot = path.join(outDir, 'text')
  await ensureFreshDir(shotsRoot)
  await ensureFreshDir(textRoot)
  const dirs = {
    legacyShots: path.join(shotsRoot, 'legacy'),
    rebuildShots: path.join(shotsRoot, 'rebuild'),
    diffShots: path.join(shotsRoot, 'diff'),
    legacyText: path.join(textRoot, 'legacy'),
    rebuildText: path.join(textRoot, 'rebuild'),
    diffText: path.join(textRoot, 'diff'),
  }
  for (const dir of Object.values(dirs)) await fs.mkdir(dir, { recursive: true })
  return dirs
}

function relativePath(outDir, file) {
  return path.relative(outDir, file).split(path.sep).join('/')
}

function summarizeCapture(capture) {
  return {
    ok: capture.ok,
    endpoint: capture.meta.endpoint,
    httpStatus: capture.meta.httpStatus,
    pageHeightPx: capture.meta.pageHeightPx,
    sliceCount: capture.meta.sliceCount ?? (capture.meta.sliceOffsets?.length || 0),
    durationMs: capture.meta.durationMs,
    themeApplied: capture.meta.themeApplied ?? null,
    imagesSettled: capture.meta.imagesSettled ?? null,
    warnings: capture.meta.warnings ?? [],
    consoleErrors: capture.meta.consoleErrors ?? [],
    pageErrors: capture.meta.pageErrors ?? [],
    error: capture.error ?? null,
    files: (capture.shotFiles ?? []).map(file => file),
  }
}

/**
 * Build one shot result: pixels + text + allowlist + status.
 * Assumes both captures produced identifiable artifacts (or records errors).
 */
async function buildShotResult({
  entry,
  legacy,
  rebuild,
  outDir,
  dirs,
  options,
  allowlist,
  masks,
}) {
  const { route, viewport, theme, key, urlPath } = entry
  const result = {
    key,
    route: route.id,
    routePath: route.path,
    urlPath,
    parity: route.parity,
    viewport: viewport.name,
    viewportPixels: { width: viewport.width, height: viewport.height },
    theme,
    status: 'pass',
    failureReasons: [],
    allowlist: null,
    masks,
    legacy: summarizeCapture(legacy),
    rebuild: summarizeCapture(rebuild),
    pixelDiff: null,
    textDiff: null,
    files: {
      legacy: (legacy.shotFiles ?? []).map(file => relativePath(outDir, file)),
      rebuild: (rebuild.shotFiles ?? []).map(file => relativePath(outDir, file)),
      diff: [],
      text: {
        legacy: legacy.textFile ? relativePath(outDir, legacy.textFile) : null,
        rebuild: rebuild.textFile ? relativePath(outDir, rebuild.textFile) : null,
        diff: null,
      },
    },
    warnings: [...(legacy.meta.warnings ?? []), ...(rebuild.meta.warnings ?? [])],
  }

  if (!legacy.ok || !rebuild.ok) {
    result.status = 'error'
    result.failureReasons.push(
      ...(legacy.ok ? [] : [`legacy capture-error: ${legacy.error?.message ?? 'unknown'}`]),
      ...(rebuild.ok ? [] : [`rebuild capture-error: ${rebuild.error?.message ?? 'unknown'}`])
    )
    return result
  }

  // HTTP status is part of the route contract: 200 vs 404 is a parity failure.
  if (legacy.meta.httpStatus !== rebuild.meta.httpStatus) {
    result.failureReasons.push(
      `http-status legacy=${legacy.meta.httpStatus} rebuild=${rebuild.meta.httpStatus}`
    )
  }

  // --- pixels -----------------------------------------------------------
  let pixelDiff
  try {
    pixelDiff = await compareShotSlices({
      legacyFiles: legacy.shotFiles ?? [],
      rebuildFiles: rebuild.shotFiles ?? [],
      diffDir: dirs.diffShots,
      key,
      pixelThreshold: options.pixelThreshold,
      edgeTolerance: options.edgeTolerance,
    })
  } catch (error) {
    result.status = 'error'
    result.failureReasons.push(`diff-error: ${error.message}`)
    return result
  }
  const sliceResults = pixelDiff.sliceResults.map(slice => ({
    ...slice,
    diffFile: slice.diffFile ? relativePath(outDir, slice.diffFile) : null,
  }))
  result.pixelDiff = {
    changedPixels: pixelDiff.changedPixels,
    totalPixels: pixelDiff.totalPixels,
    ratio: pixelDiff.ratio,
    maxChannelDelta: pixelDiff.maxChannelDelta,
    edgeTolerance: pixelDiff.edgeTolerance ?? options.edgeTolerance,
    boundingBox: pixelDiff.boundingBox,
    sizeMismatch: pixelDiff.sizeMismatch,
    sliceCountMismatch: pixelDiff.sliceCountMismatch,
    slices: sliceResults,
  }
  result.files.diff = sliceResults.filter(slice => slice.diffFile).map(slice => slice.diffFile)

  // --- text / DOM -------------------------------------------------------
  const textDiff = compareTextPayloads(legacy.text, rebuild.text)
  result.textDiff = {
    status: textDiff.status,
    differences: (textDiff.differences ?? []).slice(0, 10).map(difference => ({
      field: difference.field,
      legacySummary: summarizeTextValue(difference.legacy),
      rebuildSummary: summarizeTextValue(difference.rebuild),
    })),
    bodyText: textDiff.bodyText ?? null,
  }
  if (textDiff.status === 'fail') {
    result.failureReasons.push('text')
    const diffFile = path.join(dirs.diffText, `${key}.json`)
    await writeJsonFile(diffFile, {
      key,
      route: route.id,
      viewport: viewport.name,
      theme,
      generatedAt: nowIso(),
      differences: textDiff.differences,
      bodyText: textDiff.bodyText ?? null,
    })
    result.files.text.diff = relativePath(outDir, diffFile)
  }

  const pixelExceeded =
    pixelDiff.ratio > options.maxDiffRatio || pixelDiff.sizeMismatch || pixelDiff.sliceCountMismatch

  result.allowlist = evaluateAllowlist({
    allowlist,
    route,
    viewport: viewport.name,
    theme,
    ratio: pixelDiff.ratio,
    wave: options.wave,
  })

  if (pixelDiff.sizeMismatch) result.failureReasons.push('layout-size-mismatch')
  if (pixelDiff.sliceCountMismatch) result.failureReasons.push('slice-count-mismatch')

  // A reviewed allowlist entry documents a KNOWN residual difference even when
  // it sits below --max-diff-ratio: the shot is reported as "allowed", not
  // silently passed, so evidence always shows the documented exception.
  const documentedDifference = pixelDiff.changedPixels > 0 && result.allowlist.accepted

  if (result.failureReasons.length > 0) {
    result.status = 'fail'
  } else if (documentedDifference && !pixelDiff.sizeMismatch && !pixelDiff.sliceCountMismatch) {
    result.status = 'allowed'
  } else if (pixelExceeded) {
    if (result.allowlist.status === 'expired') {
      result.failureReasons.push('pixel (allowlist entry expired)')
    } else if (result.allowlist.status === 'over-entry-limit') {
      result.failureReasons.push('pixel (over allowlist maxDiffPixelRatio)')
    } else {
      result.failureReasons.push('pixel')
    }
    result.status = 'fail'
  } else {
    result.status = 'pass'
  }
  return result
}

function summarizeTextValue(value) {
  if (Array.isArray(value)) {
    return { kind: 'lines', count: value.length, sample: value.slice(0, 6) }
  }
  return { kind: typeof value, value: value ?? null }
}

/** Run a full compare. Returns { summary, exitCode } (never throws for diffs). */
export async function runCompare(rawOptions) {
  const options = normalizeOptions(rawOptions)
  if (!options.legacyUrl || !options.rebuildUrl) {
    throw new HarnessError('legacyUrl and rebuildUrl are required')
  }
  const startedAt = nowIso()
  const startedMs = Date.now()

  const ui = await loadUiContract()
  const routesContract = await loadRoutesContract()
  const selection = resolveSelection({ ui, routesContract, options })
  announceWarnings([...ui.warnings, ...routesContract.warnings, ...selection.warnings])

  const [legacyProbe, rebuildProbe] = await Promise.all([
    probeUrl(options.legacyUrl),
    probeUrl(options.rebuildUrl),
  ])

  const fixtureSet = await loadFixtures({ warn: message => log.warn(message) })
  const mediaStub = await loadMediaStub()
  const allowlist = await loadAllowlist(options.allowlistPath)
  announceWarnings(allowlist.warnings)

  const dirs = await prepareOutput(options.outDir)
  let guestToken = null
  try {
    guestToken = guestShareToken(fixtureSet.data)
  } catch {
    guestToken = null
  }

  const browser = await launchBrowser({ headless: options.headless })
  const versions = await browserVersionInfo(browser)
  let sharpVersion = 'unknown'
  try {
    const sharp = (await import('sharp')).default
    sharpVersion = sharp.versions?.sharp ?? 'unknown'
  } catch {
    /* informational */
  }

  const results = []
  try {
    for (const entry of selection.plan) {
      const routePath = resolveRoutePath(entry.route, { guestToken })
      const masks = maskSelectorsFor(entry.route.id, options.masks)
      log.step(`capture ${entry.key} (legacy)`)
      const legacy = await captureShot(browser, {
        baseUrl: options.legacyUrl,
        side: 'legacy',
        route: entry.route,
        routePath,
        viewport: entry.viewport,
        theme: entry.theme,
        ui,
        fixtures: fixtureSet.data,
        mediaStub,
        shotsDir: dirs.legacyShots,
        textDir: dirs.legacyText,
        masks,
        injectCss: options.injectCss.legacy ?? '',
      })
      logCaptureSummary(legacy)
      log.step(`capture ${entry.key} (rebuild)`)
      const rebuild = await captureShot(browser, {
        baseUrl: options.rebuildUrl,
        side: 'rebuild',
        route: entry.route,
        routePath,
        viewport: entry.viewport,
        theme: entry.theme,
        ui,
        fixtures: fixtureSet.data,
        mediaStub,
        shotsDir: dirs.rebuildShots,
        textDir: dirs.rebuildText,
        masks,
        injectCss: options.injectCss.rebuild ?? '',
      })
      logCaptureSummary(rebuild)

      const result = await buildShotResult({
        entry: { ...entry, urlPath: routePath },
        legacy,
        rebuild,
        outDir: options.outDir,
        dirs,
        options,
        allowlist,
        masks,
      })
      results.push(result)
      log.step(
        `${entry.key}: ${result.status.toUpperCase()}${
          result.pixelDiff ? ` ratio=${formatRatio(result.pixelDiff.ratio)}` : ''
        }${result.failureReasons.length > 0 ? ` [${result.failureReasons.join('; ')}]` : ''}`
      )
    }
  } finally {
    await browser.close().catch(() => {})
  }

  const totals = {
    shots: results.length,
    passed: results.filter(result => result.status === 'pass').length,
    allowed: results.filter(result => result.status === 'allowed').length,
    failed: results.filter(result => result.status === 'fail').length,
    errors: results.filter(result => result.status === 'error').length,
    textDiffs: results.filter(result => result.textDiff?.status === 'fail').length,
    changedPixels: results.reduce((sum, result) => sum + (result.pixelDiff?.changedPixels ?? 0), 0),
    totalPixels: results.reduce((sum, result) => sum + (result.pixelDiff?.totalPixels ?? 0), 0),
  }
  totals.changedPixelRatio =
    totals.totalPixels === 0 ? 0 : totals.changedPixels / totals.totalPixels
  totals.failedShots = results
    .filter(result => result.status === 'fail' || result.status === 'error')
    .map(result => ({ key: result.key, status: result.status, reasons: result.failureReasons }))

  const exitCode = totals.errors > 0 ? 2 : totals.failed > 0 ? 1 : 0
  const verdict = {
    status: exitCode === 0 ? 'passed' : exitCode === 1 ? 'failed' : 'error',
    exitCode,
    reasons:
      exitCode === 2
        ? ['one or more captures failed at the harness level — results are incomplete']
        : exitCode === 1
          ? ['unexplained pixel/text parity differences (see failedShots)']
          : [],
  }

  const summary = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'parity-compare',
    generatedAt: startedAt,
    durationMs: Date.now() - startedMs,
    oracle: {
      legacyUrl: options.legacyUrl,
      rebuildUrl: options.rebuildUrl,
      sameInstance: options.legacyUrl === options.rebuildUrl,
      legacyProbe: { status: legacyProbe.status, url: legacyProbe.url },
      rebuildProbe: { status: rebuildProbe.status, url: rebuildProbe.url },
    },
    toolchain: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      ...versions,
      sharp: sharpVersion,
    },
    contracts: {
      ui: { source: ui.source, file: ui.file, fixedNow: ui.fixedNow },
      routes: {
        source: routesContract.source,
        file: routesContract.file,
        count: routesContract.routes.length,
        capturePathOverrides: capturePathOverrides(selection.routes),
      },
    },
    selection: {
      routes: selection.routes.map(route => ({
        id: route.id,
        path: route.path,
        parity: route.parity,
        matrix: route.matrix,
        themes: route.themes,
      })),
      viewports: selection.viewports,
      themes: selection.themes,
      plannedShots: selection.plan.map(entry => entry.key),
    },
    tolerance: {
      maxDiffRatio: options.maxDiffRatio,
      pixelThreshold: options.pixelThreshold,
      edgeTolerance: options.edgeTolerance,
      edgeToleranceSemantics:
        options.edgeTolerance > 0
          ? 'changed pixel accepted when the other image matches within +/-N px under the same colour threshold; opt-in edge-raster phase tolerance'
          : 'exact per-pixel comparison (default)',
      sizeMismatchAlwaysFails: true,
      textParityRequired: true,
    },
    determinism: {
      clock: {
        source: 'contracts/ui.json fixedNow',
        fixedNow: ui.fixedNow,
        strategy:
          'install fake-timer clock at fixedNow, pause before the capture navigation, advance only fixed runFor() budgets',
      },
      timezoneId: CAPTURE.timezoneId,
      locale: CAPTURE.locale,
      reducedMotion: CAPTURE.reducedMotion,
      colorScheme: 'per-theme',
      serviceWorkers: 'block',
      deviceScaleFactor: ui.deviceScaleFactor,
      scrollStepPx: CAPTURE.scrollStepPx,
      maxPageHeightPx: CAPTURE.maxPageHeightPx,
      fixtures: { source: fixtureSet.source, sources: fixtureSet.sources },
      mediaStub: {
        path: mediaStub.file,
        sha256: mediaStub.sha256,
        hosts: ['media.wedding.theporadas.com'],
      },
      masks: Object.fromEntries(
        selection.routes
          .map(route => [route.id, maskSelectorsFor(route.id, options.masks)])
          .filter(([, selectors]) => selectors.length > 0)
      ),
    },
    allowlist: {
      file: allowlist.file ?? options.allowlistPath,
      entries: allowlist.entries.length,
      wave: options.wave,
    },
    shots: results,
    totals,
    verdict,
  }

  const summaryPath = path.join(options.outDir, 'summary.json')
  await writeJsonFile(summaryPath, summary)
  let reportPath = null
  if (options.report) {
    reportPath = path.join(options.outDir, 'report.html')
    await renderReport({ summary, outDir: options.outDir })
  }

  log.out('')
  log.out(
    `Parity ${verdict.status.toUpperCase()}: ${totals.shots} shots — ` +
      `${totals.passed} pass, ${totals.allowed} allowed, ${totals.failed} fail, ${totals.errors} error`
  )
  for (const failed of totals.failedShots) {
    log.out(`  ${failed.status.toUpperCase()} ${failed.key}: ${failed.reasons.join('; ')}`)
  }
  log.out(
    `Changed pixels: ${totals.changedPixels}/${totals.totalPixels} (${formatRatio(totals.changedPixelRatio)})`
  )
  if (reportPath) log.out(`Report:  ${reportPath}`)
  log.out(`Summary: ${summaryPath}`)

  return { summary, exitCode, summaryPath, reportPath }
}

export async function main(argv) {
  let parsed
  try {
    parsed = parseCompareArgs(argv)
  } catch (error) {
    log.error(error.message)
    return 2
  }
  if (parsed.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  const options = parsed.options
  log.setJsonMode(options.json)
  try {
    const { summary, exitCode } = await runCompare(options)
    if (options.json) log.printJson(summary)
    return exitCode
  } catch (error) {
    if (error instanceof HarnessError) {
      log.error(error.message)
      if (options.json)
        log.printJson({
          schemaVersion: SCHEMA_VERSION,
          kind: 'parity-compare',
          error: error.message,
        })
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
