/**
 * Stack-neutral browser preparation and network mocks.
 *
 * Ported from `tests/e2e/support/publicSite.ts` + `adminSite.ts`, but without
 * any app imports: the harness only knows URLs, HTTP verbs and JSON payloads.
 * The point is that the future rebuild is captured under exactly the same
 * deterministic environment as the frozen legacy oracle:
 *
 *  - theme is seeded through the persisted UI store before app scripts run
 *  - `window.__E2E__` is set (legacy e2e contract)
 *  - service worker registration is neutralised (the built PWA reloads the tab)
 *  - media playback is forced paused/muted at t=0
 *  - Supabase REST/RPC/Auth, the media CDN, R2 presign and the Netlify
 *    guest-upload function are answered from contracts/fixtures
 *  - same-origin assets (the served build itself) always pass through untouched
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { HarnessError, ROOT, pathExists, sha256 } from '../util.mjs'
import { supabaseProjectRef } from './fixtures.mjs'

/** The legacy app's production media CDN host (see playwright.config.ts). */
export const MEDIA_HOSTS = ['media.wedding.theporadas.com']

/** One fixed, git-tracked media asset stands in for every CDN image. */
export const MEDIA_STUB_PATH = 'public/images/engagement/PoradaProposal-29.webp'

export const UI_STORE_KEY = 'ui-store'

const IMAGE_CONTENT_TYPES = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  gif: 'image/gif',
}

const VIDEO_AUDIO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'm3u8',
  'mpd',
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'aac',
])
const FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot'])
const SCRIPT_EXTENSIONS = new Set(['js', 'mjs', 'cjs'])

const JSON_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json',
}

export const MEDIA_VTT_FIXTURE = {
  status: 206,
  contentType: 'text/vtt',
  body: 'WEBVTT\n\n00:00.000 --> 00:01.000\n[e2e captions stub]\n',
}

let mediaStubCache = null

export async function loadMediaStub({ root = ROOT } = {}) {
  if (mediaStubCache) return mediaStubCache
  const file = path.join(root, MEDIA_STUB_PATH)
  if (!(await pathExists(file))) {
    throw new HarnessError(
      `Media stub is missing: ${MEDIA_STUB_PATH}. The parity harness must not download or copy media.`
    )
  }
  const buffer = await fs.readFile(file)
  mediaStubCache = {
    file,
    buffer,
    sha256: sha256(buffer),
    contentType: 'image/webp',
  }
  return mediaStubCache
}

export function adminSessionStorageKey({ fixtures, root = ROOT } = {}) {
  const fromFixture = fixtures?.admin?.storageKey
  if (fromFixture) return fromFixture
  return `sb-${supabaseProjectRef({ root })}-auth-token`
}

/**
 * Init script injected before any app code. Runs before the first byte of the
 * app bundle, so the persisted theme is already correct on first render.
 */
function browserInitScript(input) {
  const { theme, mode, storageKey, sessionJson } = input
  window.__E2E__ = true
  try {
    localStorage.setItem(
      'ui-store',
      JSON.stringify({
        state: {
          currentTheme: theme,
          preferences: { musicEnabled: false, animationsEnabled: true, autoPlayVideos: false },
        },
        version: 0,
      })
    )
  } catch {
    /* storage unavailable */
  }
  if (mode === 'admin' && storageKey && sessionJson) {
    try {
      localStorage.setItem(storageKey, sessionJson)
    } catch {
      /* storage unavailable */
    }
  }
  // Deterministic PWA: the built app registers a skipWaiting/clientsClaim
  // service worker that reloads the tab shortly after load.
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
    /* serviceWorker unavailable (non-secure origin) */
  }
  // Media must never play during a capture: pause everything at t=0 and stop
  // any later play() attempt (scroll-triggered autoplay included).
  try {
    const stop = element => {
      try {
        element.pause()
        element.muted = true
        element.currentTime = 0
      } catch {
        /* not a media element yet */
      }
    }
    const sweep = rootElement => {
      if (!rootElement?.querySelectorAll) return
      for (const element of rootElement.querySelectorAll('video, audio')) stop(element)
    }
    HTMLMediaElement.prototype.play = function play() {
      stop(this)
      return Promise.resolve()
    }
    const start = () => {
      sweep(document)
      const observer = new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue
            if (node.matches?.('video, audio')) stop(node)
            sweep(node)
          }
        }
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true })
    } else {
      start()
    }
  } catch {
    /* media APIs unavailable */
  }
}

export async function preparePage(page, { theme, mode = 'public', fixtures, root = ROOT } = {}) {
  const storageKey = mode === 'admin' ? adminSessionStorageKey({ fixtures, root }) : ''
  const session = fixtures?.admin?.session ?? null
  await page.addInitScript(browserInitScript, {
    theme,
    mode,
    storageKey,
    sessionJson: session ? JSON.stringify(session) : '',
  })
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: theme === 'light' ? 'light' : 'dark',
  })
}

function fulfillJson(route, payload, status = 200) {
  return route.fulfill({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })
}

function isSupabaseRequest(url, baseOrigin) {
  if (url.hostname.includes('supabase')) return true
  if (url.origin === baseOrigin) return false
  return /^\/(rest|rpc|auth|storage)\/v\d+\//.test(url.pathname)
}

function supabasePublicResponse({ request, url, fixtures }) {
  const path = url.pathname
  const method = request.method()
  const guestbook = fixtures.guestbook ?? { messages: [] }
  const uploads = fixtures.guestUploads ?? { approved: [] }
  const tokens = fixtures.guestTokens ?? {}

  if (path.includes('/rest/v1/photos')) return { body: fixtures.photos ?? [] }
  if (path.includes('/rpc/get_guestbook_messages_with_comments'))
    return { body: guestbook.messages }
  if (path.includes('/rpc/submit_guestbook_message_with_rate_limit')) {
    return { body: guestbook.submitResponse }
  }
  if (path.includes('/rpc/get_guest_contributions')) {
    // D-02: the rebuild's guest-share page uses this SECURITY DEFINER aggregate
    // instead of the old public table reads. Build the same payload the frozen
    // page effectively sees from the fixtures (valid token => full showcase,
    // anything else => null so the frozen "unresolved link" state renders).
    let token = ''
    try {
      token = JSON.parse(request.postData() ?? '{}')?.p_token ?? ''
    } catch {
      token = ''
    }
    const invalidToken = tokens.invalidToken ?? 'invalid-token'
    if (!tokens.valid || token === '' || token === invalidToken) return { body: null }
    return {
      body: {
        token: tokens.valid,
        identity: {
          id: tokens.identityWithClaims?.id ?? 'identity-jane',
          display_name: tokens.identity?.display_name ?? 'Jane Miller',
          photo_claims: tokens.identityWithClaims?.photo_claims ?? [],
        },
        uploads: uploads.approved,
        guestbook: guestbook.messages,
      },
    }
  }
  if (path.includes('/rpc/resolve_guest_identity')) {
    return {
      body: {
        id: tokens.identityWithClaims?.id ?? 'identity-jane',
        display_name: tokens.identity?.display_name ?? 'Jane Miller',
        email: tokens.valid?.guest_email ?? 'jane@example.com',
        is_verified: false,
      },
    }
  }
  if (path.includes('/rpc/get_or_create_share_token')) {
    return { body: 'parity-guest-share-token' }
  }
  if (path.includes('/rest/v1/guestbook_messages') && method === 'GET') {
    return { body: guestbook.messages }
  }
  if (path.includes('/rest/v1/guestbook_messages') && method === 'PATCH') return { body: [] }
  if (path.includes('/rest/v1/guestbook_comments') && method === 'POST') return { body: [] }
  if (path.includes('/rest/v1/guest_uploads') && method === 'GET') return { body: uploads.approved }
  if (path.includes('/rest/v1/guest_uploads') && method === 'POST') {
    return { body: uploads.insertResponse, status: 201 }
  }
  if (path.includes('/rest/v1/guest_share_tokens')) {
    const tokenParam = url.searchParams.get('token') ?? ''
    const invalidToken = tokens.invalidToken ?? 'invalid-token'
    if (tokenParam === invalidToken || tokenParam === `eq.${invalidToken}`) {
      return { body: tokens.invalidResponse ?? null }
    }
    return { body: tokens.valid ?? null }
  }
  if (path.includes('/rest/v1/guest_identities')) {
    if ((url.searchParams.get('select') ?? '').includes('photo_claims')) {
      return { body: tokens.identityWithClaims ?? {} }
    }
    return { body: tokens.identity ?? {} }
  }
  if (path.includes('/rest/v1/activity_log')) return { body: fixtures.activity ?? [] }
  return { body: [] }
}

function supabaseAdminResponse({ request, url, fixtures }) {
  const path = url.pathname
  const method = request.method()
  const admin = fixtures.admin ?? {}
  const counts = admin.dashboardCounts ?? {}
  const uploads = fixtures.guestUploads ?? { approved: [], pending: [] }
  const guestbook = fixtures.guestbook ?? { messages: [] }
  const claims = fixtures.claims ?? { pending: [], approved: [], rejected: [] }
  const editorial = fixtures.editorial ?? []

  if (path.includes('/auth/v1/user')) return { body: admin.user }
  if (path.includes('/auth/v1/token')) return { body: admin.session }
  if (path.includes('/auth/v1/logout')) return { body: {} }

  if (path.includes('/rest/v1/guest_uploads')) {
    if (method === 'GET') {
      if (url.search.includes('count')) return { body: counts.pendingUploads ?? [] }
      return { body: uploads.pending ?? [] }
    }
    return { body: [] }
  }
  if (path.includes('/rest/v1/guestbook_messages')) {
    if (method === 'GET') {
      if (url.search.includes('count')) return { body: counts.guestbookMessages ?? [] }
      return { body: guestbook.adminMessages ?? guestbook.messages }
    }
    return { body: [] }
  }
  if (path.includes('/rest/v1/photos')) {
    if (method === 'GET') {
      if (url.search.includes('count')) return { body: counts.photos ?? [] }
      return { body: fixtures.photos ?? [] }
    }
    return { body: [] }
  }
  if (path.includes('/rest/v1/photo_claims')) {
    if (method === 'GET') {
      const idParam = url.searchParams.get('id')
      if (idParam === 'eq.claim-pending-1') return { body: claims.pending?.[0] ?? [] }
      const statusParam = url.searchParams.get('status')
      if (statusParam === 'eq.approved') return { body: claims.approved ?? [] }
      if (statusParam === 'eq.rejected') return { body: claims.rejected ?? [] }
      return { body: claims.pending ?? [] }
    }
    return { body: [] }
  }
  if (path.includes('/rest/v1/site_editorial_features')) {
    if (method === 'GET') return { body: editorial.slice(0, 1) }
    return { body: editorial[0] ?? {} }
  }
  if (path.includes('/rest/v1/site_editorial_feature_history')) return { body: [] }
  if (
    path.includes('/rest/v1/moderation_audit_log') ||
    path.includes('/rpc/fetch_moderation_audit')
  ) {
    return { body: admin.auditLog ?? [] }
  }
  if (path.includes('/rpc/')) return { body: [] }
  if (path.includes('/storage/v1/')) return { body: { Key: 'mock-key' } }
  return { body: [] }
}

/**
 * Install the deterministic network layer on one page.
 * `state` carries the request counter used by the guest-upload retry contract.
 */
export function createMockState() {
  return { uploadAttempt: 0 }
}

export async function installNetworkMocks(
  page,
  {
    baseUrl,
    mode = 'public',
    fixtures = {},
    mediaStub,
    mediaHosts = MEDIA_HOSTS,
    state = createMockState(),
  }
) {
  const baseOrigin = new URL(baseUrl).origin
  const stub = mediaStub ?? (await loadMediaStub())
  const stubHosts = new Set(mediaHosts)

  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())

    // CORS preflight for any mocked origin (Supabase REST/RPC, media CDN).
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...JSON_HEADERS,
          'access-control-allow-origin': request.headers().origin ?? '*',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        },
      })
      return
    }

    // Main film captions live on the media CDN in production; answer locally
    // while preserving the 206 + text/vtt + CORS contract the <track> needs.
    if (url.pathname.endsWith('/video/main.vtt')) {
      await route.fulfill({
        status: MEDIA_VTT_FIXTURE.status,
        headers: {
          'access-control-allow-origin': request.headers().origin ?? '*',
          'content-type': MEDIA_VTT_FIXTURE.contentType,
        },
        body: MEDIA_VTT_FIXTURE.body,
      })
      return
    }

    // Netlify guest-upload presign function (same origin as the app).
    if (url.pathname.includes('/guest-upload-url')) {
      state.uploadAttempt += 1
      if (state.uploadAttempt === 2) {
        await route.fulfill({
          status: 500,
          headers: JSON_HEADERS,
          body: 'Server configuration error',
        })
        return
      }
      await fulfillJson(route, {
        uploadUrl: `https://mock-r2.example.com/guest-uploads/photos/mock-${state.uploadAttempt}.png`,
        publicUrl: `https://mock-r2.example.com/guest-uploads/photos/mock-${state.uploadAttempt}.png`,
      })
      return
    }

    // R2 presigned PUT destination.
    if (url.hostname === 'mock-r2.example.com') {
      await route.fulfill({ status: 200, body: '' })
      return
    }

    if (isSupabaseRequest(url, baseOrigin)) {
      const handler = mode === 'admin' ? supabaseAdminResponse : supabasePublicResponse
      const result = handler({ request, url, fixtures })
      await fulfillJson(route, result.body, result.status ?? 200)
      return
    }

    // Same-origin assets are the served build itself: always real bytes.
    if (url.origin === baseOrigin) {
      await route.continue()
      return
    }

    const extension = url.pathname.split('.').pop()?.toLowerCase() ?? ''

    // Remote media CDN: fixed local image stub for images (pixel-stable), and
    // no bytes for video/audio (playback is frozen anyway) so no third-party
    // host is ever contacted.
    if (stubHosts.has(url.hostname)) {
      const imageType = IMAGE_CONTENT_TYPES[extension]
      if (imageType) {
        await route.fulfill({
          status: 200,
          headers: {
            'access-control-allow-origin': request.headers().origin ?? '*',
            'content-type': imageType,
            'cache-control': 'no-store',
          },
          body: stub.buffer,
        })
        return
      }
      if (VIDEO_AUDIO_EXTENSIONS.has(extension)) {
        await route.fulfill({
          status: 204,
          headers: { 'access-control-allow-origin': request.headers().origin ?? '*' },
        })
        return
      }
      await route.fulfill({ status: 204, body: '' })
      return
    }

    // Any other third-party host (analytics, Sentry, font CDNs) is isolated:
    // empty JS for scripts, no bytes otherwise. No request leaves the machine.
    if (SCRIPT_EXTENSIONS.has(extension)) {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/javascript' },
        body: '',
      })
      return
    }
    if (FONT_EXTENSIONS.has(extension)) {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    await route.fulfill({ status: 204, body: '' })
  })
}
