import { expect, gotoAdminPage, test } from './support/adminSite'

// ─── Photo Moderation ─────────────────────────────────────────────────────────

test.describe('Admin Workflows — Photo Moderation', () => {
  test('pending upload queue renders guest names', async ({ page }) => {
    await gotoAdminPage(page, '/admin/photos')

    const queue = page.getByTestId('upload-queue')
    await expect(queue).toBeVisible()
    await expect(queue).toContainText('Riley Thompson')
    await expect(queue).toContainText('Sam Garcia')
    await expect(queue).toContainText('Alex Chen')
  })

  test('each pending upload card has an approve button', async ({ page }) => {
    await gotoAdminPage(page, '/admin/photos')

    const queue = page.getByTestId('upload-queue')
    const approveButtons = queue.getByRole('button', { name: /approve/i })
    await expect(approveButtons.first()).toBeVisible()
  })

  test('each pending upload card has a reject button', async ({ page }) => {
    await gotoAdminPage(page, '/admin/photos')

    const queue = page.getByTestId('upload-queue')
    const rejectButtons = queue.getByRole('button', { name: /^reject$/i })
    await expect(rejectButtons.first()).toBeVisible()
  })

  test('reject button click sends PATCH to guest_uploads', async ({ page }) => {
    const patchRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/guest_uploads') && req.method() === 'PATCH') {
        patchRequests.push(req.url())
      }
    })

    await gotoAdminPage(page, '/admin/photos')

    const queue = page.getByTestId('upload-queue')
    const rejectButton = queue.getByRole('button', { name: /^reject$/i }).first()
    await rejectButton.click()

    // Allow request to fire
    await page.waitForTimeout(500)
    expect(patchRequests.length).toBeGreaterThan(0)
  })
})

// ─── Guestbook Moderation ─────────────────────────────────────────────────────

test.describe('Admin Workflows — Guestbook Moderation', () => {
  test('message list renders all mock messages', async ({ page }) => {
    await gotoAdminPage(page, '/admin/guestbook')

    const list = page.getByTestId('guestbook-moderation-list')
    await expect(list).toBeVisible()
    await expect(list).toContainText('Sarah Mitchell')
    await expect(list).toContainText('Mike Chen')
    await expect(list).toContainText('Aunt Patricia')
  })

  test('delete button is present for each message', async ({ page }) => {
    await gotoAdminPage(page, '/admin/guestbook')

    const list = page.getByTestId('guestbook-moderation-list')
    // Each message card has exactly one danger button (delete)
    const deleteButtons = list.locator('button').filter({ hasNot: page.locator('input') })
    await expect(deleteButtons.first()).toBeVisible()
  })

  test('delete button click sends DELETE to guestbook_messages', async ({ page }) => {
    const deleteRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/guestbook_messages') && req.method() === 'DELETE') {
        deleteRequests.push(req.url())
      }
    })

    await gotoAdminPage(page, '/admin/guestbook')

    // The delete button is the last button in the first message card header row
    const list = page.getByTestId('guestbook-moderation-list')
    const firstCard = list.locator('> div').first()
    const deleteBtn = firstCard.getByRole('button').last()
    await deleteBtn.click()

    await page.waitForTimeout(500)
    expect(deleteRequests.length).toBeGreaterThan(0)
  })
})

// ─── Featured Content Manager ─────────────────────────────────────────────────

test.describe('Admin Workflows — Featured Content', () => {
  test('all four slot tabs are rendered', async ({ page }) => {
    await gotoAdminPage(page, '/admin/featured')

    await expect(page.getByTestId('featured-slot-home_moment_of_the_week')).toBeVisible()
    await expect(page.getByTestId('featured-slot-home_newest_standout_upload')).toBeVisible()
    await expect(page.getByTestId('featured-slot-home_featured_guestbook_note')).toBeVisible()
    await expect(page.getByTestId('featured-slot-film_featured_guest_video')).toBeVisible()
  })

  test('first slot tab is active by default', async ({ page }) => {
    await gotoAdminPage(page, '/admin/featured')

    // "The First Dance" is the title from mock featuredSlots[0]
    await expect(page.getByTestId('admin-content')).toContainText('The First Dance')
  })

  test('save button is visible on the active slot', async ({ page }) => {
    await gotoAdminPage(page, '/admin/featured')

    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })

  test('save button click triggers upsert to site_editorial_features', async ({ page }) => {
    const upsertRequests: string[] = []
    page.on('request', (req) => {
      if (
        req.url().includes('/rest/v1/site_editorial_features') &&
        (req.method() === 'POST' || req.method() === 'PATCH')
      ) {
        upsertRequests.push(req.url())
      }
    })

    await gotoAdminPage(page, '/admin/featured')
    await page.getByRole('button', { name: /save/i }).click()
    await page.waitForTimeout(500)

    expect(upsertRequests.length).toBeGreaterThan(0)
  })

  test('clicking a different slot tab loads that slot', async ({ page }) => {
    await gotoAdminPage(page, '/admin/featured')

    await page.getByTestId('featured-slot-home_newest_standout_upload').click()
    await page.waitForTimeout(300)

    // Second slot (feat-2) is inactive — should show inactive indicator
    await expect(page.getByTestId('admin-content')).toContainText('Standout Upload')
  })
})
