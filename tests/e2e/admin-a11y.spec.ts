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

// Routes with async data fetches that need extra settling time before axe scan
const asyncDataRoutes = new Set(['/admin', '/admin/guestbook', '/admin/photos', '/admin/audit'])

test.describe('Admin Accessibility', () => {
  for (const route of a11yRoutes) {
    test(`no critical a11y violations on ${route}`, async ({ page }) => {
      await gotoAdminPage(page, route)
      // Give async-data routes extra time to populate before scanning
      if (asyncDataRoutes.has(route)) {
        await page.waitForTimeout(600)
      }
      await expectNoCriticalViolations(page)
    })
  }
})
