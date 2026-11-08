#!/usr/bin/env node
/**
 * Lighthouse baseline for the public production site.
 *
 * The rebuild has to prove performance never regresses, so the baseline is
 * captured against the live site (https://www.theporadas.com) exactly as a
 * visitor sees it, for the three priority routes and both form factors.
 *
 * Usage:
 *   node tools/baseline/lighthouse.mjs                     # 12 runs: 3 routes x 2 profiles x 2 runs
 *   node tools/baseline/lighthouse.mjs --runs 1            # smoke test (6 runs)
 *   node tools/baseline/lighthouse.mjs --routes /,/gallery # subset
 *   node tools/baseline/lighthouse.mjs --profiles desktop  # one form factor
 *
 * Behaviour:
 *   - one fresh headless Chrome per run (a reused profile would warm caches and
 *     make run 2 non-comparable with run 1);
 *   - a failing run is retried once, then recorded as a failure instead of
 *     silently dropped, so the summary always has `runs` entries per cell;
 *   - every raw LHR JSON is written under contracts/baseline/lighthouse/
 *     (gitignored) and the rolled-up summary to
 *     contracts/baseline/lighthouse-summary.json.
 *
 * Read-only by construction: GET requests to the public site, no logins.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export const DEFAULT_SITE_URL = 'https://www.theporadas.com'
export const DEFAULT_ROUTES = ['/', '/gallery', '/film']
export const DEFAULT_PROFILES = ['mobile', 'desktop']
export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const RUN_TIMEOUT_MS = 150_000
const RETRY_DELAY_MS = 2_000

const CHROME_FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--metrics-recording-only',
]

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function withTimeout(promise, milliseconds, label) {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${milliseconds}ms`)),
      milliseconds
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function pageSlug(route) {
  const cleaned = route.replace(/^\/+|\/+$/g, '')
  if (cleaned === '') return 'home'
  return cleaned.replace(/\//g, '-')
}

function numericValue(lhr, auditId) {
  const audit = lhr.audits ? lhr.audits[auditId] : undefined
  return audit && typeof audit.numericValue === 'number' ? Math.round(audit.numericValue) : null
}

function requestCount(lhr) {
  const items = lhr.audits?.['network-requests']?.details?.items
  return Array.isArray(items) ? items.length : null
}

function scoresOf(lhr) {
  const scores = {}
  for (const category of CATEGORIES) {
    const score = lhr.categories?.[category]?.score
    scores[category] = typeof score === 'number' ? score : null
  }
  return scores
}

function settingsOf(lhr) {
  const settings = lhr.configSettings || {}
  const throttling = settings.throttling || {}
  return {
    formFactor: settings.formFactor || null,
    screenEmulation: settings.screenEmulation
      ? {
          mobile: settings.screenEmulation.mobile,
          width: settings.screenEmulation.width,
          height: settings.screenEmulation.height,
          deviceScaleFactor: settings.screenEmulation.deviceScaleFactor,
        }
      : null,
    throttlingMethod: settings.throttlingMethod || null,
    throttling: {
      rttMs: throttling.rttMs ?? null,
      throughputKbps: throttling.throughputKbps ?? null,
      cpuSlowdownMultiplier: throttling.cpuSlowdownMultiplier ?? null,
      requestLatencyMs: throttling.requestLatencyMs ?? null,
      downloadThroughputKbps: throttling.downloadThroughputKbps ?? null,
      uploadThroughputKbps: throttling.uploadThroughputKbps ?? null,
    },
    userAgent: settings.userAgent || null,
  }
}

export function extractRun(lhr, { page, profile, runIndex }) {
  const scores = scoresOf(lhr)
  return {
    id: `${pageSlug(page)}-${profile}-run${runIndex}`,
    page,
    profile,
    run: runIndex,
    ok: !lhr.runtimeError,
    fetchTime: lhr.fetchTime || null,
    requestedUrl: lhr.requestedUrl || null,
    finalDisplayedUrl: lhr.finalDisplayedUrl || null,
    lighthouseVersion: lhr.lighthouseVersion || null,
    scores,
    metrics: {
      firstContentfulPaintMs: numericValue(lhr, 'first-contentful-paint'),
      largestContentfulPaintMs: numericValue(lhr, 'largest-contentful-paint'),
      totalBlockingTimeMs: numericValue(lhr, 'total-blocking-time'),
      cumulativeLayoutShift: lhr.audits?.['cumulative-layout-shift']?.numericValue ?? null,
      speedIndexMs: numericValue(lhr, 'speed-index'),
      timeToInteractiveMs: numericValue(lhr, 'interactive'),
      totalByteWeight: numericValue(lhr, 'total-byte-weight'),
      requestCount: requestCount(lhr),
    },
    settings: settingsOf(lhr),
    environment: {
      networkUserAgent: lhr.environment?.networkUserAgent || null,
      hostUserAgent: lhr.environment?.hostUserAgent || null,
      benchmarkIndex: lhr.environment?.benchmarkIndex ?? null,
    },
    runWarnings: Array.isArray(lhr.runWarnings) ? lhr.runWarnings : [],
    runtimeError: lhr.runtimeError
      ? { code: lhr.runtimeError.code, message: lhr.runtimeError.message }
      : null,
  }
}

async function runOnce({ url, profile, outDir, page, runIndex }) {
  const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS, logLevel: 'error' })
  try {
    const flags = {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: CATEGORIES,
      maxWaitForLoad: 90_000,
    }
    const runner =
      profile === 'desktop'
        ? await withTimeout(lighthouse(url, flags, desktopConfig), RUN_TIMEOUT_MS, 'lighthouse')
        : await withTimeout(lighthouse(url, flags), RUN_TIMEOUT_MS, 'lighthouse')

    if (!runner || !runner.lhr) throw new Error('lighthouse returned no LHR')

    await mkdir(outDir, { recursive: true })
    const reportPath = path.join(outDir, `${pageSlug(page)}-${profile}-run${runIndex}.json`)
    await writeFile(reportPath, runner.report, 'utf8')
    return { lhr: runner.lhr, reportPath, url }
  } finally {
    try {
      await chrome.kill()
    } catch (killError) {
      process.stderr.write(`[lighthouse] chrome.kill warning: ${killError.message}\n`)
    }
  }
}

/**
 * Run one page/profile cell, retrying once on any launch/run failure.
 * Never throws: the failure is returned so the summary records it.
 */
export async function captureCell({ url, page, profile, runs, outDir }) {
  const records = []
  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    let lastError = null
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        process.stdout.write(
          `[lighthouse] ${pageSlug(page)} ${profile} run ${runIndex}/${runs}` +
            `${attempt > 1 ? ` (retry ${attempt - 1})` : ''} ... `
        )
        const { lhr, reportPath } = await runOnce({
          url,
          profile,
          outDir,
          page,
          runIndex,
        })
        const record = extractRun(lhr, { page, profile, runIndex })
        record.reportPath = path.relative(process.cwd(), reportPath).split(path.sep).join('/')
        record.attempt = attempt
        const perf = record.scores.performance
        process.stdout.write(
          `perf=${perf === null ? 'n/a' : perf.toFixed(2)} lcp=${record.metrics.largestContentfulPaintMs}ms\n`
        )
        records.push(record)
        lastError = null
        break
      } catch (error) {
        lastError = error
        process.stdout.write(`failed (${error.message})\n`)
        if (attempt < 2) await sleep(RETRY_DELAY_MS)
      }
    }

    if (lastError) {
      const failed = {
        id: `${pageSlug(page)}-${profile}-run${runIndex}`,
        page,
        profile,
        run: runIndex,
        ok: false,
        scores: Object.fromEntries(CATEGORIES.map(category => [category, null])),
        metrics: {},
        error: lastError.message,
      }
      records.push(failed)
      process.stdout.write(`[lighthouse] recorded failure for ${failed.id}: ${lastError.message}\n`)
    }
  }
  return records
}

function selectionKey(record) {
  const performance = record.scores.performance ?? -1
  const lcp = record.metrics.largestContentfulPaintMs ?? Number.MAX_SAFE_INTEGER
  const tbt = record.metrics.totalBlockingTimeMs ?? Number.MAX_SAFE_INTEGER
  return { performance, lcp, tbt }
}

function pickBetter(left, right) {
  if (!left) return right
  if (!right) return left
  const a = selectionKey(left)
  const b = selectionKey(right)
  if (b.performance !== a.performance) return b.performance > a.performance ? right : left
  if (b.lcp !== a.lcp) return b.lcp < a.lcp ? right : left
  if (b.tbt !== a.tbt) return b.tbt < a.tbt ? right : left
  return left.run <= right.run ? left : right
}

export function summarizeRuns(records, { siteUrl, routes, profiles }) {
  const pages = []
  for (const page of routes) {
    for (const profile of profiles) {
      const cell = records.filter(record => record.page === page && record.profile === profile)
      const successful = cell.filter(record => record.ok)
      let selected = null
      for (const record of successful) selected = pickBetter(selected, record)
      pages.push({
        page,
        profile,
        url: new URL(page, siteUrl).toString(),
        runs: cell.map(record => record.id),
        successfulRuns: successful.length,
        selectedRun: selected ? selected.id : null,
        selectionMethod:
          'best performance score per page/profile; ties broken by lower LCP, then lower TBT, then earlier run',
        scores: selected ? selected.scores : null,
        metrics: selected ? selected.metrics : null,
      })
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    siteUrl,
    lighthouseVersion: records.find(record => record.lighthouseVersion)?.lighthouseVersion || null,
    method: {
      runsPerCell: records.length / (routes.length * profiles.length),
      categories: CATEGORIES,
      formFactors: profiles,
      routes,
      selection:
        'best performance score per page/profile (ties: lower LCP, lower TBT, earlier run)',
      rawReports: 'contracts/baseline/lighthouse/<page>-<profile>-run<n>.json',
      defaultSettings:
        'mobile uses Lighthouse defaults (Moto G emulation, simulated 4G, 4x CPU); desktop uses the official desktop-config preset',
    },
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || null,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      note: 'Captured on a contended developer machine with other agents (browser captures, Docker/Supabase) and unrelated workloads active; see docs/rebuild/BASELINE.md measurement conditions.',
    },
    pages,
    runs: records,
  }
}

function parseArgs(argv) {
  const options = {
    siteUrl: DEFAULT_SITE_URL,
    routes: DEFAULT_ROUTES,
    profiles: DEFAULT_PROFILES,
    runs: 2,
    outDir: path.join('contracts', 'baseline', 'lighthouse'),
    summaryPath: path.join('contracts', 'baseline', 'lighthouse-summary.json'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]
    if (argument === '--runs') {
      options.runs = Number(value)
      index += 1
    } else if (argument === '--routes') {
      options.routes = value.split(',').map(route => route.trim() || '/')
      index += 1
    } else if (argument === '--profiles') {
      options.profiles = value.split(',').map(profile => profile.trim())
      index += 1
    } else if (argument === '--site-url') {
      options.siteUrl = value.replace(/\/+$/, '')
      index += 1
    } else if (argument === '--out') {
      options.outDir = value
      index += 1
    } else if (argument === '--summary') {
      options.summaryPath = value
      index += 1
    }
  }
  return options
}

export async function captureLighthouse(options = {}) {
  const merged = { ...parseArgs([]), ...options }
  const outDir = path.resolve(merged.outDir)
  const summaryPath = path.resolve(merged.summaryPath)
  const records = []

  for (const page of merged.routes) {
    for (const profile of merged.profiles) {
      const url = new URL(page, merged.siteUrl).toString()
      records.push(
        ...(await captureCell({
          url,
          page,
          profile,
          runs: merged.runs,
          outDir,
        }))
      )
    }
  }

  const summary = summarizeRuns(records, {
    siteUrl: merged.siteUrl,
    routes: merged.routes,
    profiles: merged.profiles,
  })
  await mkdir(path.dirname(summaryPath), { recursive: true })
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  return { summary, summaryPath }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { summary, summaryPath } = await captureLighthouse(options)
  process.stdout.write(`\n> Lighthouse baseline: ${summary.runs.length} runs\n`)
  for (const page of summary.pages) {
    const scores = page.scores
      ? CATEGORIES.map(
          category => `${category.slice(0, 4)} ${page.scores[category]?.toFixed(2) ?? 'n/a'}`
        ).join('  ')
      : 'no successful run'
    process.stdout.write(
      `  + ${page.page} ${page.profile}: ${scores} (selected ${page.selectedRun})\n`
    )
  }
  process.stdout.write(`  + summary: ${path.relative(process.cwd(), summaryPath)}\n`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // Lighthouse sometimes leaves an internal promise rejected after a page
  // navigates/tears down mid-run ("Execution context was destroyed"). The main
  // run promise is handled and retried below; this guard only prevents such a
  // stray internal rejection from killing the whole capture, so a flaky cell is
  // retried and, if still broken, recorded rather than aborting the baseline.
  process.on('unhandledRejection', reason => {
    const message = reason instanceof Error ? reason.message : String(reason)
    process.stderr.write(`[lighthouse] recovered internal async rejection: ${message}\n`)
  })
  main().catch(error => {
    console.error(`\n> Lighthouse baseline FAILED: ${error.stack || error.message}`)
    process.exit(1)
  })
}
