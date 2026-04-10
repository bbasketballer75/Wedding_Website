import { expect, expectNoCriticalViolations, expectVisibleFocus, gotoPublicPage, test } from './support/publicSite'

const defaultRoutes = ['/', '/film', '/gallery', '/upload', '/guestbook', '/people', '/guest-photos']

test.describe('Public Route Accessibility', () => {
  for (const route of defaultRoutes) {
    test(`has no critical axe violations on ${route}`, async ({ page }) => {
      await gotoPublicPage(page, route)
      await expectNoCriticalViolations(page)
    })
  }

  test('skip link and primary navigation are keyboard reachable with visible focus', async ({ page }) => {
    await gotoPublicPage(page, '/')

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skipLink).toBeVisible()
    await expectVisibleFocus(skipLink)

    await page.keyboard.press('Tab')
    const homeNavLink = page.getByTestId('home-nav').getByRole('link', { name: 'A&J' })
    await expectVisibleFocus(homeNavLink)
  })

  test('gallery and guestbook controls expose correct aria states', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')
    const timelineToggle = page.getByRole('button', { name: 'Timeline' })
    await timelineToggle.click()
    await expect(timelineToggle).toHaveAttribute('aria-pressed', 'true')

    await gotoPublicPage(page, '/guestbook')
    const composerToggle = page.getByRole('button', { name: 'Start your message' })
    await composerToggle.click()
    await expect(page.getByRole('button', { name: 'Close composer' }).first()).toHaveAttribute('aria-expanded', 'true')

    const videoFilter = page.getByTestId('guestbook-filters').getByRole('button', { name: /^Video\b/i })
    await videoFilter.click()
    await expect(videoFilter).toHaveAttribute('aria-pressed', 'true')
  })
})
