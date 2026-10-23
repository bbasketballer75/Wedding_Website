/**
 * Opt-in live contract for the production media CDN's captions response.
 *
 * The public suite answers `/video/main.vtt` from a local fixture, so it cannot
 * detect a CDN CORS/cache regression. This spec is the missing real check:
 * one read-only GET of the public captions file, from a real browser and from
 * a non-browser client, asserting the headers the `<track>` element depends on.
 *
 * Read-only by construction: GET/HEAD only, no auth, no uploads, no Supabase,
 * no writes of any kind. It is skipped unless explicitly enabled so the mocked
 * suites stay network-isolated.
 *
 * Run (needs a browser, no dev server):
 *   E2E_LIVE_MEDIA_CORS=1 npm run test:live:media-cors
 *
 * What it does NOT prove: the CDN's behaviour from every region/pop, offline
 * caching, or the service worker. Those remain explicit coverage gaps.
 */
import { expect, test } from '@playwright/test'

const MEDIA_URL = 'https://media.wedding.theporadas.com/video/main.vtt'
const SITE_ORIGIN = 'https://www.theporadas.com'
const LIVE = process.env.E2E_LIVE_MEDIA_CORS === '1'

/** ACAO may echo the requesting origin or allow any origin. */
function allowedOrigin(header: string | undefined): boolean {
  return header === '*' || header === SITE_ORIGIN
}

test.describe('@live-cors production media captions contract', () => {
  test.skip(!LIVE, 'read-only live CDN check; set E2E_LIVE_MEDIA_CORS=1 to run it explicitly')

  test('CDN answers a ranged GET with CORS, vtt type and cache/range headers', async ({
    request,
  }) => {
    const response = await request.get(MEDIA_URL, {
      headers: { Origin: SITE_ORIGIN, Range: 'bytes=0-5' },
    })

    expect([200, 206]).toContain(response.status())

    // Headers come from the actual CDN response, never from a fixture.
    const headers = response.headers()
    const body = await response.text()

    expect(headers['content-type']).toContain('text/vtt')
    expect(allowedOrigin(headers['access-control-allow-origin'])).toBe(true)
    expect(headers['accept-ranges']).toBe('bytes')
    expect(headers['cache-control']).toMatch(/max-age=\d+/)
    expect((headers['vary'] ?? '').toLowerCase()).toContain('origin')
    expect(body).toContain('WEBVTT')

    if (response.status() === 206) {
      expect(headers['content-range']).toMatch(/^bytes 0-5\//)
      expect(headers['content-length']).toBe('6')
      expect(body).toHaveLength(6)
    }
  })

  test('a browser on the production origin can fetch the captions across origins', async ({
    page,
  }) => {
    await page.goto(`${SITE_ORIGIN}/film`, { waitUntil: 'domcontentloaded' })

    const [response, fetched] = await Promise.all([
      page.waitForResponse(
        candidate =>
          candidate.url() === MEDIA_URL &&
          (candidate.request().headers()['range'] ?? '').startsWith('bytes=0-5'),
        { timeout: 30_000 }
      ),
      page.evaluate(async url => {
        // Resolves only when CORS allows the site origin — the browser-enforced
        // half of the contract.
        const result = await fetch(url, {
          headers: { Range: 'bytes=0-5' },
          cache: 'no-store',
        })
        return {
          status: result.status,
          contentType: result.headers.get('content-type'),
          text: await result.text(),
        }
      }, MEDIA_URL),
    ])

    expect([200, 206]).toContain(fetched.status)
    expect(fetched.contentType).toContain('text/vtt')
    expect(fetched.text).toContain('WEBVTT')

    // Network-layer headers of the real browser request (JS cannot read ACAO).
    const headers = await response.allHeaders()
    expect(allowedOrigin(headers['access-control-allow-origin'])).toBe(true)
    expect(headers['content-type']).toContain('text/vtt')
    expect(headers['accept-ranges']).toBe('bytes')
    expect(headers['cache-control']).toMatch(/max-age=\d+/)
  })
})
