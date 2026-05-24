import {
  expect,
  expectNoCriticalViolations,
  expectVisibleFocus,
  gotoPublicPage,
  test,
} from './support/publicSite'

const defaultRoutes = [
  '/',
  '/film',
  '/gallery',
  '/upload',
  '/guestbook',
  '/people',
  '/guest-photos',
]

test.describe('Public Route Accessibility', () => {
  for (const route of defaultRoutes) {
    test(`has no critical axe violations on ${route}`, async ({ page }) => {
      await gotoPublicPage(page, route)
      await expectNoCriticalViolations(page)
    })
  }

  test('skip link and primary navigation are keyboard reachable with visible focus', async ({
    page,
  }) => {
    await gotoPublicPage(page, '/')

    // Step 1: skip link is always the first Tab stop regardless of nav state
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skipLink).toBeVisible()
    await expectVisibleFocus(skipLink)

    // Step 2: the home-nav is aria-hidden while the hero is visible and showUI=false.
    // Scroll past the hero and wait for it to become interactive before testing keyboard reach.
    await page.waitForTimeout(1400) // let showUI timer fire (1200ms delay)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2.5))
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="home-nav"]')
        return (
          el &&
          el.getAttribute('aria-hidden') !== 'true' &&
          window.getComputedStyle(el).pointerEvents !== 'none'
        )
      },
      { timeout: 8000 }
    )

    // Tab once more — the A&J logo link should now be the first nav Tab stop
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
    await expect(page.getByRole('button', { name: 'Close composer' }).first()).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
