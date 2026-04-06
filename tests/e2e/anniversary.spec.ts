import { expect, expectSectionScreenshot, gotoPublicPage, test, viewports } from './support/publicSite'

test.describe('Anniversary Page', () => {
  test('renders countdown and year cards section', async ({ page }) => {
    await gotoPublicPage(page, '/anniversary')

    // Year cards heading
    await expect(page.getByRole('heading', { name: 'Year by year' })).toBeVisible()

    // Year One card from mock data
    await expect(page.getByText('Year One')).toBeVisible()
  })

  test('shows the On This Day wedding photo strip', async ({ page }) => {
    await gotoPublicPage(page, '/anniversary')

    // Photo strip heading — galleryPhotos mock includes Wedding Day album photos
    await expect(page.getByText('On this day')).toBeVisible()
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`anniversary visual baseline (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/anniversary', viewport)
    await expect(page.getByRole('heading', { name: 'Year by year' })).toBeVisible()
    await expectSectionScreenshot(page.getByTestId('anniversary-page'), `anniversary-page-${viewport}.png`)
  })
}
