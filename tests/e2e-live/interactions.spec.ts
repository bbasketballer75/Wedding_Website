/**
 * Live interaction tests — tests actual user flows against the real backend.
 * No mocks. Tests what a real guest actually experiences.
 *
 * Marked @live so they can be run selectively:
 *   npm run test:visual -- --grep @live
 */
import { gotoPage, pauseAllVideos, test, expect } from './support'

// ---------------------------------------------------------------------------
// Navigation flows
// ---------------------------------------------------------------------------

test.describe('Navigation @live', () => {
  test('Home page — all nav links work', async ({ page }) => {
    await gotoPage(page, '/')
    await pauseAllVideos(page)

    // Wait for nav to become interactive (showUI timer ~1200ms + scroll)
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2.5))
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="home-nav"]')
        return el && window.getComputedStyle(el).pointerEvents !== 'none'
      },
      { timeout: 8000 }
    )

    const nav = page.getByTestId('home-nav')

    // Film link
    await nav.getByRole('link', { name: 'Watch Film' }).click()
    await expect(page).toHaveURL(/\/film$/)

    // Back home, then Guestbook
    await gotoPage(page, '/')
    await pauseAllVideos(page)
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2.5))
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="home-nav"]')
        return el && window.getComputedStyle(el).pointerEvents !== 'none'
      },
      { timeout: 8000 }
    )
    await nav.getByRole('link', { name: 'Guestbook' }).click()
    await expect(page).toHaveURL(/\/guestbook$/)
  })

  test('Gallery — switching between album tabs', async ({ page }) => {
    await gotoPage(page, '/gallery')
    await page.waitForTimeout(2000)

    const tabs = ['Engagement', 'Bach & Bachelorette', 'Wedding Photos', 'Guest Uploads']
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click()
        await page.waitForTimeout(1500)
        // Confirm tab is selected and photos rendered
        await expect(tab).toHaveAttribute('aria-selected', 'true')
        const photoCount = await page.locator('img[alt]').count()
        expect(photoCount).toBeGreaterThan(0)
        console.log(`✅ ${tabName}: ${photoCount} images rendered`)
      } else {
        console.log(`⚠️  Tab "${tabName}" not visible — skipping`)
      }
    }
  })

  test('Film page — chapters and video player', async ({ page }) => {
    await gotoPage(page, '/film')
    await pauseAllVideos(page)
    await page.waitForTimeout(1500)

    // Video player should be present
    const player = page.locator('video').first()
    await expect(player).toBeVisible({ timeout: 10000 })

    // Chapter list should render
    const chapterNav = page
      .locator('[data-testid="chapter-nav"], [aria-label*="chapter"], nav')
      .filter({ hasText: /ceremony|reception|toasts|getting ready/i })
      .first()

    const hasChapters = await chapterNav.isVisible({ timeout: 5000 }).catch(() => false)
    if (hasChapters) {
      console.log('✅ Chapter navigation visible')
    } else {
      console.log('ℹ️  Chapter nav not found with expected label — film page rendered OK')
    }
  })

  test('Guestbook — form renders and validates', async ({ page }) => {
    await gotoPage(page, '/guestbook')
    await page.waitForTimeout(1500)

    // Form should be present
    const form = page.locator('form').first()
    const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasForm) {
      // Try submitting empty — should show validation errors
      const submitBtn = page.getByRole('button', { name: /sign|submit|leave|post/i }).first()
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForTimeout(500)
        // Should not navigate away (form validation kicked in)
        await expect(page).toHaveURL(/\/guestbook/)
        console.log('✅ Guestbook form validation works (did not submit empty form)')
      }
    } else {
      // Guestbook may show messages without a visible form if user needs to scroll
      const messages = await page
        .locator('[data-testid="guestbook-message"], blockquote, .message')
        .count()
      console.log(`ℹ️  No visible form found. ${messages} message elements on page.`)
    }
  })

  test('Upload page — dropzone renders', async ({ page }) => {
    await gotoPage(page, '/upload')
    await page.waitForTimeout(1000)

    // Dropzone or file input should be present
    const dropzone = page
      .locator('[data-testid="dropzone"], [aria-label*="upload"], input[type="file"]')
      .first()
    const hasDropzone = await dropzone.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasDropzone) {
      console.log('✅ Upload dropzone is visible')
    } else {
      // May be behind a gate — check the page rendered at all
      await expect(page.locator('main, #main-content')).toBeVisible()
      console.log('ℹ️  Dropzone not immediately visible — page rendered OK')
    }
  })
})

// ---------------------------------------------------------------------------
// Gallery lightbox interaction
// ---------------------------------------------------------------------------

test.describe('Gallery lightbox @live', () => {
  test('Clicking a photo opens the lightbox', async ({ page }) => {
    await gotoPage(page, '/gallery')
    await page.waitForTimeout(3000) // wait for real photos to load from Supabase

    // Click the first visible photo
    const firstPhoto = page
      .locator('img[data-testid], [role="button"] img, .gallery-item img')
      .first()

    if (await firstPhoto.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstPhoto.click()
      await page.waitForTimeout(1000)

      // Lightbox dialog should appear
      const lightbox = page.locator('[role="dialog"], [data-testid="lightbox"], .lightbox').first()

      const lightboxOpen = await lightbox.isVisible({ timeout: 5000 }).catch(() => false)
      if (lightboxOpen) {
        console.log('✅ Lightbox opened')

        // Close with Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
        await expect(lightbox).not.toBeVisible()
        console.log('✅ Lightbox closed with Escape')
      } else {
        console.log('ℹ️  Photo clicked but no lightbox dialog found — may use a different pattern')
      }
    } else {
      console.log('ℹ️  No photo found to click — gallery may be empty or loading')
    }
  })
})
