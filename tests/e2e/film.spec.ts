import {
  expect,
  expectSectionScreenshot,
  gotoPublicPage,
  MEDIA_VTT_FIXTURE,
  mediaVttFixtureHeaders,
  pauseMedia,
  test,
  viewports,
} from './support/publicSite'

test.describe('Film Page', () => {
  test('watch now scrolls to the player section', async ({ page }) => {
    await gotoPublicPage(page, '/film')

    await page.getByRole('button', { name: 'Watch Now' }).click()
    await expect(page.getByTestId('film-player-section')).toBeInViewport()
  })

  test('chapter quick links jump the film player and upload CTA navigates correctly', async ({
    page,
  }) => {
    await gotoPublicPage(page, '/film')

    await page.getByRole('button', { name: /25:37 The Ceremony/i }).click()
    await page.waitForTimeout(600)

    const currentTime = await page
      .locator('#wedding-film-player video:not([aria-hidden])')
      .evaluate(node => {
        const video = node as HTMLVideoElement
        return video.currentTime
      })

    expect(currentTime).toBeGreaterThanOrEqual(1536)

    await page.getByRole('link', { name: 'Share Your Angle' }).click()
    await expect(page).toHaveURL(/\/upload$/)
  })

  test('main film keeps poster/preload settings and loads captions from media host', async ({
    page,
  }) => {
    await gotoPublicPage(page, '/film')

    const video = page.locator('#wedding-film-player video:not([aria-hidden])')
    await expect(video).toHaveAttribute('poster', /\/images\/film\/main-film-poster\.png$/)
    await expect(video).toHaveAttribute('preload', 'metadata')

    const trackSrc = await video.locator('track[kind="captions"]').getAttribute('src')
    if (!trackSrc) {
      throw new Error('Main film captions track is missing a src attribute.')
    }

    expect(trackSrc).toContain('media.wedding.theporadas.com/video/main.vtt')

    // The request below is answered by the deterministic MEDIA_VTT_FIXTURE in
    // tests/e2e/support/publicSite.ts, never by the CDN. The cross-origin fetch
    // resolving proves the FIXTURE's CORS header is coherent (a missing
    // Access-Control-Allow-Origin would make the browser reject it); it is not
    // evidence that the production CDN still sends CORS. ACAO itself is not
    // readable from JS (it is not a CORS-safelisted response header), so the
    // real contract is checked from the network layer, opt-in and read-only, in
    // tests/e2e-live/media-cors-contract.spec.ts (E2E_LIVE_MEDIA_CORS=1).
    const captions = await page.evaluate(async src => {
      const response = await fetch(src, { headers: { Range: 'bytes=0-0' } })
      return {
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: await response.text(),
      }
    }, trackSrc)

    // Pin the fixture contract by name so a change to the stub cannot quietly
    // weaken what this deterministic test claims to cover.
    expect(mediaVttFixtureHeaders('https://www.theporadas.com')).toMatchObject({
      'access-control-allow-origin': 'https://www.theporadas.com',
      'content-type': MEDIA_VTT_FIXTURE.contentType,
    })
    expect(captions.status).toBe(MEDIA_VTT_FIXTURE.status)
    expect(captions.contentType).toContain(MEDIA_VTT_FIXTURE.contentType)
    expect(captions.body).toContain('WEBVTT')
    expect(captions.body).toContain('[e2e captions stub]')
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`film visual baselines (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/film', viewport)
    await pauseMedia(page)
    await expectSectionScreenshot(page.getByTestId('film-hero'), `film-hero-${viewport}.png`)
    await expectSectionScreenshot(
      page.getByTestId('film-player-section'),
      `film-player-${viewport}.png`
    )
  })
}
