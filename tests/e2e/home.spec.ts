import { expect, expectVisibleFocus, expectSectionScreenshot, gotoPublicPage, pauseMedia, test, viewports } from './support/publicSite'

test.describe('Home Page', () => {
  test('keeps the bespoke home nav and lets keyboard users skip to main content', async ({ page }) => {
    await gotoPublicPage(page, '/')

    await expect(page.getByTestId('home-nav')).toBeVisible()
    await expect(page.getByTestId('public-header')).toHaveCount(0)

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skipLink).toBeVisible()
    await expectVisibleFocus(skipLink)

    await skipLink.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('routes top-level home nav links into the public experience', async ({ page }) => {
    await gotoPublicPage(page, '/')
    // The home-nav becomes interactive only after scrolling past the hero
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5))
    await page.waitForTimeout(600)

    await page.getByTestId('home-nav').getByRole('link', { name: 'Watch Film' }).click()
    await expect(page).toHaveURL(/\/film$/)

    await gotoPublicPage(page, '/')
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5))
    await page.waitForTimeout(600)
    await page.getByTestId('home-nav').getByRole('link', { name: 'Guestbook' }).click()
    await expect(page).toHaveURL(/\/guestbook$/)
  })

  test('hero explore CTA scrolls into the welcome panel', async ({ page }) => {
    await gotoPublicPage(page, '/')

    await page.getByRole('button', { name: /Explore/i }).click()
    await expect(page.locator('#welcome-panel')).toBeInViewport()
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`home hero visual baseline (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/', viewport)
    await pauseMedia(page)
    await page.locator('[data-testid="home-hero"] video').evaluateAll((nodes) => {
      for (const node of nodes) {
        const video = node as HTMLVideoElement
        video.pause()
        video.currentTime = 0
        video.style.opacity = '0'
        video.style.visibility = 'hidden'
      }
    })
    await expectSectionScreenshot(page.getByTestId('home-hero'), `home-hero-${viewport}.png`)
  })
}
