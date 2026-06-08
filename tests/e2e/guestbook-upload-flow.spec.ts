import { test, expect } from '@playwright/test'
import { installPublicSiteMocks, gotoPublicPage, preparePublicPage } from './support/publicSite'
import {
  injectAdminSession,
  installAdminMocks,
  waitForPageReady as waitAdminPageReady,
} from './support/adminSite'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4mUAAAAASUVORK5CYII=',
  'base64'
)

test.describe('Complete Guestbook & Photo Upload Flow E2E', () => {
  test('signing guestbook -> uploading photos -> admin moderation -> appearing in gallery', async ({
    page,
  }) => {
    // Setup public page environment
    await preparePublicPage(page)
    await installPublicSiteMocks(page)

    // ─── Step 1: Guest Signs Guestbook ───
    await gotoPublicPage(page, '/guestbook')

    await page.getByRole('button', { name: 'Start your message' }).click()
    await expect(page.getByTestId('guestbook-composer')).toBeVisible()

    await page.getByLabel('Your Name').fill('Alex E2E')
    await page.getByLabel('Email').fill('alex.e2e@example.com')
    await page.getByLabel('Your Message').fill('This is a beautiful guestbook message!')
    await page.getByRole('button', { name: 'Post to the guestbook' }).click()

    await expect(
      page.getByRole('heading', { name: 'Your note is part of the book now.' })
    ).toBeVisible()

    // ─── Step 2: Guest Uploads Photos ───
    await gotoPublicPage(page, '/upload')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles([
      { name: 'e2e-candid.png', mimeType: 'image/png', buffer: tinyPng },
    ])

    await expect(page.getByText('Uploaded and ready')).toBeVisible()

    await page.getByLabel('Your Name').fill('Alex E2E')
    await page.locator('#email').fill('alex.e2e@example.com')
    await page.getByLabel('Add a Note (Optional)').fill('Sharing a photo from the ceremony.')
    await page.getByRole('button', { name: /Submit 1 photo/i }).click()

    await expect(page.getByTestId('upload-success-panel')).toBeVisible()

    // ─── Step 3: Admin Moderation Dashboard ───
    await injectAdminSession(page)
    await installAdminMocks(page)
    await page.goto('/admin/photos')
    await waitAdminPageReady(page)

    const queue = page.getByTestId('upload-queue')
    await expect(queue).toBeVisible()

    // Verify photos grid container exists
    const grid = queue.getByTestId('photo-preview-grid').first()
    await expect(grid).toBeVisible()

    // Approve the upload
    const approveBtn = queue.getByRole('button', { name: /approve/i }).first()
    await approveBtn.click()

    // ─── Step 4: Appearing in Public Gallery ───
    await installPublicSiteMocks(page)
    await gotoPublicPage(page, '/gallery?collection=Guest+Photos')

    // Verify public gallery grid is visible
    await expect(page.getByTestId('gallery-results')).toBeVisible()
  })
})
