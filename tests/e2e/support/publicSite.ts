import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, type Route, test as base } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  approvedGuestUploads,
  galleryPhotos,
  guestUploadInsertResponse,
  guestbookMessagesWithComments,
  guestbookSubmitResponse,
  mockActivityLog,
} from './mockData'

/**
 * Production media CDN origin (the value playwright.config.ts builds with).
 * Artwork there is real photography; the suite replaces it with a fixed local
 * asset so screenshots are pixel-stable and no third-party host is contacted.
 */
const MEDIA_HOST = 'media.wedding.theporadas.com'
const MEDIA_IMAGE_STUB = fs.readFileSync(
  fileURLToPath(
    new URL('../../../public/images/engagement/PoradaProposal-29.webp', import.meta.url)
  )
)
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/**
 * Deterministic stand-in for the production captions response.
 *
 * The public suite must never depend on the real CDN, so the browser is
 * answered from this fixture. It is a CONTRACT STUB, not evidence about
 * production: a green run here proves the app handles a 206 + text/vtt + CORS
 * response, not that the CDN still sends those headers. The real contract is
 * checked, opt-in and read-only, by
 * `tests/e2e-live/media-cors-contract.spec.ts` (`E2E_LIVE_MEDIA_CORS=1`).
 */
export const MEDIA_VTT_FIXTURE = {
  status: 206,
  contentType: 'text/vtt',
  body: 'WEBVTT\n\n00:00.000 --> 00:01.000\n[e2e captions stub]\n',
} as const

/** The CORS half of the fixture contract, stated in one place for both sides. */
export function mediaVttFixtureHeaders(origin: string | undefined) {
  return {
    'access-control-allow-origin': origin ?? '*',
    'content-type': MEDIA_VTT_FIXTURE.contentType,
  }
}

type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { [key: string]: JsonValue }

const JSON_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json',
}

export const viewports = {
  desktop: { width: 1440, height: 1200 },
  mobile: { width: 390, height: 844 },
} as const

export type ViewportName = keyof typeof viewports

async function fulfillJson(route: Route, body: JsonValue, status = 200) {
  await route.fulfill({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export async function installPublicSiteMocks(page: Page) {
  let uploadAttempt = 0

  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const requestOrigin = request.headers().origin

    // CORS preflight for any mocked origin (Supabase REST/RPC, media CDN).
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...JSON_HEADERS,
          'access-control-allow-origin': requestOrigin ?? '*',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        },
      })
      return
    }

    // Main film captions live on the media CDN in production. Fulfil them
    // locally so the suite never reaches a third-party host, while preserving
    // the partial-content + CORS contract the <track> element relies on.
    if (url.pathname.endsWith('/video/main.vtt')) {
      await route.fulfill({
        status: MEDIA_VTT_FIXTURE.status,
        headers: mediaVttFixtureHeaders(requestOrigin),
        body: MEDIA_VTT_FIXTURE.body,
      })
      return
    }

    // Media CDN images: serve a fixed local asset so visual baselines do not
    // depend on a third-party host being reachable or fast. Video/audio bytes
    // are read-only public media and pass through (the film baseline captures
    // the local poster; the assertions around playback are unaffected).
    if (url.hostname === MEDIA_HOST) {
      const extension = url.pathname.split('.').pop()?.toLowerCase() ?? ''
      const imageType = IMAGE_CONTENT_TYPES[extension]
      if (imageType) {
        await route.fulfill({
          status: 200,
          headers: {
            'access-control-allow-origin': requestOrigin ?? '*',
            'content-type': imageType,
            'cache-control': 'no-store',
          },
          body: MEDIA_IMAGE_STUB,
        })
        return
      }
    }

    // Mock the Netlify pre-signed URL function (same origin as the app)
    if (url.pathname.includes('/guest-upload-url')) {
      uploadAttempt += 1

      if (uploadAttempt === 2) {
        // Simulate a slot request failure for the second file (e.g. the video)
        await route.fulfill({
          status: 500,
          headers: JSON_HEADERS,
          body: 'Server configuration error',
        })
        return
      }

      await fulfillJson(route, {
        uploadUrl: `https://mock-r2.example.com/guest-uploads/photos/mock-${uploadAttempt}.png`,
        publicUrl: `https://mock-r2.example.com/guest-uploads/photos/mock-${uploadAttempt}.png`,
      })
      return
    }

    // Mock the R2 PUT (signed URL destination)
    if (url.hostname === 'mock-r2.example.com') {
      await route.fulfill({ status: 200, body: '' })
      return
    }

    if (!url.hostname.includes('supabase')) {
      await route.continue()
      return
    }

    if (url.pathname.includes('/rest/v1/photos')) {
      await fulfillJson(route, galleryPhotos)
      return
    }

    if (url.pathname.includes('/rpc/get_guestbook_messages_with_comments')) {
      await fulfillJson(route, guestbookMessagesWithComments)
      return
    }

    if (url.pathname.includes('/rpc/submit_guestbook_message_with_rate_limit')) {
      await fulfillJson(route, guestbookSubmitResponse)
      return
    }

    if (url.pathname.includes('/rest/v1/guestbook_messages') && request.method() === 'GET') {
      await fulfillJson(route, guestbookMessagesWithComments)
      return
    }

    if (url.pathname.includes('/rest/v1/guestbook_messages') && request.method() === 'PATCH') {
      await fulfillJson(route, [])
      return
    }

    if (url.pathname.includes('/rest/v1/guestbook_comments') && request.method() === 'POST') {
      await fulfillJson(route, [])
      return
    }

    if (url.pathname.includes('/rest/v1/guest_uploads') && request.method() === 'GET') {
      await fulfillJson(route, approvedGuestUploads)
      return
    }

    if (url.pathname.includes('/rest/v1/guest_uploads') && request.method() === 'POST') {
      await fulfillJson(route, guestUploadInsertResponse, 201)
      return
    }

    if (url.pathname.includes('/rest/v1/guest_share_tokens')) {
      const tokenParam = url.searchParams.get('token')
      if (tokenParam === 'eq.invalid-token') {
        await fulfillJson(route, null)
      } else {
        await fulfillJson(route, { guest_email: 'jane@example.com', token: 'valid-showcase-token' })
      }
      return
    }

    if (url.pathname.includes('/rest/v1/guest_identities')) {
      if (url.searchParams.get('select')?.includes('photo_claims')) {
        await fulfillJson(route, {
          id: 'identity-jane',
          photo_claims: [
            {
              id: 'claim-1',
              status: 'approved',
              photos: galleryPhotos[0],
            },
          ],
        })
      } else {
        await fulfillJson(route, { display_name: 'Jane Miller' })
      }
      return
    }

    if (url.pathname.includes('/rest/v1/activity_log')) {
      await fulfillJson(route, mockActivityLog)
      return
    }

    await fulfillJson(route, [], 200)
  })
}

export async function preparePublicPage(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__E2E__ = true
    // The production bundle registers a PWA service worker (skipWaiting +
    // clientsClaim + autoUpdate). On the first load it takes control and the
    // registerSW autoUpdate handler reloads the tab. That reload lands a few
    // hundred milliseconds after `load`, so it races every test: it has been
    // observed destroying execution contexts mid-axe-run ("Execution context
    // was destroyed, most likely because of a navigation"), dropping focus
    // between Tab presses, and wiping typed input. Offline caching is not under
    // test here and the suite already mocks the network, so registration is
    // neutralised instead of raced.
    try {
      const noopRegistration = {
        scope: '/',
        installing: null,
        waiting: null,
        active: null,
        update: async () => undefined,
        unregister: async () => true,
        addEventListener() {},
        removeEventListener() {},
      }
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true,
        value: async () => noopRegistration,
      })
      Object.defineProperty(navigator.serviceWorker, 'getRegistrations', {
        configurable: true,
        value: async () => [],
      })
    } catch {
      // serviceWorker unavailable (non-secure origin) — nothing to suppress.
    }
  })
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const sourceUrl = msg.location().url
      if (sourceUrl.includes('/guest-upload-url')) {
        return
      }
      console.log(`[Browser Console Error] ${msg.text()}`)
    }
  })
  page.on('pageerror', err => {
    console.log(`[Browser Page Error] ${err.stack || err.message}`)
  })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
}

export async function gotoPublicPage(
  page: Page,
  route: string,
  viewport: ViewportName = 'desktop'
) {
  await page.setViewportSize(viewports[viewport])
  await page.goto(route)
  await waitForPageReady(page)
}

export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page
    .evaluate(async () => {
      if ('fonts' in document) {
        await document.fonts.ready
      }
    })
    .catch(() => {})
  await page.waitForTimeout(150)
}

export async function pauseMedia(page: Page) {
  await page
    .evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('video-progress-')) {
          window.localStorage.removeItem(key)
        }
      }
    })
    .catch(() => {})

  const videos = page.locator('video')
  const count = await videos.count()

  for (let index = 0; index < count; index += 1) {
    const video = videos.nth(index)
    await video
      .evaluate(node => {
        const element = node as HTMLVideoElement
        element.pause()
        element.currentTime = 0
        element.dispatchEvent(new Event('timeupdate'))
      })
      .catch(() => {})
  }

  await page.waitForTimeout(100)
}

export async function expectNoCriticalViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const criticalViolations = results.violations.filter(violation => violation.impact === 'critical')
  expect(
    criticalViolations,
    `Critical accessibility violations: ${criticalViolations.map(item => item.id).join(', ')}`
  ).toEqual([])
}

export async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused()

  const hasVisibleFocus = await locator.evaluate(node => {
    const styles = window.getComputedStyle(node)
    const outlineWidth = Number.parseFloat(styles.outlineWidth || '0')
    return (
      (styles.outlineStyle !== 'none' && outlineWidth > 0) ||
      styles.boxShadow !== 'none' ||
      styles.borderColor !== 'rgba(0, 0, 0, 0)'
    )
  })

  expect(hasVisibleFocus).toBeTruthy()
}

export async function expectSectionScreenshot(locator: Locator, snapshotName: string) {
  const page = locator.page()
  const publicHeader = page.getByTestId('public-header')

  await publicHeader
    .evaluateAll(nodes => {
      for (const node of nodes) {
        const element = node as HTMLElement
        element.dataset.codexScreenshotVisibility = element.style.visibility
        element.dataset.codexScreenshotPointerEvents = element.style.pointerEvents
        element.style.visibility = 'hidden'
        element.style.pointerEvents = 'none'
      }
    })
    .catch(() => {})

  // Stabilise layout width on Windows BEFORE scrolling: reserve the scrollbar
  // gutter permanently so it never causes a layout shift that triggers text
  // reflow and element-height oscillation between screenshot retries.
  // overflow:auto is required for scrollbar-gutter to take effect; overflow:hidden
  // would prevent toHaveScreenshot's internal scrollIntoView from working.
  await page.evaluate(() => {
    document.documentElement.dataset.prevScrollbarGutter =
      document.documentElement.style.scrollbarGutter
    document.documentElement.dataset.prevOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.scrollbarGutter = 'stable'
  })

  await locator.scrollIntoViewIfNeeded()
  // Give the layout one frame to settle after scroll + scrollbar-gutter change.
  await page.waitForTimeout(100)

  try {
    await expect(locator).toHaveScreenshot(snapshotName, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.015,
      scale: 'css',
    })
  } finally {
    await page.evaluate(() => {
      document.documentElement.style.scrollbarGutter =
        document.documentElement.dataset.prevScrollbarGutter ?? ''
      document.documentElement.style.overflow = document.documentElement.dataset.prevOverflow ?? ''
      delete document.documentElement.dataset.prevScrollbarGutter
      delete document.documentElement.dataset.prevOverflow
    })
    await publicHeader
      .evaluateAll(nodes => {
        for (const node of nodes) {
          const element = node as HTMLElement
          element.style.visibility = element.dataset.codexScreenshotVisibility ?? ''
          element.style.pointerEvents = element.dataset.codexScreenshotPointerEvents ?? ''
          delete element.dataset.codexScreenshotVisibility
          delete element.dataset.codexScreenshotPointerEvents
        }
      })
      .catch(() => {})
  }
}

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await preparePublicPage(page)
    await installPublicSiteMocks(page)
    await runPage(page)
  },
})

export { expect }
