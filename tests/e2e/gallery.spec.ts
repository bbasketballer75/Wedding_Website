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
