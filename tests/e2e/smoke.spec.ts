import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('film page loads', async ({ page }) => {
    await page.goto('/film')
    await expect(page.locator('body')).toBeVisible()
  })

  test('gallery page loads', async ({ page }) => {
    await page.goto('/gallery')
    await expect(page.getByText('Our Gallery')).toBeVisible()
  })

  test('guestbook page loads', async ({ page }) => {
    await page.goto('/guestbook')
    await expect(page.locator('body')).toBeVisible()
  })

  test('404 page loads', async ({ page }) => {
    await page.goto('/nonexistent')
    await expect(page.locator('body')).toBeVisible()
  })

  test('should be responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('should have PWA manifest', async ({ page }) => {
    await page.goto('/')
    const manifest = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]')
      return link ? link.getAttribute('href') : null
    })
    expect(manifest).toBeTruthy()
  })
})
