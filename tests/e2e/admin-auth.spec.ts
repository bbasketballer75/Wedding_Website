import { expect, gotoAdminPage, injectAdminSession, installAdminMocks, test, waitForPageReady } from './support/adminSite'

test.describe('Admin Auth', () => {
  test('login page renders form fields and submit button', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/admin/login')
    await waitForPageReady(page)

    await expect(page.locator('#admin-login-email')).toBeVisible()
    await expect(page.locator('#admin-login-password')).toBeVisible()
    await expect(page.getByTestId('admin-login-submit')).toBeVisible()
  })

  test('unauthenticated GET /admin redirects to /admin/login', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 })
    await installAdminMocks(page)
    await page.goto('/admin')
    await waitForPageReady(page)

    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('unauthenticated GET /admin/photos redirects to /admin/login', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 })
    await installAdminMocks(page)
    await page.goto('/admin/photos')
    await waitForPageReady(page)

    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('authenticated admin visiting /admin/login redirects to /admin', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 })
    await injectAdminSession(page)
    await installAdminMocks(page)
    await page.goto('/admin/login')
    await waitForPageReady(page)

    await expect(page).toHaveURL(/\/admin$/)
  })

  test('admin header shows signed-in email after auth', async ({ page }) => {
    await gotoAdminPage(page, '/admin')

    await expect(page.getByTestId('admin-header')).toContainText('admin@test.wedding')
  })

  test('sign-out button is visible when authenticated', async ({ page }) => {
    await gotoAdminPage(page, '/admin')

    await expect(page.getByTestId('admin-signout')).toBeVisible()
  })
})
