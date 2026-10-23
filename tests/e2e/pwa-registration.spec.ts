/**
 * PWA registration guard — the one public-suite test that does NOT neutralise
 * `navigator.serviceWorker`.
 *
 * Every other public test stubs registration because the production build's
 * `autoUpdate` service worker reloads the tab shortly after first load and that
 * reload races axe runs, focus and typed input (see preparePublicPage in
 * support/publicSite.ts). That neutralisation is right for determinism but left
 * the reload behaviour itself uncovered: a pathological reload loop would be
 * invisible to the suite.
 *
 * This test covers exactly that narrow property against the LOCAL PREVIEW
 * build: registration happens, the document settles within the known
 * autoUpdate reload (at most two document loads), and no further reload occurs.
 * Supabase/media requests are mocked as in the rest of the suite; it makes no
 * writes.
 *
 * It does NOT verify the production service worker, offline caching, update
 * propagation, or any hosted behaviour. Those remain explicit coverage gaps.
 */
import { expect, test } from '@playwright/test'
import { installPublicSiteMocks } from './support/publicSite'

/** The autoUpdate handler is allowed exactly one post-load reload. */
const MAX_DOCUMENT_LOADS = 2

test('service worker registration settles without reloading in a loop', async ({ page }) => {
  // Count real document requests, not `framenavigated` (which also fires for
  // same-document router updates and would inflate the count).
  let documentLoads = 0
  page.on('request', request => {
    if (request.resourceType() === 'document' && request.frame() === page.mainFrame()) {
      documentLoads += 1
    }
  })

  await installPublicSiteMocks(page)
  await page.goto('/gallery')
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

  // Let the autoUpdate reload (if any) and the registration settle.
  await page.waitForTimeout(6000)
  const settledLoads = documentLoads
  expect(settledLoads).toBeGreaterThanOrEqual(1)
  expect(
    settledLoads,
    `document loads after registration: ${settledLoads}; expected ${MAX_DOCUMENT_LOADS} or fewer`
  ).toBeLessThanOrEqual(MAX_DOCUMENT_LOADS)

  // The registration is real (no noop stub in this spec).
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          return {
            registered: Boolean(registration),
            controlling: Boolean(navigator.serviceWorker.controller),
            scriptUrl: registration?.active?.scriptURL ?? '',
          }
        }),
      { timeout: 15_000, message: 'service worker did not register in a fresh context' }
    )
    .toMatchObject({ registered: true })

  const scriptUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.scriptURL ?? ''
  })
  expect(scriptUrl).toContain('/sw.js')

  // Bounded: once settled, no further document loads may occur.
  await page.waitForTimeout(4000)
  expect(
    documentLoads,
    `service worker kept reloading after settling: ${documentLoads} loads`
  ).toBe(settledLoads)
})
