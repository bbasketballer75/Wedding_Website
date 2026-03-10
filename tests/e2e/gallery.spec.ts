import { test, expect } from '@playwright/test'

test.describe('Gallery Page', () => {
  test('should display gallery', async ({ page }) => {
    await page.goto('/gallery')
    await expect(page.getByText('Our Gallery')).toBeVisible()
    await expect(page.getByRole('heading', { name: /\d+ Moments/ })).toBeVisible()
  })
})
