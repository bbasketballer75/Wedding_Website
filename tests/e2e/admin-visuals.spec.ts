import { expectAdminScreenshot, gotoAdminPage, test } from './support/adminSite'

test.describe('Admin Visuals', () => {
  test('admin dashboard — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin')
    await expectAdminScreenshot(page, 'admin-dashboard-desktop.png')
  })

  test('admin photos — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin/photos')
    await expectAdminScreenshot(page, 'admin-photos-desktop.png')
  })

  test('admin guestbook — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin/guestbook')
    await expectAdminScreenshot(page, 'admin-guestbook-desktop.png')
  })

  test('admin featured — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin/featured')
    await expectAdminScreenshot(page, 'admin-featured-desktop.png')
  })

  test('admin audit — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin/audit')
    await expectAdminScreenshot(page, 'admin-audit-desktop.png')
  })

  test('admin analytics — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin/analytics')
    await expectAdminScreenshot(page, 'admin-analytics-desktop.png')
  })

  test('admin settings — desktop', async ({ page }) => {
    await gotoAdminPage(page, '/admin/settings')
    await expectAdminScreenshot(page, 'admin-settings-desktop.png')
  })
})
