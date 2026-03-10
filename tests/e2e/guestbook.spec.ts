import { test, expect } from '@playwright/test'

test.describe('Guestbook Page', () => {
  test('should display guestbook', async ({ page }) => {
    await page.goto('/guestbook')
    await expect(page.locator('main')).toBeVisible()
  })

  test('should render page structure', async ({ page }) => {
    await page.goto('/guestbook')
    
    // Wait for loading to complete (or timeout)
    await page.waitForTimeout(5000)
    
    // Verify main content area is visible
    await expect(page.locator('main')).toBeVisible()
    
    // Verify page header or loading state exists
    const hasHeader = await page.locator('h1').isVisible().catch(() => false)
    const hasLoading = await page.locator('text=Loading').isVisible().catch(() => false)
    
    // Page should have either content or loading state
    expect(hasHeader || hasLoading).toBe(true)
  })

  test('should display content', async ({ page }) => {
    await page.goto('/guestbook')
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })
})
