/**
 * Shared helpers for the live (real-data) E2E test suite.
 * No Supabase mocking — tests hit the real backend.
 */
import { expect, type Page, test as base } from '@playwright/test'

// ---------------------------------------------------------------------------
// Viewports
// ---------------------------------------------------------------------------
export const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

export type ViewportName = keyof typeof viewports

// ---------------------------------------------------------------------------
// Base page setup
// ---------------------------------------------------------------------------
async function prepareRealtPage(page: Page) {
  // Flag that we're in E2E so the app can optionally suppress animations
  await page.addInitScript(() => {
    ;(window as any).__E2E__ = true
  })

  // Reduce motion and fix color scheme for visual consistency
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })

  // Log browser errors to the test output
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`)
    }
  })
  page.on('pageerror', err => {
    console.log(`[Page Error] ${err.stack ?? err.message}`)
  })
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
export async function gotoPage(page: Page, route: string, viewport: ViewportName = 'desktop') {
  await page.setViewportSize(viewports[viewport])
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await waitForPageReady(page)
}

export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  // networkidle can time out on pages with realtime subscriptions — just catch it
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page
    .evaluate(async () => {
      if ('fonts' in document) await document.fonts.ready
    })
    .catch(() => {})
  // One extra frame for React to commit any post-load state updates
  await page.waitForTimeout(200)
}

// ---------------------------------------------------------------------------
// Image audit — the core health check
// ---------------------------------------------------------------------------
export interface ImageAuditResult {
  page: string
  total: number
  loaded: number
  broken: string[]
  stillLoading: string[]
}

/**
 * Audit all <img> elements on the current page.
 * Waits up to `timeoutMs` for in-flight images to settle before reporting them broken.
 * Uses `complete && naturalWidth === 0` as the broken signal — images still loading
 * (complete=false) are reported separately so you can distinguish failures from slowness.
 */
export async function auditImages(page: Page, timeoutMs = 8000): Promise<ImageAuditResult> {
  // Poll until all images are complete or timeout expires
  await page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll<HTMLImageElement>('img')]
        return imgs.every(img => img.complete || !img.src || img.src.startsWith('data:'))
      },
      { timeout: timeoutMs }
    )
    .catch(() => {}) // timeout is expected if CDN is slow — we'll still report

  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('img')]
    const src = (img: HTMLImageElement) => img.src.replace(location.origin, '')
    const realImgs = imgs.filter(i => i.src && !i.src.startsWith('data:'))
    const broken = realImgs.filter(i => i.complete && i.naturalWidth === 0)
    const loading = realImgs.filter(i => !i.complete)
    return {
      page: location.pathname,
      total: realImgs.length,
      loaded: realImgs.filter(i => i.complete && i.naturalWidth > 0).length,
      broken: broken.map(src),
      stillLoading: loading.map(src),
    }
  })
}

/**
 * Assert that no images on the current page are broken.
 * Prints a clear table of results regardless.
 */
export async function expectNobrokenImages(page: Page) {
  const result = await auditImages(page)
  const summary = `${result.page}: ${result.loaded}/${result.total} loaded`

  if (result.broken.length > 0) {
    console.log(`❌ ${summary} — BROKEN:`)
    result.broken.forEach(url => console.log(`   broken: ${url}`))
  } else if (result.stillLoading.length > 0) {
    console.log(`⚠️  ${summary} — ${result.stillLoading.length} still loading (CDN slow?)`)
    result.stillLoading.forEach(url => console.log(`   loading: ${url}`))
  } else {
    console.log(`✅ ${summary}`)
  }

  expect(result.broken, `Broken images on ${result.page}`).toEqual([])
}

// ---------------------------------------------------------------------------
// Screenshot helper — hides sticky headers that overlap content
// ---------------------------------------------------------------------------
export async function takeFullPageScreenshot(page: Page, name: string) {
  // Hide sticky/fixed headers so they don't obscure content in full-page shots
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-testid="public-header"]')) {
      el.style.visibility = 'hidden'
    }
  })

  await expect(page).toHaveScreenshot(name, { fullPage: true })

  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-testid="public-header"]')) {
      el.style.visibility = ''
    }
  })
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------
export async function pauseAllVideos(page: Page) {
  await page
    .evaluate(() => {
      for (const v of document.querySelectorAll<HTMLVideoElement>('video')) {
        v.pause()
        v.currentTime = 0
      }
    })
    .catch(() => {})
  await page.waitForTimeout(100)
}

// ---------------------------------------------------------------------------
// Extended test base
// ---------------------------------------------------------------------------
export const test = base.extend<{
  livePage: Page
}>({
  livePage: async ({ page }, run) => {
    await prepareRealtPage(page)
    await run(page)
  },
})

export { expect }
