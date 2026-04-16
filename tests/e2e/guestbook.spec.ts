import { expect, expectSectionScreenshot, gotoPublicPage, test, viewports, waitForPageReady } from './support/publicSite'

test.describe('Guestbook Page', () => {
  test('renders the guestbook feed', async ({ page }) => {
    await gotoPublicPage(page, '/guestbook')

    await expect(page.getByRole('heading', { name: /Every guestbook entry/i })).toBeVisible()
    await expect(page.getByTestId('guestbook-feed')).toBeVisible()
  })

  test('opens the composer and submits a text message against mocked responses', async ({ page }) => {
    await gotoPublicPage(page, '/guestbook')

    await page.getByRole('button', { name: 'Start your message' }).click()
    await expect(page.getByTestId('guestbook-composer')).toBeVisible()

    await page.getByLabel('Your Name').fill('Taylor Guest')
    await page.getByLabel('Email').fill('taylor@example.com')
    await page.getByLabel('Your Message').fill('We felt the joy from the back row and still cannot stop smiling.')
    await page.getByRole('button', { name: 'Post to the guestbook' }).click()

    await expect(page.getByRole('heading', { name: 'Your note is part of the book now.' })).toBeVisible()
  })

  test('updates reactions and replies in the feed', async ({ page }) => {
    await gotoPublicPage(page, '/guestbook')
    const firstEntry = page.locator('article').first()

    await firstEntry.getByRole('button', { name: 'Add a reaction' }).click()
    await page.locator('#reaction-picker').getByRole('button', { name: 'Love' }).click()
    await expect(firstEntry.getByRole('button', { name: /Love reaction, 13 votes/i })).toBeVisible()

    await firstEntry.getByRole('button', { name: /Reply \(1\)|Reply/i }).click()
    await firstEntry.getByLabel('Add a reply').fill('We are still talking about the dance floor, too.')
    await firstEntry.getByRole('button', { name: 'Send' }).click()

    await expect(firstEntry.getByText('We are still talking about the dance floor, too.')).toBeVisible()
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`guestbook visual baselines (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/guestbook', viewport)
    await expectSectionScreenshot(page.getByTestId('guestbook-feed'), `guestbook-feed-${viewport}.png`)

    await page.getByRole('button', { name: 'Start your message' }).click()
    await waitForPageReady(page)
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    })
    await expectSectionScreenshot(page.getByTestId('guestbook-composer'), `guestbook-composer-${viewport}.png`)
  })
}
