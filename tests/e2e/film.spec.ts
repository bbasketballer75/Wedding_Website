import { test, expect } from '@playwright/test'

test.describe('Film Page', () => {
  test('should display film page', async ({ page }) => {
    await page.goto('/film')
    await expect(page.locator('main')).toBeVisible()
  })

  test('should have video element', async ({ page }) => {
    await page.goto('/film')
    const video = page.locator('video').first()
    await expect(video).toBeVisible()
  })

  test('should navigate to upload page', async ({ page }) => {
    await page.goto('/film')
    await page.click('a[href="/upload"]')
    await expect(page).toHaveURL(/\/upload/)
  })
})
