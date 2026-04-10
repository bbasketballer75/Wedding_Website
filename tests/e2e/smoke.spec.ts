import { expect, gotoPublicPage, test } from './support/publicSite'

test.describe('Smoke Tests', () => {
  test('@smoke homepage loads', async ({ page }) => {
    await gotoPublicPage(page, '/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke film page loads', async ({ page }) => {
    await gotoPublicPage(page, '/film')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke gallery page loads', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke upload page loads', async ({ page }) => {
    await gotoPublicPage(page, '/upload')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke guestbook page loads', async ({ page }) => {
    await gotoPublicPage(page, '/guestbook')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke people page loads', async ({ page }) => {
    await gotoPublicPage(page, '/people')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke guest-photos page loads', async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos')
    await expect(page.locator('body')).toBeVisible()
  })

  test('@smoke 404 page loads', async ({ page }) => {
    await gotoPublicPage(page, '/nonexistent')
    await expect(page.locator('body')).toBeVisible()
  })
})
