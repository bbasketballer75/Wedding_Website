import { expect, gotoPublicPage, test, viewports } from './support/publicSite'

const nonHomeRoutes = ['/film', '/gallery', '/upload', '/guestbook']

test.describe('Shared Public Shell', () => {
  test('non-home public routes render the shared header and footer', async ({ page }) => {
    for (const route of nonHomeRoutes) {
      await gotoPublicPage(page, route)
      await expect(page.getByTestId('public-header')).toBeVisible()
      await expect(page.getByTestId('public-footer')).toBeVisible()
      await expect(page.getByTestId('home-nav')).toHaveCount(0)
    }
  })

  test('shared header fits within the narrow mobile viewport', async ({ page }) => {
    for (const route of nonHomeRoutes) {
      await gotoPublicPage(page, route, 'mobile')

      const headerBox = await page.getByTestId('public-header').boundingBox()
      expect(headerBox).not.toBeNull()
      expect(headerBox?.width ?? 0).toBeLessThanOrEqual(viewports.mobile.width)
    }
  })
})
