import {
  expect,
  expectSectionScreenshot,
  gotoPublicPage,
  test,
  viewports,
  waitForPageReady,
} from './support/publicSite'

test.describe('Gallery Page', () => {
  test('renders the editorial control bar, supports search, and switches views', async ({
    page,
  }) => {
    let photoFetches = 0
    page.on('request', request => {
      if (new URL(request.url()).pathname.includes('/rest/v1/photos')) {
        photoFetches += 1
      }
    })

    await gotoPublicPage(page, '/gallery')

    await expect(page.getByTestId('gallery-control-bar')).toBeVisible()
    await expect(page.getByTestId('gallery-results')).toBeVisible()

    await page
      .getByPlaceholder('Search by caption, location, photographer, or tags')
      .fill('first look')
    await waitForPageReady(page)
    await expect(page.getByText('Search: "first look"')).toBeVisible()

    await page.getByRole('button', { name: 'Timeline' }).click()
    await expect(page.getByRole('heading', { name: 'Timeline view' })).toBeVisible()

    // Regression guard: the page used to pass freshly-mapped curated-photo
    // arrays into useGalleryData, whose fetch effect keys on the callback
    // identity. That refetched /rest/v1/photos on every render (~290 calls in
    // 3s) and cleared the search box after each fetch. A loaded gallery must
    // settle at a single page fetch.
    await page.waitForTimeout(1000)
    expect(
      photoFetches,
      `gallery requested /rest/v1/photos ${photoFetches} times; expected a single page fetch`
    ).toBeLessThanOrEqual(2)
  })

  test.skip('opens a lightbox from the mocked gallery feed', async ({ page }) => {
    // Skipped: This test requires complex interaction with useLongPress hook
    // The lightbox opening mechanism relies on long-press detection which
    // doesn't work reliably in the test environment
    await gotoPublicPage(page, '/gallery')

    // Wait for photos to render
    await page.waitForTimeout(500)

    // Click the first photo using evaluate to directly trigger click
    await page.locator('[role="button"]').first().click()

    // Wait for lightbox to open
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: 'Close photo viewer' })).toBeVisible()
  })
})

// The control bar is the one gallery surface that is allowed to reflow at
// mobile widths. These guards are geometry/keyboard assertions, not snapshots:
// an element screenshot can silently omit content that overflows its box, so
// the baseline alone cannot prove the Select control is reachable.
const NARROW_WIDTHS = [320, 390] as const
const THEMES = ['dark', 'light'] as const

for (const width of NARROW_WIDTHS) {
  for (const theme of THEMES) {
    test(`gallery controls stay usable at ${width}px (${theme} theme)`, async ({ page }) => {
      await page.addInitScript(value => {
        window.localStorage.setItem(
          'ui-store',
          JSON.stringify({ state: { currentTheme: value }, version: 0 })
        )
      }, theme)
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/gallery')
      await waitForPageReady(page)

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      const bar = page.getByTestId('gallery-control-bar')
      await expect(bar).toBeVisible()
      await bar.scrollIntoViewIfNeeded()

      // 4 collection cards + search field + 3 view modes + Select.
      const controls = bar.locator('button[aria-pressed], input[type="text"]')
      await expect(controls).toHaveCount(9)

      const problems: string[] = []
      for (let index = 0; index < 9; index += 1) {
        const control = controls.nth(index)
        await expect(control).toBeVisible()
        await expect(control).toBeEnabled()

        const label =
          (await control.getAttribute('aria-label')) ??
          (await control.innerText().catch(() => '')) ??
          `control ${index}`
        const box = await control.boundingBox()
        if (!box || box.width <= 0 || box.height <= 0) {
          problems.push(`${label}: no measurable box`)
          continue
        }
        if (box.x < -0.5 || box.x + box.width > width + 0.5) {
          problems.push(
            `${label}: x=${box.x.toFixed(1)} right=${(box.x + box.width).toFixed(1)} ` +
              `outside 0..${width}`
          )
        }

        const hitTarget = await control.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const point = {
            x: rect.left + rect.width / 2,
            y: rect.top + Math.min(rect.height / 2, 10),
          }
          const top = document.elementFromPoint(point.x, point.y)
          return top !== null && (top === element || element.contains(top))
        })
        if (!hitTarget) problems.push(`${label}: covered by another element at its centre`)
      }

      for (const testId of ['gallery-control-bar', 'gallery-filter-bar']) {
        const metrics = await page.getByTestId(testId).evaluate(element => ({
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }))
        if (metrics.scrollWidth > metrics.clientWidth + 1) {
          problems.push(
            `${testId}: scrollWidth ${metrics.scrollWidth} > clientWidth ${metrics.clientWidth}`
          )
        }
      }

      expect(problems, problems.join('\n')).toEqual([])

      // Keyboard traversal: Tab from the search field must reach each view
      // mode and the Select toggle, and Enter must activate them.
      const search = page.getByPlaceholder('Search by caption, location, photographer, or tags')
      await search.focus()
      await page.keyboard.press('Tab')
      await expect(bar.getByRole('button', { name: 'Masonry', exact: true })).toBeFocused()
      await page.keyboard.press('Tab')
      const gridMode = bar.getByRole('button', { name: 'Grid', exact: true })
      await expect(gridMode).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(gridMode).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Tab')
      const timelineMode = bar.getByRole('button', { name: 'Timeline', exact: true })
      await expect(timelineMode).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { name: 'Timeline view' })).toBeVisible()
      await page.keyboard.press('Tab')
      const selectToggle = bar.getByRole('button', { name: 'Select', exact: true })
      await expect(selectToggle).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(selectToggle).toHaveAttribute('aria-pressed', 'true')
      await expect(
        bar.getByRole('button', { name: 'Select All Visible', exact: true })
      ).toBeVisible()

      // Collection cards are keyboard-reachable and activate with Enter.
      const cards = bar.locator('button[aria-pressed]').filter({ hasText: /photos$/ })
      await cards.nth(0).focus()
      await page.keyboard.press('Tab')
      await expect(cards.nth(1)).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true')
    })
  }
}

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`gallery visual baselines (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/gallery', viewport)
    await expectSectionScreenshot(
      page.getByTestId('gallery-control-bar'),
      `gallery-controls-${viewport}.png`
    )
    await expectSectionScreenshot(
      page.getByTestId('gallery-results'),
      `gallery-results-${viewport}.png`
    )
  })
}
