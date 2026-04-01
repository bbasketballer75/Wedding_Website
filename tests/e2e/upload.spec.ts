import { expect, expectSectionScreenshot, gotoPublicPage, test, viewports } from './support/publicSite'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4mUAAAAASUVORK5CYII=',
  'base64'
)

const fakeMp4 = Buffer.from('000000206674797069736F6D0000020069736F6D69736F3261766331', 'hex')

test.describe('Upload Page', () => {
  test('accepts fixture media and shows stable success and error queue states', async ({ page }) => {
    await gotoPublicPage(page, '/upload')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      { name: 'gallery-memory.png', mimeType: 'image/png', buffer: tinyPng },
      { name: 'late-night-toast.mp4', mimeType: 'video/mp4', buffer: fakeMp4 },
    ])

    await expect(page.getByText('Uploaded and ready')).toBeVisible()
    await expect(page.getByText('Needs retry')).toBeVisible()
  })

  test('submits a successful upload and renders the completion panel', async ({ page }) => {
    await gotoPublicPage(page, '/upload')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([{ name: 'table-candid.png', mimeType: 'image/png', buffer: tinyPng }])

    await expect(page.getByText('Uploaded and ready')).toBeVisible()

    await page.getByLabel('Your Name').fill('Taylor Guest')
    await page.locator('#email').fill('taylor@example.com')
    await page.getByLabel('Add a Note (Optional)').fill('A few favorites from our table.')
    await page.getByRole('button', { name: /Submit 1 photo/i }).click()

    await expect(page.getByTestId('upload-success-panel')).toBeVisible()
    await expect(page.getByText('Thank you for adding to the archive.')).toBeVisible()
  })
})

for (const viewport of Object.keys(viewports) as Array<keyof typeof viewports>) {
  test(`upload visual baselines (${viewport})`, async ({ page }) => {
    await gotoPublicPage(page, '/upload', viewport)
    await expectSectionScreenshot(page.getByTestId('upload-dropzone'), `upload-dropzone-${viewport}.png`)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([{ name: 'table-candid.png', mimeType: 'image/png', buffer: tinyPng }])
    await expect(page.getByText('Uploaded and ready')).toBeVisible()
    await page.getByLabel('Your Name').fill('Taylor Guest')
    await page.locator('#email').fill('taylor@example.com')
    await page.getByLabel('Add a Note (Optional)').fill('A few favorites from our table.')
    await page.getByRole('button', { name: /Submit 1 photo/i }).click()

    await expectSectionScreenshot(page.getByTestId('upload-success-panel'), `upload-success-${viewport}.png`)
  })
}
