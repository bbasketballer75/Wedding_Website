/**
 * Live image audit — verifies that every public page loads all <img> elements
 * successfully against the real Supabase backend and CDN.
 *
 * Run:
 *   npm run dev              # in a separate terminal
 *   npm run test:visual      # runs this file (among others)
 *
 * Unlike the main e2e suite, there are NO Supabase mocks here. This tests what
 * real guests see: real photos from R2, real guestbook messages, real CDN URLs.
 */
import {
  auditImages,
  expectNobrokenImages,
  gotoPage,
  pauseAllVideos,
  test,
  expect,
} from './support'

// Pages to audit. Key → route, value → extra wait behaviour description.
const PUBLIC_PAGES = [
  { route: '/', name: 'Home', waitMs: 4000 }, // GuestHighlightReel fetches from Supabase
  { route: '/film', name: 'Film', waitMs: 2000 },
  { route: '/gallery', name: 'Gallery', waitMs: 3000 },
  { route: '/guestbook', name: 'Guestbook', waitMs: 2000 },
  { route: '/upload', name: 'Upload', waitMs: 1000 },
  { route: '/people', name: 'People', waitMs: 2000 },
] as const

test.describe('Live image audit — all public pages', () => {
  for (const { route, name, waitMs } of PUBLIC_PAGES) {
    test(`${name} (${route}) — no broken images`, async ({ page }) => {
      await gotoPage(page, route)

      // Pause videos so screenshots are stable
      await pauseAllVideos(page)

      // Extra wait for Supabase-fetched content to land (lazy sections, carousels)
      if (waitMs > 0) {
        await page.waitForTimeout(waitMs)
      }

      await expectNobrokenImages(page)
    })
  }
})

test.describe('Live image audit — gallery album tabs', () => {
  const TABS = ['Engagement', 'Bach & Bachelorette', 'Wedding Photos', 'Guest Uploads']

  for (const tab of TABS) {
    test(`Gallery "${tab}" tab — no broken images`, async ({ page }) => {
      await gotoPage(page, '/gallery')
      await page.waitForTimeout(1500)

      // Click the tab
      const tabEl = page.getByRole('tab', { name: tab })
      if (await tabEl.isVisible()) {
        await tabEl.click()
        await page.waitForTimeout(2000)
      }

      await expectNobrokenImages(page)
    })
  }
})

test.describe('Live image audit — summary report', () => {
  test('Full site image health report', async ({ page }) => {
    const results = []

    for (const { route, name, waitMs } of PUBLIC_PAGES) {
      await gotoPage(page, route)
      await pauseAllVideos(page)
      if (waitMs > 0) await page.waitForTimeout(waitMs)

      const result = await auditImages(page, 10000)
      results.push({ name, ...result })
    }

    // Print a formatted report
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Live Image Audit Report')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const r of results) {
      const status = r.broken.length > 0 ? '❌' : r.stillLoading.length > 0 ? '⚠️ ' : '✅'
      console.log(`${status} ${r.name.padEnd(14)} ${r.loaded}/${r.total} loaded`)
      if (r.broken.length > 0) {
        r.broken.forEach(url => console.log(`     broken: ${url}`))
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Assert all clean
    const allBroken = results.flatMap(r => r.broken)
    expect(allBroken, 'Some images are broken site-wide').toEqual([])
  })
})
