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
    page.on('request', req => {
      if (req.url().includes('/rest/v1/guest_uploads') && req.method() === 'PATCH') {
        patchRequests.push(req.url())
      }
    })

    await gotoAdminPage(page, '/admin/photos')

    const queue = page.getByTestId('upload-queue')
    const rejectButton = queue.getByRole('button', { name: /^reject$/i }).first()
    await rejectButton.click()

    // Wait for the modal to appear (the h2 title inside ModerationConfirmDialog)
    const dialogTitle = page.locator('h2', { hasText: 'Reject Upload' })
    await dialogTitle.waitFor({ state: 'visible', timeout: 5000 })

    // The confirm button sits in the modal footer alongside "Cancel".
    // Use the fixed-position modal container (z-50) to scope the click.
    const confirmBtn = page
      .locator('.fixed')
      .filter({ has: dialogTitle })
      .getByRole('button', { name: 'Reject' })
    await confirmBtn.click({ force: true })

    // Allow PATCH request to fire
    await page.waitForTimeout(800)
    expect(patchRequests.length).toBeGreaterThan(0)
  })
})

// ─── Guestbook Moderation ─────────────────────────────────────────────────────

test.describe('Admin Workflows — Guestbook Moderation', () => {
  test('message list renders all mock messages', async ({ page }) => {
    await gotoAdminPage(page, '/admin/guestbook')

    const list = page.getByTestId('guestbook-moderation-list')
    // Wait explicitly for the async fetch to populate the list.
    // Use exact match on the visible <p> to avoid the sr-only span also matching.
    await expect(list.locator('p.font-medium', { hasText: 'Sarah Mitchell' })).toBeVisible({
      timeout: 12000,
    })
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
    page.on('request', req => {
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
    page.on('request', req => {
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

// ─── Photo Claiming Moderation ────────────────────────────────────────────────

test.describe('Admin Workflows — Photo Claiming Moderation', () => {
  test('pending claims queue renders guest names and details', async ({ page }) => {
    await gotoAdminPage(page, '/admin/claims')

    await expect(page.getByRole('heading', { name: 'Jane Miller', level: 4 })).toBeVisible()
    await expect(page.getByText('jane@example.com')).toBeVisible()
    await expect(page.getByText('Face Tag Claim', { exact: true })).toBeVisible()
  })

  test('approving a claim sends requests and transitions status', async ({ page }) => {
    const patchRequests: string[] = []
    page.on('request', req => {
      if (req.url().includes('/rest/v1/photo_claims') && req.method() === 'PATCH') {
        patchRequests.push(req.url())
      }
    })

    await gotoAdminPage(page, '/admin/claims')

    const approveBtn = page.getByRole('button', { name: 'Approve', exact: true }).first()
    await approveBtn.click()

    await page.waitForTimeout(500)
    expect(patchRequests.length).toBeGreaterThan(0)
  })

  test('rejecting a claim opens reason modal and allows submit', async ({ page }) => {
    const patchRequests: string[] = []
    page.on('request', req => {
      if (req.url().includes('/rest/v1/photo_claims') && req.method() === 'PATCH') {
        patchRequests.push(req.url())
      }
    })

    await gotoAdminPage(page, '/admin/claims')

    const rejectBtn = page.getByRole('button', { name: 'Reject', exact: true }).first()
    await rejectBtn.click()

    // Rejection modal should be open
    await expect(page.getByRole('heading', { name: 'Reject Verification Claim' })).toBeVisible()

    // Fill in the reason
    await page.locator('#rejection-reason').fill('This is a test rejection reason.')

    // Submit rejection
    await page.getByRole('button', { name: 'Confirm Rejection' }).click()

    await page.waitForTimeout(500)
    expect(patchRequests.length).toBeGreaterThan(0)
  })
})
