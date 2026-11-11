/**
 * Deterministic network mocks for runtime perf runs.
 *
 * Same rationale as the parity harness (docs/rebuild/PARITY.md "Assets" row):
 * a perf number is only comparable across runs if the same bytes are served.
 * The greenfield build is currently a parity-env build whose Supabase URL points
 * at an unroutable placeholder and whose media base is the production CDN, so
 * the harness:
 *
 *   - same-origin static assets (JS/CSS/fonts) -> real bytes from the served build;
 *   - Supabase REST/auth/gateway -> deterministic empty JSON (100% local, no DNS);
 *   - images (any host) -> one fixed 1x1 PNG stub (git-tracked? no: generated inline);
 *   - video/audio -> aborted (the parity harness also serves no bytes);
 *   - every other external host -> aborted (analytics/Sentry/font CDN never leave the machine).
 *
 * `--no-mocks` disables this and lets the page hit the real network (only useful
 * for debugging the harness itself; numbers then include third-party variance).
 */

/** 1x1 transparent PNG (67 bytes, generated inline — no media is copied into the repo). */
export const STUB_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i
const VIDEO_AUDIO_EXTENSION = /\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg|oga|vtt|m3u8)$/i
const SUPABASE_HOST = /(^|\.)supabase\.(co|in)$/i

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range, content-length',
  'cache-control': 'no-store',
}

const IMAGE_HEADERS = {
  'content-type': 'image/png',
  'access-control-allow-origin': '*',
  'cache-control': 'no-store',
}

function isLocalHost(hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
}

function isSupabaseHost(hostname) {
  return SUPABASE_HOST.test(hostname)
}

/**
 * Build the Playwright route handler used for every measured run.
 * @param {{stats?: Record<string, number>}} [options]
 */
export function createMockHandler({ stats } = {}) {
  const counters = stats ?? { realAssets: 0, supabase: 0, images: 0, blocked: 0 }

  return async function mockHandler(route) {
    const request = route.request()
    const url = new URL(request.url())

    if (isSupabaseHost(url.hostname)) {
      counters.supabase += 1
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: JSON_HEADERS, body: '' })
        return
      }
      // Empty result: list queries render the app's empty/fallback states; single
      // queries get the same empty body and the data layer reports "not found".
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' })
      return
    }

    if (IMAGE_EXTENSION.test(url.pathname)) {
      counters.images += 1
      await route.fulfill({ status: 200, headers: IMAGE_HEADERS, body: STUB_PNG })
      return
    }

    if (VIDEO_AUDIO_EXTENSION.test(url.pathname)) {
      counters.blocked += 1
      await route.abort()
      return
    }

    if (isLocalHost(url.hostname)) {
      counters.realAssets += 1
      await route.continue()
      return
    }

    counters.blocked += 1
    await route.abort()
  }
}

/** Resource classification by URL path/extension, used for transfer-by-type totals. */
export function classifyResource(url) {
  const pathname = new URL(url).pathname
  if (IMAGE_EXTENSION.test(pathname)) return 'image'
  if (VIDEO_AUDIO_EXTENSION.test(pathname)) return 'media'
  if (/\.(woff2?|ttf|otf|eot)$/i.test(pathname)) return 'font'
  if (/\.css$/i.test(pathname)) return 'css'
  if (/\.js$/i.test(pathname) || /\.mjs$/i.test(pathname)) return 'script'
  if (/\.html?$/i.test(pathname)) return 'document'
  return 'other'
}
