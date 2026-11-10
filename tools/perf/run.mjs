#!/usr/bin/env node
/**
 * Runtime performance measurement for the greenfield app (LCP/CLS/transfer/TBT-proxy).
 *
 * Measures a running static build (default: `http://127.0.0.1:4175`, the preview
 * server the Lead owns) with Playwright Chromium under a documented mid-tier
 * mobile profile: slow 4G network emulation + 4x CPU throttling. QUALITY_BAR
 * budgets enforced by `--check`:
 *
 *   LCP <= 2.0 s ; CLS <= 0.05   (on the mobile profile; desktop is held to the
 *   same bar, which is stricter, and is reported separately)
 *
 * Method (also in README.md):
 *   - fresh browser context per run (no warm cache);
 *   - 1 warm-up run per route x viewport, discarded; then 3 measured runs, median;
 *   - deterministic network mocks (Supabase -> empty JSON, images -> 1x1 PNG stub,
 *     video/audio aborted, third-party hosts never leave the machine) unless
 *     `--no-mocks` is passed;
 *   - LCP = last `largest-contentful-paint` entry; CLS = sum of layout-shift
 *     entries without recent input (simple cumulative, not session windows);
 *   - TTFB/DCL/load from the navigation timing entry; transfer bytes from
 *     `transferSize` grouped by resource type; long tasks from PerformanceObserver.
 *
 * Usage:
 *   node tools/perf/run.mjs                              # table
 *   node tools/perf/run.mjs --check                      # CI gate (exit 1 on violation)
 *   node tools/perf/run.mjs --url http://127.0.0.1:4174 --label legacy
 *   node tools/perf/run.mjs --routes /,/gallery --viewports mobile --runs 1
 *
 * Exit codes: 0 within budget (or no --check), 1 budget violation, 2 harness error.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { classifyResource, createMockHandler } from './lib/mocks.mjs'
import { loadPlaywright } from './lib/playwright.mjs'
import { startStaticServer } from './lib/server.mjs'
import {
  HarnessError,
  KiB,
  defaultOutDir,
  formatKiB,
  formatMs,
  isMainModule,
  log,
  markdownTable,
  median,
  repoRoot,
  toPosix,
} from './lib/util.mjs'

export const SCHEMA_VERSION = 1

/** QUALITY_BAR runtime budgets. */
export const RUNTIME_BUDGETS = {
  lcpMs: 2000,
  cls: 0.05,
}

/**
 * Mid-tier mobile profile approximation, matching the classic Lighthouse
 * "Slow 4G" preset the rebuild is budgeted against:
 *   1.6 Mbps down / 750 kbps up / 150 ms RTT + 4x CPU slowdown.
 */
export const NETWORK_PROFILE = {
  name: 'slow-4g',
  latencyMs: 150,
  downloadThroughputBytesPerSecond: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughputBytesPerSecond: Math.round((750 * 1024) / 8),
  connectionType: 'cellular4g',
}
export const CPU_THROTTLE_RATE = 4

/**
 * A run is only a measurement if the app actually booted: module MIME/chunk
 * failures, missing LCP or non-2xx HTML mean the numbers describe a broken page
 * (this happens when a build is regenerated under a running measurement). Such
 * runs are reported as invalid and never silently averaged into a PASS.
 */
const FATAL_BOOT_PATTERN =
  /Failed to load module script|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed|Expected a JavaScript-or-Wasm module script|Importing a module script failed/i

export const VIEWPORT_PRESETS = {
  mobile: { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  desktop: { id: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
}

const DEFAULT_ROUTES = ['/', '/gallery', '/film']
const DEFAULT_VIEWPORTS = ['mobile', 'desktop']
const DEFAULT_RUNS = 3
const DEFAULT_WARMUP = 1
const DEFAULT_TIMEOUT_MS = 90_000
const SETTLE_TIMEOUT_MS = 8_000
const SETTLE_QUIET_MS = 500

/* -------------------------------------------------------------------------- */
/* In-page instrumentation (serialised by Playwright; browser globals only)   */
/* -------------------------------------------------------------------------- */

function perfInitScript() {
  const state = {
    lcpMs: 0,
    lcpElement: null,
    lcpSize: 0,
    cls: 0,
    shiftCount: 0,
    shiftSources: [],
    longTasks: 0,
    longTaskMs: 0,
  }
  window.__PERF_STATE__ = state

  function describeElement(element) {
    if (!element || typeof element.tagName !== 'string') return null
    const id = element.id ? `#${element.id}` : ''
    const className = typeof element.className === 'string' ? element.className.trim() : ''
    const classes = className ? `.${className.split(/\s+/).slice(0, 2).join('.')}` : ''
    return `${element.tagName.toLowerCase()}${id}${classes}`
  }

  function describeNode(node) {
    if (!node) return null
    const element = node.nodeType === 1 ? node : node.parentElement
    return element && element.tagName ? describeElement(element) : null
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.startTime >= state.lcpMs) {
          state.lcpMs = entry.startTime
          state.lcpSize = entry.size
          state.lcpElement = describeElement(entry.element)
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    /* LCP unsupported */
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue
        state.cls += entry.value
        state.shiftCount += 1
        // Keep the largest few shifts for diagnosis (which element moved how far).
        if (state.shiftSources.length < 8) {
          state.shiftSources.push({
            value: entry.value,
            startedAtMs: entry.startTime,
            sources: (entry.sources ?? []).map(source => ({
              node: describeNode(source.node),
              previousRect: source.previousRect
                ? {
                    x: source.previousRect.x,
                    y: source.previousRect.y,
                    w: source.previousRect.width,
                    h: source.previousRect.height,
                  }
                : null,
              currentRect: source.currentRect
                ? {
                    x: source.currentRect.x,
                    y: source.currentRect.y,
                    w: source.currentRect.width,
                    h: source.currentRect.height,
                  }
                : null,
            })),
          })
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* CLS unsupported */
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        state.longTasks += 1
        state.longTaskMs += entry.duration
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* long tasks unsupported */
  }
}

function perfCollectScript() {
  const state = window.__PERF_STATE__ ?? {}
  const navigationEntry = performance.getEntriesByType('navigation')[0]
  const paints = performance.getEntriesByType('paint')
  const fcpEntry = paints.find(entry => entry.name === 'first-contentful-paint')
  const resources = performance.getEntriesByType('resource').map(entry => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    transferSize: entry.transferSize ?? 0,
    encodedBodySize: entry.encodedBodySize ?? 0,
    duration: entry.duration,
  }))

  return {
    state,
    navigation: navigationEntry
      ? {
          ttfbMs: navigationEntry.responseStart,
          dclMs: navigationEntry.domContentLoadedEventEnd,
          loadMs: navigationEntry.loadEventEnd,
          transferSize: navigationEntry.transferSize ?? 0,
          durationMs: navigationEntry.duration,
        }
      : null,
    fcpMs: fcpEntry ? fcpEntry.startTime : null,
    resources,
    url: window.location.href,
    title: document.title,
  }
}

/* -------------------------------------------------------------------------- */
/* Measurement                                                                */
/* -------------------------------------------------------------------------- */

function sumBy(resources, classify) {
  const totals = { script: 0, css: 0, font: 0, image: 0, media: 0, data: 0, other: 0 }
  for (const resource of resources) {
    let type = classify(resource.name)
    if (
      type === 'other' &&
      (resource.initiatorType === 'fetch' || resource.initiatorType === 'xmlhttprequest')
    ) {
      type = 'data'
    }
    totals[type] = (totals[type] ?? 0) + resource.transferSize
  }
  return totals
}

function toRunRecord(raw, { mocks, httpStatus, consoleErrors, requestFailures }) {
  const resources = raw.resources.filter(resource => /^https?:/i.test(resource.name))
  const byType = sumBy(resources, classifyResource)
  const navigation = raw.navigation ?? {}
  const state = raw.state ?? {}
  const totalTransferBytes =
    resources.reduce((total, resource) => total + resource.transferSize, 0) +
    (navigation.transferSize ?? 0)

  return {
    lcpMs: typeof state.lcpMs === 'number' ? state.lcpMs : null,
    lcpElement: state.lcpElement ?? null,
    lcpSize: state.lcpSize ?? 0,
    cls: typeof state.cls === 'number' ? state.cls : null,
    shiftCount: state.shiftCount ?? 0,
    clsShiftSources: state.shiftSources ?? [],
    fcpMs: raw.fcpMs ?? null,
    ttfbMs: navigation.ttfbMs ?? null,
    dclMs: navigation.dclMs ?? null,
    loadMs: navigation.loadMs ?? null,
    longTasks: state.longTasks ?? 0,
    longTaskMs: state.longTaskMs ?? 0,
    transferBytes: { ...byType, total: totalTransferBytes },
    requestCount: resources.length,
    httpStatus,
    consoleErrors,
    requestFailures,
    mocks: mocks ? { ...mocks } : null,
    finalUrl: raw.url,
  }
}

async function measureOnce({ browser, baseUrl, routePath, viewport, options }) {
  const mockStats = { realAssets: 0, supabase: 0, images: 0, blocked: 0 }
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    reducedMotion: 'no-preference',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })
  const consoleErrors = []
  const requestFailures = []
  let httpStatus = null
  let page = null

  try {
    page = await context.newPage()
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300))
    })
    page.on('pageerror', error =>
      consoleErrors.push(`pageerror: ${String(error.message).slice(0, 300)}`)
    )
    page.on('requestfailed', request => {
      requestFailures.push(
        `${request.failure()?.errorText ?? 'failed'} ${request.url().slice(0, 200)}`
      )
    })

    if (options.mocks) await context.route('**/*', createMockHandler({ stats: mockStats }))

    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: NETWORK_PROFILE.latencyMs,
      downloadThroughput: NETWORK_PROFILE.downloadThroughputBytesPerSecond,
      uploadThroughput: NETWORK_PROFILE.uploadThroughputBytesPerSecond,
      connectionType: NETWORK_PROFILE.connectionType,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE })
    await page.addInitScript(perfInitScript)

    const targetUrl = new URL(routePath, baseUrl).toString()
    const response = await page.goto(targetUrl, {
      waitUntil: 'load',
      timeout: options.timeoutMs,
    })
    httpStatus = response ? response.status() : null

    // Settle: network quiet (capped), fonts ready, two frames, then a short quiet
    // window so late LCP/CLS entries are observed.
    await page
      .waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS })
      .catch(() => undefined)
    await page
      .evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      .catch(() => undefined)
    await sleep(SETTLE_QUIET_MS)

    const raw = await page.evaluate(perfCollectScript)
    const record = toRunRecord(raw, {
      mocks: options.mocks ? mockStats : null,
      httpStatus,
      consoleErrors,
      requestFailures,
    })
    const fatalErrors = record.consoleErrors.filter(message => FATAL_BOOT_PATTERN.test(message))
    const hasLcp = typeof record.lcpMs === 'number' && record.lcpMs > 0
    record.ok = record.httpStatus === 200 && fatalErrors.length === 0 && hasLcp
    record.invalidReason = record.ok
      ? null
      : [
          record.httpStatus !== 200 ? `http status ${record.httpStatus}` : null,
          !hasLcp ? 'no LCP observed (page did not paint)' : null,
          fatalErrors.length > 0 ? `boot error: ${fatalErrors[0]}` : null,
        ]
          .filter(Boolean)
          .join('; ')
    return record
  } finally {
    await context.close().catch(() => undefined)
  }
}

const MEDIAN_KEYS = [
  'lcpMs',
  'cls',
  'fcpMs',
  'ttfbMs',
  'dclMs',
  'loadMs',
  'longTasks',
  'longTaskMs',
  'requestCount',
]

function medianRun(runs) {
  const result = {}
  for (const key of MEDIAN_KEYS) {
    result[key] = median(runs.map(run => run[key]))
  }
  const transferKeys = ['script', 'css', 'font', 'image', 'media', 'data', 'other', 'total']
  result.transferBytes = Object.fromEntries(
    transferKeys.map(key => [key, median(runs.map(run => run.transferBytes[key] ?? 0))])
  )
  result.lcpElement = runs[0]?.lcpElement ?? null
  result.clsSources = runs[0]?.clsShiftSources ?? []
  result.httpStatus = runs[0]?.httpStatus ?? null
  result.consoleErrors = runs.reduce((total, run) => total + run.consoleErrors.length, 0)
  result.requestFailures = runs.reduce((total, run) => total + run.requestFailures.length, 0)
  return result
}

function budgetVerdict(run) {
  const violations = []
  if (run.lcpMs !== null && run.lcpMs > RUNTIME_BUDGETS.lcpMs) {
    violations.push(`lcp ${formatMs(run.lcpMs)} > ${RUNTIME_BUDGETS.lcpMs} ms`)
  }
  if (run.cls !== null && run.cls > RUNTIME_BUDGETS.cls) {
    violations.push(`cls ${run.cls.toFixed(4)} > ${RUNTIME_BUDGETS.cls}`)
  }
  return { ok: violations.length === 0, violations }
}

async function measureCell({ browser, baseUrl, routePath, viewport, options }) {
  const cell = {
    route: routePath,
    viewport: viewport.id,
    viewportPixels: { width: viewport.width, height: viewport.height },
    runs: [],
    warmupRuns: [],
    median: null,
    budget: null,
  }

  for (let index = 0; index < options.warmup; index += 1) {
    process.stdout.write(
      `[perf] ${routePath} ${viewport.id} warm-up ${index + 1}/${options.warmup} ... `
    )
    const run = await measureOnce({ browser, baseUrl, routePath, viewport, options })
    cell.warmupRuns.push(run)
    process.stdout.write(`${formatMs(run.loadMs)} load\n`)
  }

  for (let index = 0; index < options.runs; index += 1) {
    process.stdout.write(`[perf] ${routePath} ${viewport.id} run ${index + 1}/${options.runs} ... `)
    const run = await measureOnce({ browser, baseUrl, routePath, viewport, options })
    cell.runs.push(run)
    process.stdout.write(
      run.ok
        ? `lcp=${formatMs(run.lcpMs)} cls=${(run.cls ?? 0).toFixed(4)}\n`
        : `INVALID (${run.invalidReason})\n`
    )
  }

  const validRuns = cell.runs.filter(run => run.ok)
  cell.validRuns = validRuns.length
  cell.invalidRuns = cell.runs
    .filter(run => !run.ok)
    .map(run => ({ invalidReason: run.invalidReason, httpStatus: run.httpStatus }))

  if (validRuns.length === 0) {
    cell.median = {
      ...Object.fromEntries(MEDIAN_KEYS.map(key => [key, null])),
      transferBytes: {
        script: 0,
        css: 0,
        font: 0,
        image: 0,
        media: 0,
        data: 0,
        other: 0,
        total: 0,
      },
      lcpElement: null,
      clsSources: [],
      httpStatus: cell.runs[0]?.httpStatus ?? null,
      consoleErrors: cell.runs.reduce((total, run) => total + run.consoleErrors.length, 0),
      requestFailures: cell.runs.reduce((total, run) => total + run.requestFailures.length, 0),
    }
    cell.budget = {
      ok: false,
      violations: [
        `no valid run (${
          cell.invalidRuns
            .map(run => run.invalidReason)
            .filter(Boolean)
            .join('; ') || 'unknown'
        })`,
      ],
    }
  } else {
    cell.median = medianRun(validRuns)
    cell.budget = budgetVerdict(cell.median)
  }
  return cell
}

function formatSigned(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a'
  const { unit = '', digits = 0 } = options
  const rounded = Number(value.toFixed(digits))
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}${unit}`
}

/**
 * Load a previous `run.mjs` JSON report and compute per-cell before/after deltas.
 * Used to prove a fix (e.g. the footer-push CLS defect) with the harness itself.
 */
async function compareWithBaseline(baselinePath, report) {
  let baseline
  try {
    baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
  } catch (error) {
    throw new HarnessError(
      `--baseline could not be read/parsed (${baselinePath}): ${error.message}`
    )
  }
  if (!Array.isArray(baseline.cells)) {
    throw new HarnessError(
      `--baseline has no cells[] (${baselinePath}); pass a run.mjs JSON report`
    )
  }

  const keyOf = (route, viewport) => `${route}|${viewport}`
  const previousCells = new Map(
    baseline.cells.map(cell => [keyOf(cell.route, cell.viewport), cell])
  )
  const pick = median => ({
    lcpMs: median?.lcpMs ?? null,
    cls: median?.cls ?? null,
    ttfbMs: median?.ttfbMs ?? null,
    transferBytes: median?.transferBytes?.total ?? null,
    longTasks: median?.longTasks ?? null,
  })

  const cells = report.cells.map(cell => {
    const previous = previousCells.get(keyOf(cell.route, cell.viewport))
    const before = previous ? pick(previous.median) : null
    const after = pick(cell.median)
    const delta = before
      ? {
          lcpMs: after.lcpMs !== null && before.lcpMs !== null ? after.lcpMs - before.lcpMs : null,
          cls: after.cls !== null && before.cls !== null ? after.cls - before.cls : null,
          ttfbMs:
            after.ttfbMs !== null && before.ttfbMs !== null ? after.ttfbMs - before.ttfbMs : null,
          transferBytes:
            after.transferBytes !== null && before.transferBytes !== null
              ? after.transferBytes - before.transferBytes
              : null,
          longTasks:
            after.longTasks !== null && before.longTasks !== null
              ? after.longTasks - before.longTasks
              : null,
        }
      : null
    return { route: cell.route, viewport: cell.viewport, before, after, delta }
  })

  return {
    baselinePath: toPosix(path.relative(repoRoot, baselinePath)),
    label: baseline.label ?? null,
    capturedAt: baseline.generatedAt ?? baseline.capturedAt ?? null,
    cells,
  }
}

function buildMarkdown(report) {
  const budgetRows = report.cells.map(cell => [
    `${cell.route} (${cell.viewport})`,
    formatMs(cell.median.lcpMs),
    (cell.median.cls ?? 0).toFixed(4),
    formatMs(cell.median.ttfbMs),
    formatMs(cell.median.dclMs),
    formatMs(cell.median.loadMs),
    formatKiB(cell.median.transferBytes.total),
    `${cell.median.requestCount} (${cell.median.longTasks} long / ${formatMs(cell.median.longTaskMs)})`,
    `${cell.validRuns ?? report.runs}/${report.runs} valid`,
    cell.budget.ok ? 'PASS' : 'FAIL',
  ])

  const transferRows = report.cells.map(cell => [
    `${cell.route} (${cell.viewport})`,
    formatKiB(cell.median.transferBytes.script),
    formatKiB(cell.median.transferBytes.css),
    formatKiB(cell.median.transferBytes.font),
    formatKiB(cell.median.transferBytes.image),
    formatKiB(cell.median.transferBytes.data),
    formatKiB(cell.median.transferBytes.total),
  ])

  const lines = [
    `## Runtime budgets — \`${report.target.url}\``,
    `Target: ${report.target.mode}${
      report.target.dist ? ` (\`${report.target.dist}\`)` : ''
    }; response compression: ${report.target.compression}; ${report.mockNetwork}`,
    '',
    `Profile: ${report.networkProfile.name} ` +
      `(${((report.networkProfile.downloadThroughputBytesPerSecond * 8) / 1024 / 1024).toFixed(2)} Mbps down, ` +
      `${((report.networkProfile.uploadThroughputBytesPerSecond * 8) / 1024).toFixed(0)} kbps up, ` +
      `${report.networkProfile.latencyMs} ms RTT, CPU x${report.cpuThrottleRate}); ` +
      `${report.warmupRuns} warm-up + ${report.runs} measured runs, median.`,
    '',
    '### Core Web Vitals proxies',
    '',
    markdownTable(
      [
        'Route (viewport)',
        'LCP',
        'CLS',
        'TTFB',
        'DCL',
        'load',
        'Transfer',
        'Requests (long tasks)',
        'Valid runs',
        'Budget',
      ],
      budgetRows,
      ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'left']
    ),
    '',
    '### Transferred bytes by resource type (median)',
    '',
    markdownTable(
      ['Route (viewport)', 'script', 'css', 'font', 'image', 'data', 'total'],
      transferRows,
      ['left', 'right', 'right', 'right', 'right', 'right', 'right']
    ),
    '',
    `- LCP element (first measured run): ${report.cells.map(cell => `${cell.route} ${cell.viewport}=${cell.median.lcpElement ?? 'n/a'}`).join(', ')}`,
    `- Budgets: LCP <= ${RUNTIME_BUDGETS.lcpMs} ms, CLS <= ${RUNTIME_BUDGETS.cls} (QUALITY_BAR).`,
    `- Target consistency: ${report.target.consistency ?? 'n/a (external URL, not fingerprinted)'}; ` +
      `invalid runs: ${report.summary.invalidRuns ?? 0} of ${report.cells.length * report.runs}.`,
  ]

  const invalidCells = report.cells.filter(cell => (cell.invalidRuns?.length ?? 0) > 0)
  if (invalidCells.length > 0) {
    lines.push('', 'Invalid runs (excluded from medians, never counted as PASS):')
    for (const cell of invalidCells) {
      lines.push(
        `- ${cell.route} (${cell.viewport}): ${cell.invalidRuns
          .map(run => run.invalidReason ?? 'unknown')
          .join('; ')}`
      )
    }
  }

  if (report.baselineComparison) {
    const baseline = report.baselineComparison
    const baselineRows = baseline.cells.map(cell => [
      `${cell.route} (${cell.viewport})`,
      formatMs(cell.before?.lcpMs ?? null),
      formatMs(cell.after?.lcpMs ?? null),
      formatSigned(cell.delta?.lcpMs ?? null, { unit: ' ms' }),
      (cell.before?.cls ?? 0).toFixed(4),
      (cell.after?.cls ?? 0).toFixed(4),
      formatSigned(cell.delta?.cls ?? null, { digits: 4 }),
      formatSigned((cell.delta?.transferBytes ?? 0) / KiB, { unit: ' KiB', digits: 2 }),
    ])
    lines.push(
      '',
      `### Before vs after — baseline \`${baseline.baselinePath}\``,
      `Baseline label: ${baseline.label ?? 'n/a'}; captured: ${baseline.capturedAt ?? 'n/a'}.` +
        ' Deltas are after - before (negative LCP/CLS is an improvement).',
      '',
      markdownTable(
        [
          'Route (viewport)',
          'LCP before',
          'LCP after',
          'Δ LCP',
          'CLS before',
          'CLS after',
          'Δ CLS',
          'Δ transfer',
        ],
        baselineRows,
        ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right']
      )
    )
  }

  if (report.summary.violations.length > 0) {
    lines.push('', '### ❌ Budget violations', '')
    for (const violation of report.summary.violations) {
      lines.push(`- **${violation.cell}**: ${violation.reasons.join('; ')}`)
    }
    const shifted = report.cells.filter(cell => (cell.median.cls ?? 0) > RUNTIME_BUDGETS.cls)
    if (shifted.length > 0) {
      lines.push('', 'CLS contributors (largest layout shift in the first measured run):')
      for (const cell of shifted) {
        const biggest = [...(cell.median.clsSources ?? [])].sort(
          (left, right) => right.value - left.value
        )[0]
        const source = biggest?.sources?.[0]
        const direction =
          source?.previousRect && source?.currentRect
            ? ` moved from y=${Math.round(source.previousRect.y)} to y=${Math.round(source.currentRect.y)}`
            : ''
        lines.push(
          `- ${cell.route} (${cell.viewport}): ${biggest ? `${biggest.node ?? source?.node ?? 'unknown'} shift=${biggest.value.toFixed(3)}` : 'no source recorded'}${direction}`
        )
      }
    }
  } else {
    lines.push('', '### ✅ All runtime budgets met')
  }
  return lines.join('\n')
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

function parseViewports(value) {
  return value.split(',').map(token => {
    const trimmed = token.trim()
    if (VIEWPORT_PRESETS[trimmed]) return VIEWPORT_PRESETS[trimmed]
    if (trimmed === '390') return VIEWPORT_PRESETS.mobile
    if (trimmed === '1440') return VIEWPORT_PRESETS.desktop
    throw new HarnessError(`unknown viewport "${trimmed}" (use mobile, desktop, 390 or 1440)`)
  })
}

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:4175',
    serveDist: null,
    compression: 'gzip',
    routes: DEFAULT_ROUTES,
    viewports: DEFAULT_VIEWPORTS.map(id => VIEWPORT_PRESETS[id]),
    runs: DEFAULT_RUNS,
    warmup: DEFAULT_WARMUP,
    check: false,
    json: false,
    mocks: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    out: path.join(defaultOutDir, 'latest.json'),
    markdownOut: null,
    baseline: null,
    allowDistDrift: false,
    label: null,
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
      case '--url':
        options.url = readValue(argument).replace(/\/+$/, '')
        break
      case '--serve-dist':
        options.serveDist = path.resolve(readValue(argument))
        break
      case '--compression': {
        const compression = readValue(argument)
        if (!['gzip', 'brotli', 'none'].includes(compression)) {
          throw new HarnessError('--compression must be gzip, brotli or none')
        }
        options.compression = compression
        break
      }
      case '--routes':
        options.routes = readValue(argument)
          .split(',')
          .map(route => route.trim() || '/')
        break
      case '--viewports':
        options.viewports = parseViewports(readValue(argument))
        break
      case '--runs': {
        const runs = Number(readValue(argument))
        if (!Number.isInteger(runs) || runs < 1)
          throw new HarnessError('--runs must be a positive integer')
        options.runs = runs
        break
      }
      case '--warmup': {
        const warmup = Number(readValue(argument))
        if (!Number.isInteger(warmup) || warmup < 0) throw new HarnessError('--warmup must be >= 0')
        options.warmup = warmup
        break
      }
      case '--check':
        options.check = true
        break
      case '--json':
        options.json = true
        break
      case '--no-mocks':
        options.mocks = false
        break
      case '--timeout': {
        const timeoutMs = Number(readValue(argument))
        if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
          throw new HarnessError('--timeout must be milliseconds >= 1000')
        }
        options.timeoutMs = timeoutMs
        break
      }
      case '--out':
        options.out = path.resolve(readValue(argument))
        break
      case '--markdown-out':
        options.markdownOut = path.resolve(readValue(argument))
        break
      case '--baseline':
        options.baseline = path.resolve(readValue(argument))
        break
      case '--allow-dist-drift':
        options.allowDistDrift = true
        break
      case '--label':
        options.label = readValue(argument)
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

function labelFor(options, target) {
  if (options.label) return options.label
  if (target?.mode === 'internal-static') {
    return `${path.basename(path.dirname(options.serveDist))}_${path.basename(options.serveDist)}_${target.compression}`
  }
  try {
    return new URL(target?.url ?? options.url).host.replace(/[^a-z0-9.-]+/gi, '_')
  } catch {
    return 'target'
  }
}

async function probeServer(url) {
  let response
  try {
    response = await fetch(url, { method: 'HEAD' })
  } catch (error) {
    throw new HarnessError(
      `no server reachable at ${url} (${error.message}). Start the preview server first; ` +
        'the Lead owns rebuild/legacy previews. This harness never runs builds.'
    )
  }
  if (!response.ok) throw new HarnessError(`${url} responded ${response.status}, expected 2xx`)
}

/**
 * Fingerprint a build directory (index.html hash + emitted asset count). A build
 * regenerated while measurements run silently mixes two builds into one median;
 * this lets the harness detect that and refuse to report it as a measurement.
 */
async function fingerprintDist(distDir) {
  const indexHtml = await readFile(path.join(distDir, 'index.html'))
  const assetsDir = path.join(distDir, 'assets')
  let assetFiles = 0
  try {
    assetFiles = (await readdir(assetsDir, { withFileTypes: true })).filter(entry =>
      entry.isFile()
    ).length
  } catch {
    assetFiles = 0
  }
  return {
    indexHtmlSha256: createHash('sha256').update(indexHtml).digest('hex'),
    assetFiles,
  }
}

function sameFingerprint(left, right) {
  return left.indexHtmlSha256 === right.indexHtmlSha256 && left.assetFiles === right.assetFiles
}

async function main(argv) {
  let options
  let server = null
  try {
    options = parseArgs(argv)
    if (options.help) {
      process.stdout.write(
        'Usage: node tools/perf/run.mjs [--url <url> | --serve-dist <dir> [--compression gzip|brotli|none]] ' +
          '[--routes /,/gallery,/film] [--viewports mobile,desktop] [--runs 3] [--warmup 1] ' +
          '[--check] [--json] [--no-mocks] [--baseline <file>] [--allow-dist-drift] ' +
          '[--out <file>] [--markdown-out <file>] [--label <name>]\n'
      )
      return 0
    }

    let target
    if (options.serveDist) {
      server = await startStaticServer({ dir: options.serveDist, compression: options.compression })
      target = {
        mode: 'internal-static',
        url: server.url,
        compression: options.compression,
        dist: toPosix(path.relative(repoRoot, options.serveDist)),
        fingerprintBefore: await fingerprintDist(options.serveDist),
      }
    } else {
      target = {
        mode: 'external-url',
        url: options.url,
        compression: 'as-served-by-target',
        dist: null,
      }
    }

    await probeServer(target.url)
    log.step(`Runtime budgets — ${target.url} (${target.mode}, compression: ${target.compression})`)
    log.info(
      `${options.viewports.map(viewport => `${viewport.id} ${viewport.width}x${viewport.height}`).join(', ')}; ` +
        `${options.warmup} warm-up + ${options.runs} measured runs; ` +
        `${options.mocks ? 'parity mocks' : 'live network'}; CPU x${CPU_THROTTLE_RATE}, ${NETWORK_PROFILE.name}`
    )

    const playwright = await loadPlaywright()
    log.info(`Playwright ${playwright.version}`)
    const browser = await playwright.chromium.launch({ headless: true })
    const browserVersion = browser.version()

    const cells = []
    try {
      for (const viewport of options.viewports) {
        for (const route of options.routes) {
          cells.push(
            await measureCell({ browser, baseUrl: target.url, routePath: route, viewport, options })
          )
        }
      }
    } finally {
      await browser.close().catch(() => undefined)
    }

    let distChangedDuringRun = false
    if (options.serveDist && target.fingerprintBefore) {
      target.fingerprintAfter = await fingerprintDist(options.serveDist)
      distChangedDuringRun = !sameFingerprint(target.fingerprintBefore, target.fingerprintAfter)
      target.consistency = distChangedDuringRun ? 'changed-during-run' : 'stable'
      if (distChangedDuringRun) {
        log.warn(
          'rebuild/dist changed while measuring (Lead rebuilt mid-run): results mix two builds and are not a measurement'
        )
      }
    }

    const violations = cells
      .filter(cell => !cell.budget.ok)
      .map(cell => ({
        cell: `${cell.route} (${cell.viewport})`,
        reasons: cell.budget.violations,
      }))

    const report = {
      schemaVersion: SCHEMA_VERSION,
      kind: 'runtime-budget',
      generatedAt: new Date().toISOString(),
      label: labelFor(options, target),
      target,
      url: target.url,
      mockNetwork: options.mocks
        ? 'mocked (supabase empty JSON, image stub, media aborted)'
        : 'live network',
      networkProfile: NETWORK_PROFILE,
      cpuThrottleRate: CPU_THROTTLE_RATE,
      settling: { quietWindowMs: SETTLE_QUIET_MS, networkIdleTimeoutMs: SETTLE_TIMEOUT_MS },
      toolchain: {
        node: process.version,
        playwright: playwright.version,
        chromium: browserVersion,
      },
      budgets: RUNTIME_BUDGETS,
      routes: options.routes,
      viewports: options.viewports.map(viewport => ({
        id: viewport.id,
        width: viewport.width,
        height: viewport.height,
      })),
      warmupRuns: options.warmup,
      runs: options.runs,
      cells,
      summary: {
        violations,
        cells: cells.length,
        failingCells: violations.length,
        invalidRuns: cells.reduce((total, cell) => total + (cell.invalidRuns?.length ?? 0), 0),
        distChangedDuringRun,
      },
    }

    if (options.baseline) {
      report.baselineComparison = await compareWithBaseline(options.baseline, report)
    }

    await mkdir(path.dirname(options.out), { recursive: true })
    await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    const markdown = buildMarkdown(report)
    if (options.markdownOut) {
      await mkdir(path.dirname(options.markdownOut), { recursive: true })
      await writeFile(options.markdownOut, `${markdown}\n`, 'utf8')
    }

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      process.stdout.write(`\n${markdown}\n`)
    }

    log.info(`JSON: ${toPosix(path.relative(repoRoot, options.out))}`)
    if (distChangedDuringRun && !options.allowDistDrift) {
      log.fail(
        'rebuild/dist changed during the run — the median would mix two builds. ' +
          'Re-run on a stable build (or pass --allow-dist-drift to record it anyway).'
      )
      return 2
    }
    if (violations.length > 0) {
      log.fail(`${violations.length} runtime budget violation(s)`)
      return options.check ? 1 : 0
    }
    log.ok('All runtime budgets met')
    return 0
  } catch (error) {
    if (error instanceof HarnessError) log.fail(error.message)
    else log.fail(`unexpected error: ${error.stack ?? error.message}`)
    return 2
  } finally {
    if (server) await server.close().catch(() => undefined)
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2))
}

export { KiB }
