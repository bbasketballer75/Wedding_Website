import { expectNoCriticalViolations, gotoAdminPage, test } from './support/adminSite'

const a11yRoutes = [
  '/admin',
  '/admin/photos',
  '/admin/guestbook',
  '/admin/featured',
  '/admin/audit',
  '/admin/analytics',
  '/admin/settings',
] as const

test.describe('Admin Accessibility', () => {
  for (const route of a11yRoutes) {
    test(`no critical a11y violations on ${route}`, async ({ page }) => {
      await gotoAdminPage(page, route)
      await expectNoCriticalViolations(page)
    })
  }
})
