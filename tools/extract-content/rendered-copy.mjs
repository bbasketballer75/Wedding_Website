#!/usr/bin/env node
/**
 * Captures the RENDERED truth of every route from the frozen legacy build.
 *
 * contracts/README.md distinguishes structured content (`content/*.json`, from
 * source) from rendered truth: what a visitor actually reads and sees. This
 * script produces the latter — normalized visible text, metadata, headings,
 * navigation links and image sources per route — by driving the frozen legacy
 * production build with Playwright.
 *
 * Requirements:
 *   - the frozen legacy preview is serving (the LEAD owns it): default
 *     http://127.0.0.1:4174, override with LEGACY_PREVIEW_URL.
 *   - contracts/ui.json exists (it owns the shared capture clock `fixedNow`).
 *   - contracts/fixtures/*.json exist (`node tools/extract-content/fixtures.mjs`).
 *   - Playwright chromium is installed (already a devDependency).
 *
 * Determinism (this is why the snapshots are comparable):
 *   - page.clock.setFixedTime(ui.json.fixedNow) freezes Date/Date.now while
 *     leaving timers running, so time-dependent copy (anniversary countdown,
 *     footer year) is identical across captures and across machines;
 *   - service workers are blocked (no autoUpdate reload race);
 *   - reducedMotion=reduce, colorScheme=light (the e2e baseline settings);
 *   - every Supabase/auth/media request is answered from contracts/fixtures via
 *     the same deterministic mock data the e2e suite uses; external hosts
 *     (analytics, Sentry) are aborted, never contacted;
 *   - no screenshots and no media bytes are written: contracts reference text.
 *
 * Usage:
 *   node tools/extract-content/rendered-copy.mjs              # all routes
 *   node tools/extract-content/rendered-copy.mjs --priority   # parity-1 only
 */
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { readJson, writeText } from '../lib/fs.mjs'
import { writeContractJson } from './write-contract-json.mjs'
import { renderedContentDir, repoPath } from '../lib/paths.mjs'
import { die, info, ok, step } from '../lib/log.mjs'

const args = new Set(process.argv.slice(2))
const PRIORITY_ONLY = args.has('--priority')

const BASE_URL = (process.env.LEGACY_PREVIEW_URL || 'http://127.0.0.1:4174').replace(/\/+$/, '')
const FREEZE_TAG = 'legacy-freeze-2026-11-08'
const MEDIA_HOST = 'media.wedding.theporadas.com'

const MEDIA_VTT_FIXTURE = {
  status: 206,
  contentType: 'text/vtt',
  body: 'WEBVTT\n\n00:00.000 --> 00:01.000\n[e2e captions stub]\n',
}

const IMAGE_CONTENT_TYPES = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

const JSON_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json',
}

/**
 * Route table. `mode` selects the mock profile: 'public' answers like the
 * public e2e suite, 'admin' seeds the Supabase auth session and admin queues.
 */
const ROUTES = [
  { id: 'home', path: '/', mode: 'public', priority: 1 },
  { id: 'film', path: '/film', mode: 'public', priority: 1 },
  { id: 'gallery', path: '/gallery', mode: 'public', priority: 1 },
  { id: 'guestbook', path: '/guestbook', mode: 'public', priority: 1 },
  { id: 'guest-photos', path: '/guest-photos', mode: 'public', priority: 1 },
  { id: 'upload', path: '/upload', mode: 'public', priority: 1 },
  { id: 'activity', path: '/activity', mode: 'public', priority: 0 },
  { id: 'admin-login', path: '/admin/login', mode: 'public', priority: 0 },
  { id: 'admin', path: '/admin', mode: 'admin', priority: 0 },
  { id: 'guest-token', path: '/guest/valid-showcase-token', mode: 'public', priority: 0 },
  { id: 'print', path: '/print', mode: 'public', priority: 0 },
  { id: 'not-found', path: '/this-page-does-not-exist', mode: 'public', priority: 0 },
]

async function loadFixtures() {
  const names = [
    'photos',
    'guestbook',
    'guestUploads',
    'activity',
    'editorial',
    'claims',
    'guestTokens',
    'adminSession',
  ]
  const fixtures = {}
  for (const name of names) {
    fixtures[name] = await readJson(repoPath('contracts', 'fixtures', `${name}.json`))
  }
  return fixtures
}

async function checkPreviewIsUp() {
  try {
    const response = await fetch(`${BASE_URL}/`)
    if (!response.ok) die(`rendered-copy: ${BASE_URL}/ returned HTTP ${response.status}`)
  } catch (error) {
    die(
      `rendered-copy: legacy preview not reachable at ${BASE_URL} (${error.message}). ` +
        'The Lead owns serving the frozen build; ask for the current URL and set LEGACY_PREVIEW_URL.'
    )
  }
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({ status, headers: JSON_HEADERS, body: JSON.stringify(body) })
}

function findPhoto(fixtures, id) {
  return fixtures.photos.find(photo => photo.id === id)
}

/** Deterministic Supabase/auth/media mocks, ported from tests/e2e/support. */
async function installMocks(page, fixtures, mode, stubImage) {
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const requestOrigin = request.headers().origin

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

    // The frozen preview itself (same origin: document, JS chunks, bundled fonts).
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue()
      return
    }

    // Offloaded media host: captions + image stub answered locally, video/audio
    // bytes aborted (read-only public media, not needed for text snapshots).
    if (url.hostname === MEDIA_HOST) {
      if (url.pathname.endsWith('.vtt')) {
        await route.fulfill({
          status: MEDIA_VTT_FIXTURE.status,
          headers: {
            'access-control-allow-origin': requestOrigin ?? '*',
            'content-type': MEDIA_VTT_FIXTURE.contentType,
          },
          body: MEDIA_VTT_FIXTURE.body,
        })
        return
      }
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
          body: stubImage,
        })
        return
      }
      await route.abort()
      return
    }

    // Same-origin Netlify functions are served by the preview, but the upload
    // pre-sign function is not part of a static build: mock it.
    if (url.pathname.includes('/guest-upload-url')) {
      await fulfillJson(route, {
        uploadUrl: 'https://mock-r2.example.com/guest-uploads/photos/mock-1.png',
        publicUrl: 'https://mock-r2.example.com/guest-uploads/photos/mock-1.png',
      })
      return
    }

    if (url.hostname === 'mock-r2.example.com') {
      await route.fulfill({ status: 200, body: '' })
      return
    }

    if (url.hostname.includes('supabase')) {
      await handleSupabaseRequest(route, request, url, fixtures, mode)
      return
    }

    // Analytics, Sentry, Google Fonts, anything else: offline, deterministically.
    await route.abort()
  })
}

async function handleSupabaseRequest(route, request, url, fixtures, mode) {
  const path = url.pathname
  const method = request.method()

  if (path.includes('/auth/v1/user')) {
    await fulfillJson(route, fixtures.adminSession.user)
    return
  }
  if (path.includes('/auth/v1/token')) {
    await fulfillJson(route, fixtures.adminSession.session)
    return
  }
  if (path.includes('/auth/v1/logout')) {
    await fulfillJson(route, {})
    return
  }

  if (path.includes('/rest/v1/photos')) {
    if (method === 'GET') {
      const idFilter = url.searchParams.get('id')
      if (idFilter && idFilter.startsWith('eq.')) {
        const photo = findPhoto(fixtures, idFilter.slice(3))
        await fulfillJson(route, photo ?? null)
        return
      }
      if (url.search.includes('count')) {
        await fulfillJson(route, fixtures.adminSession.dashboardCounts.photos)
        return
      }
      await fulfillJson(route, fixtures.photos)
      return
    }
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/rest/v1/guest_uploads')) {
    if (method === 'GET') {
      if (url.search.includes('count')) {
        await fulfillJson(
          route,
          mode === 'admin'
            ? fixtures.adminSession.dashboardCounts.approvedUploads
            : fixtures.guestUploads.approved
        )
        return
      }
      await fulfillJson(
        route,
        mode === 'admin' ? fixtures.guestUploads.pending : fixtures.guestUploads.approved
      )
      return
    }
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/rest/v1/guestbook_messages')) {
    if (method === 'GET') {
      if (url.search.includes('count')) {
        await fulfillJson(route, fixtures.adminSession.dashboardCounts.guestbookMessages)
        return
      }
      await fulfillJson(
        route,
        mode === 'admin' ? fixtures.guestbook.adminMessages : fixtures.guestbook.messages
      )
      return
    }
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/rest/v1/guestbook_comments')) {
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/rest/v1/photo_claims')) {
    if (method === 'GET') {
      const idFilter = url.searchParams.get('id')
      if (idFilter === 'eq.claim-pending-1') {
        await fulfillJson(route, fixtures.claims.pending[0])
        return
      }
      const status = url.searchParams.get('status')
      if (status === 'eq.approved') {
        await fulfillJson(route, fixtures.claims.approved)
      } else if (status === 'eq.rejected') {
        await fulfillJson(route, fixtures.claims.rejected)
      } else {
        await fulfillJson(route, fixtures.claims.pending)
      }
      return
    }
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/rest/v1/site_editorial_features')) {
    if (method === 'GET') {
      await fulfillJson(route, fixtures.editorial)
      return
    }
    await fulfillJson(route, fixtures.editorial[0])
    return
  }

  if (path.includes('/rest/v1/site_editorial_feature_history')) {
    await fulfillJson(route, [])
    return
  }

  if (
    path.includes('/rest/v1/moderation_audit_log') ||
    path.includes('/rpc/fetch_moderation_audit')
  ) {
    await fulfillJson(route, fixtures.adminSession.auditLog)
    return
  }

  if (path.includes('/rest/v1/guest_share_tokens')) {
    const token = url.searchParams.get('token')
    if (token === 'eq.valid-showcase-token') {
      await fulfillJson(route, fixtures.guestTokens.valid)
    } else {
      await fulfillJson(route, fixtures.guestTokens.invalidResponse)
    }
    return
  }

  if (path.includes('/rest/v1/guest_identities')) {
    if (url.searchParams.get('select')?.includes('photo_claims')) {
      await fulfillJson(route, fixtures.guestTokens.identityWithClaims)
    } else {
      await fulfillJson(route, fixtures.guestTokens.identity)
    }
    return
  }

  if (path.includes('/rest/v1/activity_log')) {
    await fulfillJson(route, fixtures.activity)
    return
  }

  if (path.includes('/rest/v1/guest_pins')) {
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/rpc/get_guestbook_messages_with_comments')) {
    await fulfillJson(route, fixtures.guestbook.messages)
    return
  }

  if (path.includes('/rpc/submit_guestbook_message_with_rate_limit')) {
    await fulfillJson(route, fixtures.guestbook.submitResponse)
    return
  }

  if (path.includes('/rpc/')) {
    await fulfillJson(route, [])
    return
  }

  if (path.includes('/storage/v1/')) {
    await fulfillJson(route, { Key: 'mock-key' })
    return
  }

  await fulfillJson(route, [])
}

/** Scroll the whole document so lazy images/sections mount, then return to top. */
async function scrollThroughPage(page) {
  await page
    .evaluate(async () => {
      const step = Math.max(200, window.innerHeight * 0.8)
      for (let offset = 0; offset < document.body.scrollHeight; offset += step) {
        window.scrollTo(0, offset)
        await new Promise(resolve => setTimeout(resolve, 60))
      }
      window.scrollTo(0, 0)
      await new Promise(resolve => setTimeout(resolve, 120))
    })
    .catch(() => {})
}

/**
 * Runs in the page. Normalizes visible text the same way for every snapshot:
 * NBSP -> space, zero-width characters dropped, per-line trim, blank lines
 * dropped, internal whitespace collapsed.
 */
function collectSnapshot() {
  const normalize = value =>
    String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const textLines = element => {
    if (!element) return []
    return element.innerText
      .split(/\r?\n/)
      .map(line => normalize(line))
      .filter(Boolean)
  }

  const metaContent = selector => {
    const element = document.querySelector(selector)
    return element ? element.getAttribute('content') : null
  }

  const main = document.querySelector('main')

  const headings = [...document.querySelectorAll('main h1, main h2')]
    .map(element => ({
      level: Number(element.tagName.slice(1)),
      text: normalize(element.innerText),
    }))
    .filter(heading => heading.text)

  const seenLinks = new Set()
  const navLinks = []
  for (const anchor of document.querySelectorAll('header a, nav a, footer a')) {
    const text = normalize(anchor.innerText)
    const href = anchor.getAttribute('href') || ''
    if (!text || !href) continue
    const key = `${href}\u0000${text}`
    if (seenLinks.has(key)) continue
    seenLinks.add(key)
    navLinks.push({ text, href })
  }

  const seenImages = new Set()
  const images = []
  for (const image of document.querySelectorAll('main img')) {
    const src = image.getAttribute('src') || ''
    if (!src || seenImages.has(src)) continue
    seenImages.add(src)
    images.push(src)
  }

  return {
    title: document.title,
    lang: document.documentElement.lang || null,
    theme: document.documentElement.dataset.theme || null,
    meta: {
      description: metaContent('meta[name="description"]'),
      robots: metaContent('meta[name="robots"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      ogTitle: metaContent('meta[property="og:title"]'),
      ogDescription: metaContent('meta[property="og:description"]'),
      ogImage: metaContent('meta[property="og:image"]'),
      twitterTitle: metaContent('meta[name="twitter:title"]'),
      twitterImage: metaContent('meta[name="twitter:image"]'),
      structuredDataCount: document.querySelectorAll('script[data-seo-structured-data="true"]')
        .length,
    },
    headings,
    navLinks,
    images,
    mainText: textLines(main),
  }
}

async function captureRoute(browser, route, fixtures, ui, stubImage) {
  const snapshots = {}

  for (const viewportName of ['desktop', 'mobile']) {
    const viewport = ui.viewports[viewportName]
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: ui.deviceScaleFactor,
      reducedMotion: 'reduce',
      colorScheme: 'light',
      serviceWorkers: 'block',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    })

    await context.addInitScript(() => {
      window.__E2E__ = true
    })

    if (route.mode === 'admin') {
      await context.addInitScript(
        ({ key, session }) => {
          localStorage.setItem(key, JSON.stringify(session))
        },
        { key: fixtures.adminSession.storageKey, session: fixtures.adminSession.session }
      )
    }

    const page = await context.newPage()
    await page.clock.setFixedTime(new Date(ui.fixedNow))
    await installMocks(page, fixtures, route.mode, stubImage)

    try {
      await page.goto(`${BASE_URL}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
      await page
        .evaluate(async () => {
          if ('fonts' in document) await document.fonts.ready
        })
        .catch(() => {})
      await scrollThroughPage(page)
      await page.waitForTimeout(250)

      const snapshot = await page.evaluate(collectSnapshot)
      snapshots[viewportName] = { viewport, ...snapshot }
    } finally {
      await context.close()
    }
  }

  return snapshots
}

step('Capture rendered copy from the frozen legacy build')
info(`preview: ${BASE_URL}`)
await checkPreviewIsUp()

const ui = await readJson(repoPath('contracts', 'ui.json'))
if (!ui.fixedNow) die('rendered-copy: contracts/ui.json.fixedNow is required')
info(`fixedNow: ${ui.fixedNow}`)

const fixtures = await loadFixtures()
const stubImage = await readFile(
  repoPath('public', 'images', 'engagement', 'PoradaProposal-29.webp')
)

const selected = ROUTES.filter(route => (PRIORITY_ONLY ? route.priority === 1 : true)).sort(
  (left, right) => right.priority - left.priority
)

const browser = await chromium.launch({ headless: true })

try {
  for (const route of selected) {
    const snapshots = await captureRoute(browser, route, fixtures, ui, stubImage)
    const payload = {
      id: route.id,
      route: route.path,
      capturedFrom: FREEZE_TAG,
      fixedNow: ui.fixedNow,
      capture: {
        baseUrl: BASE_URL,
        build: `production build of ${FREEZE_TAG}`,
        reducedMotion: ui.reducedMotion,
        deviceScaleFactor: ui.deviceScaleFactor,
        colorScheme: 'light',
        timezone: 'America/New_York',
        locale: 'en-US',
        serviceWorkers: 'blocked',
        mocks: 'contracts/fixtures/*.json',
      },
      snapshots,
    }
    await writeContractJson(
      repoPath('contracts', 'content', 'rendered', `${route.id}.json`),
      payload
    )
    ok(`rendered/${route.id}.json (${snapshots.desktop.mainText.length} desktop text lines)`)
  }
} finally {
  await browser.close()
}

const readme = `# contracts/content/rendered/ — captured visitor truth

Generated by \`npm run content:copy\` (\`tools/extract-content/rendered-copy.mjs\`) against the frozen
legacy production build (\`${FREEZE_TAG}\`). Do not hand-edit: re-run the generator instead.

## What a snapshot contains

Per route, both viewports (\`desktop\`, \`mobile\` from \`contracts/ui.json\`):

- \`title\`, effective \`meta\` (description, robots, canonical, OG/Twitter) and
- \`mainText\`: normalized visible text of \`<main>\` (NBSP -> space, zero-width chars dropped,
  per-line trim, blank lines dropped, internal whitespace collapsed);
- \`headings\`: \`h1\`/\`h2\` text with levels;
- \`navLinks\`: header/nav/footer link text + href;
- \`images\`: \`src\` values of \`<main>\` images, DOM order, de-duplicated.

## Capture contract

- Preview base URL: \`LEGACY_PREVIEW_URL\` (the Lead owns the served frozen build; default
  \`http://127.0.0.1:4174\` is recorded per file under \`capture.baseUrl\`).
- Shared deterministic clock: \`contracts/ui.json.fixedNow\` via \`page.clock.setFixedTime\` — the
  same instant parity captures must use. Time-dependent copy (anniversary countdown, footer year)
  is only comparable when every harness freezes this value.
- \`reducedMotion=reduce\`, \`colorScheme=light\`, \`deviceScaleFactor\`, service workers blocked,
  locale \`en-US\`, timezone \`America/New_York\`.
- All Supabase/auth/media responses come from \`contracts/fixtures/*.json\`; analytics/Sentry and any
  other external host are aborted, so captures contact no production service.
- No screenshots and no media bytes are stored here: these files are text/metadata only.

Priority-1 routes are captured first (\`--priority\`) because the parity waves start there; the full
run then captures every route in \`contracts/routes.json\`.
`

await writeText(repoPath('contracts', 'content', 'rendered', 'README.md'), readme)
ok(`${selected.length} route snapshot(s) written to ${renderedContentDir}`)
