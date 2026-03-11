import { expect, expectSectionScreenshot, gotoPublicPage, pauseMedia, test, viewports } from './support/publicSite'

test.describe('Film Page', () => {
  test('watch now scrolls to the player section', async ({ page }) => {
    await gotoPublicPage(page, '/film')

    await page.getByRole('button', { name: 'Watch Now' }).click()
    await expect(page.getByTestId('film-player-section')).toBeInViewport()
  })

  test('chapter quick links jump the film player and upload CTA navigates correctly', async ({ page }) => {
    await gotoPublicPage(page, '/film')

    await page.getByRole('button', { name: /25:37 The Ceremony/i }).click()
    await page.waitForTimeout(600)

    const currentTime = await page.locator('#wedding-film-player video').evaluate((node) => {
      const video = node as HTMLVideoElement
      return video.currentTime
    })

    expect(currentTime).toBeGreaterThanOrEqual(1536)

    await page.getByRole('link', { name: 'Share Your Angle' }).click()
    await expect(page).toHaveURL(/\/upload$/)
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`film visual baselines (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/film', viewport)
    await pauseMedia(page)
    await expectSectionScreenshot(page.getByTestId('film-hero'), `film-hero-${viewport}.png`)
    await expectSectionScreenshot(page.getByTestId('film-player-section'), `film-player-${viewport}.png`)
  })
}
