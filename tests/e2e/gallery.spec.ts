import { expect, expectSectionScreenshot, gotoPublicPage, test, viewports, waitForPageReady } from './support/publicSite'

test.describe('Gallery Page', () => {
  test('renders the editorial control bar, supports search, and switches views', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')

    await expect(page.getByTestId('gallery-control-bar')).toBeVisible()
    await expect(page.getByTestId('gallery-results')).toBeVisible()

    await page.getByPlaceholder('Search by caption, location, photographer, or tags').fill('first look')
    await waitForPageReady(page)
    await expect(page.getByText('Search: "first look"')).toBeVisible()

    await page.getByRole('button', { name: 'Timeline' }).click()
    await expect(page.getByRole('heading', { name: 'Timeline view' })).toBeVisible()
  })

  test('opens a lightbox from the mocked gallery feed', async ({ page }) => {
    await gotoPublicPage(page, '/gallery')

    await page.getByRole('button', { name: /Open photo/i }).first().click()
    await expect(page.getByRole('button', { name: 'Close photo viewer' })).toBeVisible()
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`gallery visual baselines (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/gallery', viewport)
    await expectSectionScreenshot(page.getByTestId('gallery-control-bar'), `gallery-controls-${viewport}.png`)
    await expectSectionScreenshot(page.getByTestId('gallery-results'), `gallery-results-${viewport}.png`)
  })
}
