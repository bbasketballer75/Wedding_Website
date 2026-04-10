import { expect, expectSectionScreenshot, gotoPublicPage, test, viewports } from './support/publicSite'

test.describe('Guest Memories Page', () => {
  test('renders masonry photo cards for approved guest uploads', async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos')

    await expect(page.getByRole('heading', { name: 'Your side of the day.' })).toBeVisible()

    // At least one masonry photo card (role=button) should be visible
    const photoCards = page.getByRole('button', { name: /Open photo/i })
    await expect(photoCards.first()).toBeVisible()
  })

  test('has a Share your photos call-to-action linking to /upload', async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos')

    const shareLink = page.getByRole('link', { name: /Share your photos/i }).first()
    await expect(shareLink).toBeVisible()
    await expect(shareLink).toHaveAttribute('href', '/upload')
  })

  test('clicking a photo card opens the lightbox', async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos')

    const firstCard = page.getByRole('button', { name: /Open photo/i }).first()
    await firstCard.click()

    // Lightbox should be open — look for the close button or navigation arrows
    await expect(page.getByRole('button', { name: /close/i })).toBeVisible()
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`guest-memories visual baseline (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/guest-photos', viewport)
    await expect(page.getByRole('heading', { name: 'Your side of the day.' })).toBeVisible()
    await expectSectionScreenshot(page.getByTestId('guest-memories-page'), `guest-memories-page-${viewport}.png`)
  })
}
