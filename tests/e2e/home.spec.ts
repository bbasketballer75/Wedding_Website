import {
  expect,
  expectVisibleFocus,
  expectSectionScreenshot,
  gotoPublicPage,
  pauseMedia,
  test,
  viewports,
} from './support/publicSite'

test.describe('Home Page', () => {
  test('keeps the bespoke home nav and lets keyboard users skip to main content', async ({
    page,
  }) => {
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

  test('routes first-viewport home nav links into the public experience', async ({ page }) => {
    await gotoPublicPage(page, '/')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

    const nav = page.getByTestId('home-nav')
    const filmLink = nav.getByRole('link', { name: 'Watch Film' })
    await expect(nav).toBeInViewport()
    await expect(filmLink).toBeInViewport()
    await filmLink.click()
    await expect(page).toHaveURL(/\/film$/)

    await gotoPublicPage(page, '/')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    const guestbookLink = page.getByTestId('home-nav').getByRole('link', { name: 'Guestbook' })
    await expect(guestbookLink).toBeInViewport()
    await guestbookLink.click()
    await expect(page).toHaveURL(/\/guestbook$/)
  })

  test('hero entry CTA scrolls into the welcome panel', async ({ page }) => {
    await gotoPublicPage(page, '/')

    await page.getByRole('button', { name: /Enter archive/i }).click()
    await expect(page.locator('#welcome-panel')).toBeInViewport()
  })

  test('hero renders from the poster instead of broken local video sources', async ({ page }) => {
    await gotoPublicPage(page, '/')

    const hero = page.getByTestId('home-hero')
    const poster = hero.locator('img[src$="/images/home/intro-video-poster.png"]')

    await expect(poster).toBeVisible()
    await expect(hero.locator('video')).toHaveCount(0)
    await expect
      .poll(() => poster.evaluate(image => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`home hero visual baseline (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/', viewport)
    await pauseMedia(page)
    await page.locator('[data-testid="home-hero"] video').evaluateAll(nodes => {
      for (const node of nodes) {
        const video = node as HTMLVideoElement
        video.pause()
        video.currentTime = 0
        video.style.opacity = '0'
        video.style.visibility = 'hidden'
      }
    })
    const hero = page.getByTestId('home-hero')
    // Wait for the hero element to be attached and stable before screenshotting
    await hero.waitFor({ state: 'attached', timeout: 10000 })
    await page.waitForTimeout(400)
    await expectSectionScreenshot(hero, `home-hero-${viewport}.png`)
  })
}
