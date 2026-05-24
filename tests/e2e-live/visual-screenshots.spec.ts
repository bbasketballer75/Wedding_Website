/**
 * Visual screenshot suite — takes full-page and section screenshots of every
 * public page against the real dev server.
 *
 * Screenshots are saved to tests/e2e-live/screenshots/ and compared on subsequent
 * runs. First run establishes the baseline. Use --update-snapshots to refresh.
 *
 * Run:
 *   npm run dev              # in a separate terminal
 *   npm run test:visual      # runs this file
 *   npm run test:visual:update  # update baseline screenshots
 */
import { gotoPage, pauseAllVideos, test, expect } from './support'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pause video + wait for lazy content, then freeze the page for a stable shot. */
async function stabilise(page: Parameters<typeof gotoPage>[0], extraMs = 0) {
  await pauseAllVideos(page)
  if (extraMs > 0) await page.waitForTimeout(extraMs)

  // Disable all CSS animations and transitions for deterministic screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      video { opacity: 0 !important; }
    `,
  })

  await page.waitForTimeout(150)
}

// ---------------------------------------------------------------------------
// Desktop screenshots
// ---------------------------------------------------------------------------

test.describe('Desktop visual — public pages', () => {
  test('Home page — above the fold', async ({ page }) => {
    await gotoPage(page, '/', 'desktop')
    await stabilise(page, 3000)
    await expect(page).toHaveScreenshot('home-above-fold-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('Home page — timeline section', async ({ page }) => {
    await gotoPage(page, '/', 'desktop')
    await stabilise(page, 3000)

    // Scroll to timeline
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="love-timeline"]')
      el?.scrollIntoView()
    })
    await page.waitForTimeout(500)

    const section = page.locator('[data-testid="love-timeline"]')
    if (await section.isVisible()) {
      await expect(section).toHaveScreenshot('home-timeline-desktop.png')
    }
  })

  test('Home page — guest highlight reel', async ({ page }) => {
    await gotoPage(page, '/', 'desktop')
    await stabilise(page, 4000) // wait for Supabase photos to load

    await page.evaluate(() => {
      const sections = document.querySelectorAll('section')
      for (const s of sections) {
        if (s.textContent?.includes('Memories from our guests')) {
          s.scrollIntoView()
          break
        }
      }
    })
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('home-guest-reel-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('Film page', async ({ page }) => {
    await gotoPage(page, '/film', 'desktop')
    await stabilise(page, 2000)
    await expect(page).toHaveScreenshot('film-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('Gallery page — Engagement tab', async ({ page }) => {
    await gotoPage(page, '/gallery', 'desktop')
    await stabilise(page, 3000)
    await expect(page).toHaveScreenshot('gallery-engagement-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('Gallery page — Bach & Bachelorette tab', async ({ page }) => {
    await gotoPage(page, '/gallery', 'desktop')
    await stabilise(page, 2000)

    const tab = page.getByRole('tab', { name: /Bach/i })
    if (await tab.isVisible()) {
      await tab.click()
      await page.waitForTimeout(2000)
    }

    await expect(page).toHaveScreenshot('gallery-bachette-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('Guestbook page', async ({ page }) => {
    await gotoPage(page, '/guestbook', 'desktop')
    await stabilise(page, 2000)
    await expect(page).toHaveScreenshot('guestbook-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('Upload page', async ({ page }) => {
    await gotoPage(page, '/upload', 'desktop')
    await stabilise(page, 1000)
    await expect(page).toHaveScreenshot('upload-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })

  test('People page', async ({ page }) => {
    await gotoPage(page, '/people', 'desktop')
    await stabilise(page, 2000)
    await expect(page).toHaveScreenshot('people-desktop.png', {
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    })
  })
})

// ---------------------------------------------------------------------------
// Mobile screenshots
// ---------------------------------------------------------------------------

test.describe('Mobile visual — public pages', () => {
  test('Home page — mobile', async ({ page }) => {
    await gotoPage(page, '/', 'mobile')
    await stabilise(page, 3000)
    await expect(page).toHaveScreenshot('home-mobile.png', {
      clip: { x: 0, y: 0, width: 390, height: 844 },
    })
  })

  test('Film page — mobile', async ({ page }) => {
    await gotoPage(page, '/film', 'mobile')
    await stabilise(page, 2000)
    await expect(page).toHaveScreenshot('film-mobile.png', {
      clip: { x: 0, y: 0, width: 390, height: 844 },
    })
  })

  test('Gallery page — mobile', async ({ page }) => {
    await gotoPage(page, '/gallery', 'mobile')
    await stabilise(page, 3000)
    await expect(page).toHaveScreenshot('gallery-mobile.png', {
      clip: { x: 0, y: 0, width: 390, height: 844 },
    })
  })

  test('Guestbook page — mobile', async ({ page }) => {
    await gotoPage(page, '/guestbook', 'mobile')
    await stabilise(page, 2000)
    await expect(page).toHaveScreenshot('guestbook-mobile.png', {
      clip: { x: 0, y: 0, width: 390, height: 844 },
    })
  })
})
