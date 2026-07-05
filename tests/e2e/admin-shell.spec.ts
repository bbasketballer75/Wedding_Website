import { expect, gotoAdminPage, test } from './support/adminSite'

const adminRoutes = [
  '/admin',
  '/admin/photos',
  '/admin/guestbook',
  '/admin/featured',
  '/admin/audit',
  '/admin/analytics',
  '/admin/settings',
] as const

test.describe('Admin Shell', () => {
  // Smoke: every route loads
  for (const route of adminRoutes) {
    test(`@smoke ${route} loads`, async ({ page }) => {
      await gotoAdminPage(page, route)
      await expect(page.locator('body')).toBeVisible()
    })
  }

  test('admin header is visible on all routes', async ({ page }) => {
    for (const route of adminRoutes) {
      await gotoAdminPage(page, route)
      await expect(page.getByTestId('admin-header')).toBeVisible()
    }
  })

  test('header contains A & J Admin branding', async ({ page }) => {
    await gotoAdminPage(page, '/admin')
    await expect(page.getByTestId('admin-header')).toContainText('Admin')
  })

  test('desktop sidebar is visible at 1440px', async ({ page }) => {
    await gotoAdminPage(page, '/admin')
    await expect(page.getByTestId('admin-sidebar')).toBeVisible()
  })

  test('mobile nav bar is visible at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
    // Need to inject session + mocks at mobile viewport
    const { injectAdminSession, installAdminMocks, waitForPageReady } =
      await import('./support/adminSite')
    await injectAdminSession(page)
    await installAdminMocks(page)
    await page.goto('/admin')
    await waitForPageReady(page)

    await expect(page.getByTestId('admin-mobile-nav')).toBeVisible()
  })

  test('active nav item is highlighted in sidebar', async ({ page }) => {
    await gotoAdminPage(page, '/admin/guestbook')

    // Active sidebar link should have aria-current="page"
    const activeLink = page.getByTestId('admin-sidebar').locator('[aria-current="page"]')
    await expect(activeLink).toBeVisible()
    await expect(activeLink).toContainText('Guestbook')
  })

  test('sign-out button is present in header', async ({ page }) => {
    await gotoAdminPage(page, '/admin')
    await expect(page.getByTestId('admin-signout')).toBeVisible()
  })
})
