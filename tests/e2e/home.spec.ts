import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('should display correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Austin & Jordyn/)
  })

  test('should display couple names', async ({ page }) => {
    await page.goto('/')
    // The home page uses a logo with A&J instead of h1
    const logo = page.locator('a:has-text("A&J")').first()
    await expect(logo).toBeVisible()
  })

  test('should have working navigation', async ({ page }) => {
    await page.goto('/')
    // Use more specific selector for the main navigation
    const nav = page.locator('nav').filter({ hasText: 'A&J' }).first()
    await expect(nav).toBeVisible()
  })

  test('should navigate to film page', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/film"]')
    await expect(page).toHaveURL(/\/film/)
  })

  test('should navigate to gallery page', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/gallery"]')
    await expect(page).toHaveURL(/\/gallery/)
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    // Check that the logo/nav is visible on mobile
    const logo = page.locator('a:has-text("A&J")').first()
    await expect(logo).toBeVisible()
  })
})
