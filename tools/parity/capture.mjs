/**
 * Browser capture engine.
 *
 * One "shot" is one (route, viewport, theme) combination on one side (legacy
 * or rebuild). A shot is captured as a stack of viewport-sized slices taken at
 * deterministic scroll offsets: that is our full-page capture. Scroll-offset
 * capture (rather than one captureBeyondViewport bitmap) keeps sticky and
 * scroll-linked layers in a scroll state that is identical on both sides,
 * stays under Chromium's texture limits for very tall pages, and is what the
 * diff/report consume.
 *
 * Determinism contract (documented in docs/rebuild/PARITY.md):
 *  - production static build, same browser binary and machine for both sides
 *  - Date fixed to contracts/ui.json `fixedNow`; fake timers are advanced only
 *    by fixed runFor() budgets, so animation phase cannot depend on wall time
 *  - a warm-up navigation in the same browsing context (clock running) mounts
 *    lazy routes and fills the HTTP cache; the captured navigation then starts
 *    with the fake-timer clock already paused
 *  - locale en-US, timezone America/New_York, reduced motion, service workers
 *    blocked, caret hidden, scrollbar gutter stable, scrollbars not painted
 *  - fonts ready, every image complete + decoded, lazy sweep in 600px steps
 *  - videos/audio paused at t=0 and muted; play() neutralised
 *  - fresh browser context per shot; network mocks for Supabase/CDN/R2/GA/Sentry
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { CAPTURE } from './config.mjs'
import {
  HarnessError,
  log,
  normalizeText,
  nowIso,
  sanitizeKey,
  sha256,
  stripOrigin,
  writeJsonFile,
} from './util.mjs'
import { createMockState, installNetworkMocks, preparePage } from './mocks/index.mjs'

/** CSS applied before capture: motion frozen, scrollbars painted away. */
const CSS_FREEZE = [
  // CSS animation/transition timing is decoration that is driven by the
  // compositor, so the JS clock cannot freeze it. Collapse it to its end state.
  '*,*::before,*::after{animation-delay:0s !important;animation-duration:0s !important;',
  'animation-iteration-count:1 !important;transition-delay:0s !important;',
  'transition-duration:0s !important;caret-color:transparent !important}',
  // Reserve the scrollbar gutter so layout width never depends on scroll state,
  // then stop painting the classic scrollbar (its thumb position is a function
  // of scroll offset and would differ per slice).
  'html{scrollbar-gutter:stable !important;scrollbar-width:none !important}',
  'html::-webkit-scrollbar,body::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important}',
].join('')

/** Wait for the SPA to have painted non-trivial content. Host-side only. */
async function waitForAppContent(page, { timeoutMs = 15000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const ready = await page
      .evaluate(() => {
        const main = document.querySelector('main') ?? document.body
        if (!main) return false
        const text = (main.textContent ?? '').replace(/\s+/g, ' ').trim()
        const hasChildElements = (main.querySelectorAll('*') ?? []).length >= 3
        return hasChildElements && text.length >= 40
      })
      .catch(() => false)
    if (ready) return true
    await page.waitForTimeout(100)
  }
  return false
}

async function waitForImages(page, { timeoutMs = 10000 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = await page
      .evaluate(async () => {
        const images = [...document.images]
        const incomplete = images.filter(image => !image.complete)
        if (incomplete.length > 0) return { incomplete: incomplete.length, decoded: false }
        const decodes = await Promise.all(
          images.map(image =>
            typeof image.decode === 'function'
              ? image.decode().then(
                  () => true,
                  () => true
                )
              : Promise.resolve(true)
          )
        )
        return { incomplete: 0, decoded: decodes.every(Boolean) }
      })
      .catch(() => ({ incomplete: 1, decoded: false }))
    if (state.incomplete === 0 && state.decoded) return true
    await page.waitForTimeout(100)
  }
  return false
}

async function prepareDeterministicLayout(page, { masks = [] } = {}) {
  await page.addStyleTag({ content: CSS_FREEZE }).catch(() => {
    /* page may have navigated */
  })
  await page.evaluate(scrollbarGutter => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('video-progress-')) window.localStorage.removeItem(key)
    }
    for (const video of document.querySelectorAll('video')) {
      video.pause()
      video.muted = true
      video.currentTime = 0
      video.dispatchEvent(new Event('timeupdate'))
    }
    for (const audio of document.querySelectorAll('audio')) {
      audio.pause()
      audio.muted = true
    }
    const root = document.documentElement
    root.style.overflow = 'auto'
    root.style.scrollbarGutter = scrollbarGutter
  }, CAPTURE.scrollbarGutter)
  if (masks.length > 0) {
    // Masked widgets are explicitly exempt from pixel comparison (documented
    // per selector in config.mjs + docs/rebuild/PARITY.md). Hiding before
    // capture keeps the diff deterministic without allowlisting a whole shot.
    await page.addStyleTag({
      content: masks.map(selector => `${selector}{visibility:hidden !important}`).join(''),
    })
  }
}

async function pageHeight(page) {
  return page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
      document.documentElement.offsetHeight
    )
  )
}

async function lazyScrollSweep(page) {
  const height = await pageHeight(page)
  const limit = Math.min(height, CAPTURE.maxPageHeightPx)
  for (let y = 0; y < limit; y += CAPTURE.scrollStepPx) {
    await page.evaluate(position => window.scrollTo(0, position), y)
    await page.clock.runFor(CAPTURE.scrollRunForMs).catch(() => {})
    await page.waitForTimeout(CAPTURE.scrollStepSettleMs)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(CAPTURE.scrollSettleMs)
  return height
}

/**
 * Fixed-window capture plan: `count` viewport windows at absolute scroll offsets
 * 0, viewportHeight, 2*viewportHeight, … clamped to the page bottom. The count
 * never depends on page height, so a layout-height difference between legacy
 * and rebuild cannot change the capture plan (only the clamped last offsets).
 */
export function windowOffsets(pageHeightPx, viewportHeight, count = CAPTURE.windowCount) {
  const maxScroll = Math.max(0, pageHeightPx - viewportHeight)
  return Array.from({ length: count }, (_, index) => Math.min(index * viewportHeight, maxScroll))
}

function themeApplied(page) {
  return page.evaluate(() => ({
    datasetTheme: document.documentElement.dataset.theme ?? '',
    className: document.documentElement.className,
    colorScheme: document.documentElement.style.colorScheme || '',
  }))
}

const TEXT_EXTRACTION = () => {
  const meta = {}
  for (const tag of document.querySelectorAll('meta[name], meta[property]')) {
    const key = tag.getAttribute('name') ?? tag.getAttribute('property')
    if (!key || key in meta) continue
    meta[key] = (tag.getAttribute('content') ?? '').trim()
  }
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? ''
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .map(heading => ({
      level: Number(heading.tagName.slice(1)),
      text: (heading.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(heading => heading.text.length > 0)
  const links = [...document.querySelectorAll('a[href]')]
    .map(link => ({
      href: link.getAttribute('href') ?? '',
      text: (link.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ariaLabel: link.getAttribute('aria-label') ?? '',
    }))
    .filter(link => link.href.length > 0)
  const images = [...document.querySelectorAll('img')].map(image => ({
    src: image.getAttribute('src') ?? '',
    alt: image.getAttribute('alt') ?? '',
    loading: image.getAttribute('loading') ?? '',
  }))
  return {
    url: `${location.pathname}${location.search}${location.hash}`,
    title: document.title,
    lang: document.documentElement.lang ?? '',
    meta,
    canonical,
    headings,
    links,
    images,
    bodyText: document.body?.innerText ?? '',
  }
}

function launchGuard(error) {
  return new HarnessError(
    `Could not launch Chromium through Playwright: ${error.message}. ` +
      'The Lead owns dependency/browser installs — report this instead of installing anything.',
    { cause: error }
  )
}

export async function launchBrowser({ headless = true } = {}) {
  const { chromium } = await import('playwright')
  try {
    return await chromium.launch({ headless })
  } catch (error) {
    throw launchGuard(error)
  }
}

export async function browserVersionInfo(browser) {
  let playwrightVersion = 'unknown'
  try {
    const { ROOT } = await import('./util.mjs')
    const pkgPath = path.join(ROOT, 'node_modules', 'playwright', 'package.json')
    playwrightVersion = JSON.parse(await fs.readFile(pkgPath, 'utf8')).version
  } catch {
    /* version is informational only */
  }
  return {
    playwright: playwrightVersion,
    chromium: browser.version(),
    executablePath: browser.browserType().executablePath(),
  }
}

/**
 * Warm up the context: one navigation with the fake timer clock running so the
 * app fully mounts and the HTTP cache holds chunks + mocked data responses.
 */
async function warmUpContext(
  browser,
  { fixedNow, baseUrl, routePath, viewport, theme, mode, fixtures, mediaStub }
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    locale: CAPTURE.locale,
    timezoneId: CAPTURE.timezoneId,
    colorScheme: theme,
    reducedMotion: CAPTURE.reducedMotion,
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  await preparePage(page, { theme, mode, fixtures })
  await installNetworkMocks(page, { baseUrl, mode, fixtures, mediaStub, state: createMockState() })
  await page.clock.install({ time: new Date(fixedNow) })
  const response = await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'load', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await waitForAppContent(page, { timeoutMs: 8000 })
  await page.waitForTimeout(200)
  return { context, page, warmupStatus: response?.status() ?? null }
}

/**
 * Capture one shot and write its artifacts.
 *
 * @returns {{
 *   ok: boolean, error?: {message: string, kind: string, stack?: string},
 *   meta: object, text: object|null, textFile: string|null, shotFiles: string[]
 * }}
 */
export async function captureShot(
  browser,
  {
    baseUrl,
    side,
    route,
    routePath,
    viewport,
    theme,
    ui,
    fixtures,
    mediaStub,
    shotsDir,
    textDir,
    masks = [],
    injectCss = '',
  }
) {
  const key = `${sanitizeKey(route.id)}__${viewport.name}__${theme}`
  const mode = route.auth === 'admin' || route.kind === 'admin' ? 'admin' : 'public'
  const started = Date.now()
  const consoleErrors = []
  const pageErrors = []
  const warnings = []
  const shotFiles = []
  let context = null
  let httpStatus = null
  let pageHeightPx = 0
  let themeState = null
  let imageWait = null

  try {
    const warm = await warmUpContext(browser, {
      fixedNow: ui.fixedNow,
      baseUrl,
      routePath,
      viewport,
      theme,
      mode,
      fixtures,
      mediaStub,
    })
    context = warm.context
    await warm.page.close()

    const page = await context.newPage()
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500))
    })
    page.on('pageerror', error => pageErrors.push(String(error.message ?? error).slice(0, 500)))
    await preparePage(page, { theme, mode, fixtures })
    await installNetworkMocks(page, {
      baseUrl,
      mode,
      fixtures,
      mediaStub,
      state: createMockState(),
    })
    await page.clock.install({ time: new Date(ui.fixedNow) })
    await page.clock.pauseAt(new Date(ui.fixedNow).getTime() + 1)

    const response = await page.goto(`${baseUrl}${routePath}`, {
      waitUntil: 'load',
      timeout: 45000,
    })
    httpStatus = response?.status() ?? null

    // Deterministic fake-time budget: exactly these runFor amounts are spent,
    // independent of wall-clock timing. Wall-clock waits below never advance
    // the fake clock, so animation phase is a pure function of the budget.
    await page.clock.runFor(1200)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await waitForAppContent(page, { timeoutMs: 15000 })
    await page.evaluate(async () => {
      if ('fonts' in document) await document.fonts.ready
    })
    await page.clock.runFor(600)

    await prepareDeterministicLayout(page, { masks })
    if (injectCss) await page.addStyleTag({ content: injectCss })
    themeState = await themeApplied(page).catch(() => null)
    if (themeState && themeState.datasetTheme && themeState.datasetTheme !== theme) {
      warnings.push(
        `Requested theme "${theme}" but documentElement.dataset.theme is "${themeState.datasetTheme}"`
      )
    }

    pageHeightPx = await lazyScrollSweep(page)
    if (pageHeightPx > CAPTURE.maxPageHeightPx) {
      warnings.push(
        `Page height ${pageHeightPx}px exceeds capture cap ${CAPTURE.maxPageHeightPx}px — only the first cap is captured.`
      )
    }
    const imageWaitOk = await waitForImages(page)
    imageWait = imageWaitOk
    if (!imageWaitOk) warnings.push('Some images did not finish loading/decoding before capture.')
    await page.clock.runFor(CAPTURE.finalRunForMs)
    await page.waitForTimeout(CAPTURE.captureSettleMs)

    pageHeightPx = Math.min(await pageHeight(page), CAPTURE.maxPageHeightPx)
    const offsets = windowOffsets(pageHeightPx, viewport.height)
    await fs.mkdir(shotsDir, { recursive: true })
    for (const [index, offset] of offsets.entries()) {
      await page.evaluate(position => window.scrollTo(0, position), offset)
      // Let IntersectionObserver deliver for this scroll position, then advance
      // a fixed fake-time budget: scrolled-into-view reveal animations always
      // reach their end state before the window is captured, and infinite
      // animation phase stays a pure function of the deterministic budget.
      // Wall-clock waits never advance the fake clock.
      await page.waitForTimeout(CAPTURE.sliceSettleMs)
      await page.clock.runFor(CAPTURE.windowRunForMs).catch(() => {})
      await page.waitForTimeout(CAPTURE.sliceSettleMs)
      const file = path.join(shotsDir, `${key}--s${String(index).padStart(3, '0')}.png`)
      await page.screenshot({
        path: file,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      })
      shotFiles.push(file)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(80)

    const extracted = await page.evaluate(TEXT_EXTRACTION)
    const text = normalizeTextPayload(extracted, { baseUrl })
    const textFile = path.join(textDir, `${key}.json`)
    await writeJsonFile(textFile, text)

    await context.close()
    context = null

    return {
      ok: true,
      meta: {
        key,
        side,
        route: {
          id: route.id,
          path: route.path,
          urlPath: routePath,
          parity: route.parity,
          kind: route.kind,
        },
        endpoint: `${baseUrl}${routePath}`,
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        theme,
        themeApplied: themeState,
        httpStatus,
        pageHeightPx,
        sliceOffsets: offsets,
        sliceCount: offsets.length,
        durationMs: Date.now() - started,
        masks,
        textFile,
        textSha256: sha256(JSON.stringify(text)),
        warnings,
        consoleErrors: consoleErrors.slice(0, 20),
        pageErrors: pageErrors.slice(0, 20),
        imagesSettled: imageWait,
      },
      text,
      textFile,
      shotFiles,
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error.message,
        kind: error instanceof HarnessError ? 'harness' : 'capture',
        stack: String(error.stack ?? '')
          .split('\n')
          .slice(0, 6)
          .join('\n'),
      },
      meta: {
        key,
        side,
        route: { id: route.id, path: route.path, urlPath: routePath, parity: route.parity },
        endpoint: `${baseUrl}${routePath}`,
        viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
        theme,
        httpStatus,
        pageHeightPx,
        durationMs: Date.now() - started,
        shotFiles,
        warnings,
        consoleErrors: consoleErrors.slice(0, 20),
        pageErrors: pageErrors.slice(0, 20),
      },
      text: null,
      shotFiles,
    }
  } finally {
    if (context) await context.close().catch(() => {})
  }
}

/** Normalise a raw DOM text extraction into the committed text/ contract shape. */
export function normalizeTextPayload(extracted, { baseUrl }) {
  return {
    capturedAt: nowIso(),
    baseUrl,
    url: extracted.url,
    title: extracted.title.trim(),
    lang: extracted.lang.trim(),
    canonical: extracted.canonical,
    meta: Object.fromEntries(
      Object.entries(extracted.meta).map(([key, value]) => [key, String(value ?? '').trim()])
    ),
    headings: extracted.headings,
    links: extracted.links.map(link => ({
      href: stripOrigin(link.href, baseUrl),
      text: link.text,
      ariaLabel: link.ariaLabel,
    })),
    images: extracted.images.map(image => ({
      src: stripOrigin(image.src, baseUrl),
      alt: image.alt,
      loading: image.loading,
    })),
    bodyText: normalizeText(extracted.bodyText),
  }
}

export function formatCaptureError(capture) {
  if (!capture.error) return ''
  return `${capture.error.kind}: ${capture.error.message}`
}

/** Remove and recreate an output directory (never user data: tools/parity/output is gitignored). */
export async function ensureFreshDir(dir) {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
}

export function logCaptureSummary(capture) {
  const { meta } = capture
  if (!capture.ok) {
    log.warn(
      `capture failed ${meta.route.id}/${meta.viewport?.name}/${meta.theme}: ${formatCaptureError(capture)}`
    )
    return
  }
  log.step(
    `captured ${meta.route.id}/${meta.viewport.name}/${meta.theme} ` +
      `(${meta.sliceCount} slices, ${meta.pageHeightPx}px, ${meta.durationMs}ms)`
  )
}
