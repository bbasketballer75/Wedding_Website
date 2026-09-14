import { expect, test } from '@playwright/test'
import { expectSectionScreenshot, gotoPublicPage, waitForPageReady } from './support/publicSite'

/**
 * Gallery visual snapshot regression tests.
 *
 * These capture full-page screenshots of the Gallery at key states. They run
 * alongside the e2e suite and protect against the Gallery refactor (Plan A)
 * introducing visual regressions that unit tests cannot catch.
 *
 * First run on a new machine creates the baseline; subsequent runs compare.
 * Update baselines with `npx playwright test tests/e2e/gallery-visual --update-snapshots`.
 */

test.describe('Gallery visual snapshots', () => {
  test('default masonry view loads and matches baseline', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')
    await waitForPageReady(page)
    await expect(page.getByTestId('gallery-results')).toBeVisible()
    // Wait for grid items to populate so the screenshot is stable.
    await page.waitForTimeout(800)
    await expect(page).toHaveScreenshot('gallery-masonry.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.01,
    })
  })

  test('Proposal collection renders baseline', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')
    await waitForPageReady(page)
    await page.waitForTimeout(800)
    await expect(page.getByTestId('gallery-results')).toBeVisible()
    await expectSectionScreenshot(
      page.getByTestId('gallery-control-bar').locator('..'),
      'gallery-collection-tabs.png'
    )
  })

  test('view mode toggle (Masonry -> Timeline) baseline', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')
    await waitForPageReady(page)
    await page.getByRole('button', { name: 'Timeline' }).click()
    await page.waitForTimeout(800)
    await expect(page).toHaveScreenshot('gallery-timeline.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.01,
    })
  })
})
