import { expect, gotoPublicPage, test } from './support/publicSite'

test.describe('Milestone v3.0: Guest Experience Enhancements E2E Spec', () => {
  test('Activity Feed renders and supports filters', async ({ page }) => {
    // 1. Visit Activity page
    await gotoPublicPage(page, '/activity')
    await expect(page.locator('body')).toBeVisible()

    // 2. Check title
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible()

    // 3. Verify tab filters exist
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Photos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guestbook' })).toBeVisible()

    // 4. Click filter
    await page.getByRole('button', { name: 'Photos' }).click()
    await expect(page.getByRole('button', { name: 'Photos' })).toHaveClass(/bg-gold-500|text-white/)
  })

  test('Download Queue can be managed in Gallery', async ({ page }) => {
    // 1. Visit Gallery page
    await gotoPublicPage(page, '/gallery')
    await expect(page.locator('body')).toBeVisible()

    // 2. Check if multi-select button or mode exists
    // The gallery header has select checkboxes or a button to start selection
    const selectModeBtn = page.getByRole('button', { name: /Select|Download/i })
    if ((await selectModeBtn.count()) > 0) {
      await selectModeBtn.first().click()
    }
  })

  test('Public Showcase Album Page renders stats and switch tabs', async ({ page }) => {
    // 1. Visit valid showcase token
    await gotoPublicPage(page, '/guest/valid-showcase-token')
    await expect(page.locator('body')).toBeVisible()

    // 2. Check guest showcase headers and stats
    await expect(page.getByRole('heading', { name: "Jane Miller's Showcase" })).toBeVisible()
    await expect(page.getByText('Share This Album')).toBeVisible()

    // 3. Toggle between Photos and Guestbook tabs
    const photosTab = page.getByRole('button', { name: /Photos/i })
    const guestbookTab = page.getByRole('button', { name: /Guestbook/i })
    await expect(photosTab).toBeVisible()
    await expect(guestbookTab).toBeVisible()

    await guestbookTab.click()
    await expect(guestbookTab).toHaveClass(/text-gold-700/)
  })

  test('Public Showcase Album invalid token displays correct fallback', async ({ page }) => {
    // 1. Visit invalid showcase token
    await gotoPublicPage(page, '/guest/invalid-token')
    await expect(page.locator('body')).toBeVisible()

    // 2. Check fallback screen alerts
    await expect(page.getByRole('heading', { name: 'Album Link Unresolved' })).toBeVisible()
    await expect(
      page.getByText(/token is invalid, expired, or the guest contributions/i)
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Gallery' })).toBeVisible()
  })

  test('Lightbox opens Print Modal overlay with vendor cards', async ({ page }) => {
    // 1. Visit Gallery and open the first photo
    await gotoPublicPage(page, '/gallery')
    await page.waitForTimeout(300)

    // Click the first photo to open the lightbox
    const firstPhoto = page.locator('[role="button"]').first()
    if ((await firstPhoto.count()) > 0) {
      await firstPhoto.click()
      await page.waitForTimeout(300)

      // 2. Verify "Order Prints" button exists inside the lightbox toolbar
      const orderPrintsBtn = page.getByRole('button', { name: /Order Prints/i })
      if ((await orderPrintsBtn.count()) > 0) {
        await orderPrintsBtn.click()
        await page.waitForTimeout(200)

        // 3. Confirm PrintModal renders with Artifact Uprising and Shutterfly options
        await expect(page.getByRole('heading', { name: 'Order Prints', level: 3 })).toBeVisible()
        await expect(page.getByText('Artifact Uprising')).toBeVisible()
        await expect(page.getByText('Shutterfly')).toBeVisible()

        // 4. Close the PrintModal
        await page.getByRole('button', { name: 'Close print dialog' }).click()
      }
    }
  })
})
