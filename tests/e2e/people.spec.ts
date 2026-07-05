import {
  expect,
  expectSectionScreenshot,
  gotoPublicPage,
  test,
  viewports,
} from './support/publicSite'

test.describe('People Page', () => {
  test('renders person cards from face data', async ({ page }) => {
    await gotoPublicPage(page, '/people')

    await expect(
      page.getByRole('heading', { name: 'The people who made it beautiful.' })
    ).toBeVisible()

    // At least one person card rendered from the mock face data
    const firstCard = page.getByRole('button', { name: /Browse photos of/i }).first()
    await expect(firstCard).toBeVisible()
  })

  test('navigates to gallery filtered by person on card click', async ({ page }) => {
    await gotoPublicPage(page, '/people')

    const firstCard = page.getByRole('button', { name: /Browse photos of/i }).first()
    await firstCard.click()

    await expect(page).toHaveURL(/\/gallery\?person=/)
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`people visual baseline (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/people', viewport)
    await expect(
      page.getByRole('heading', { name: 'The people who made it beautiful.' })
    ).toBeVisible()
    await expectSectionScreenshot(page.getByTestId('people-page'), `people-page-${viewport}.png`)
  })
}
