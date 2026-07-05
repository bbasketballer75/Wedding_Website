import {
  expect,
  expectSectionScreenshot,
  gotoPublicPage,
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

    const response = await page.request.get(trackSrc, {
      headers: {
        Origin: 'http://127.0.0.1:4174',
        Range: 'bytes=0-0',
      },
    })

    expect(response.status()).toBe(206)
    expect(response.headers()['access-control-allow-origin']).toBe('http://127.0.0.1:4174')
    expect(response.headers()['content-type']).toContain('text/vtt')
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
