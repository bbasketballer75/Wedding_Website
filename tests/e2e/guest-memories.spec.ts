import { expect, expectSectionScreenshot, gotoPublicPage, test, viewports } from './support/publicSite'

test.describe('Guest Memories Page', () => {
  test('renders approved guest upload cards', async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos')

    await expect(page.getByRole('heading', { name: 'Your side of the day.' })).toBeVisible()

    // Guest names from mock approvedGuestUploads
    await expect(page.getByText('Jamie Rivera')).toBeVisible()
    await expect(page.getByText('Morgan Lee')).toBeVisible()
  })

  test('has a Share your photos call-to-action linking to /upload', async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos')

    const shareLink = page.getByRole('link', { name: /Share your photos/i }).first()
    await expect(shareLink).toBeVisible()
    await expect(shareLink).toHaveAttribute('href', '/upload')
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`guest-memories visual baseline (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos', viewport)
    await expect(page.getByRole('heading', { name: 'Your side of the day.' })).toBeVisible()
    await expectSectionScreenshot(page.getByTestId('guest-memories-page'), `guest-memories-page-${viewport}.png`)
  })
}
