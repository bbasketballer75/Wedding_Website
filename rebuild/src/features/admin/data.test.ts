import { describe, expect, it, vi } from 'vitest'
import uiContract from '../../../../contracts/ui.json'
import {
  createInMemoryAdminApi,
  createInMemoryAuthClient,
  createSnapshotAuthClient,
  isAdminRoleMetadata,
  type AdminAuthSnapshot,
  type LogAuditInput,
} from './data'
import { getLastAuditInput } from './test-utils/createTestAdminRuntime'
import {
  ADMIN_FIXED_NOW,
  ADMIN_FIXTURES,
  FIXTURE_ADMIN_USER,
  FIXTURE_CREDENTIALS,
  FIXTURE_NON_ADMIN_USER,
} from './fixtures'

describe('admin fixtures', () => {
  it('are seeded from the frozen contracts and use the shared fixed clock', () => {
    expect(ADMIN_FIXED_NOW).toBe(uiContract.fixedNow)
    expect(FIXTURE_ADMIN_USER.email).toBe('admin@test.wedding')
    expect(FIXTURE_ADMIN_USER.role).toBe('admin')
    // The non-admin fixture's user_metadata-style role must never grant admin.
    expect(FIXTURE_NON_ADMIN_USER.role).toBe('authenticated')
    expect(ADMIN_FIXTURES.uploads.filter(upload => upload.status === 'pending')).toHaveLength(3)
    expect(ADMIN_FIXTURES.uploads.filter(upload => upload.status === 'approved')).toHaveLength(2)
    expect(ADMIN_FIXTURES.uploads.filter(upload => upload.status === 'rejected')).toHaveLength(1)
    expect(ADMIN_FIXTURES.messages).toHaveLength(3)
    expect(ADMIN_FIXTURES.claims.filter(claim => claim.status === 'pending')).toHaveLength(2)
  })

  it('keeps two synthetic credential pairs and no production secrets', () => {
    expect(FIXTURE_CREDENTIALS.map(entry => entry.email)).toEqual([
      'admin@test.wedding',
      'member@test.wedding',
    ])
    expect(FIXTURE_CREDENTIALS.every(entry => entry.password.length > 0)).toBe(true)
  })
})

describe('isAdminRoleMetadata', () => {
  it('grants admin only for app_metadata role=admin', () => {
    expect(isAdminRoleMetadata({ role: 'admin' })).toBe(true)
    expect(isAdminRoleMetadata({ role: 'authenticated' })).toBe(false)
    expect(isAdminRoleMetadata({ providers: ['email'] })).toBe(false)
    expect(isAdminRoleMetadata(null)).toBe(false)
    expect(isAdminRoleMetadata(undefined)).toBe(false)
  })
})

describe('createInMemoryAuthClient', () => {
  it('starts anonymous and exposes the snapshot contract', () => {
    const client = createInMemoryAuthClient({})
    expect(client.getSnapshot()).toEqual({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
    })
  })

  it('signs in admin fixtures and derives isAdmin from role', async () => {
    const client = createInMemoryAuthClient({})
    const result = await client.signIn('admin@test.wedding', 'admin-fixture-password')

    expect(result).toEqual({ success: true })
    expect(client.getSnapshot()).toMatchObject({
      isAuthenticated: true,
      isAdmin: true,
      user: { email: 'admin@test.wedding' },
    })
  })

  it('rejects wrong credentials with the frozen failure copy', async () => {
    const client = createInMemoryAuthClient({})
    await expect(client.signIn('admin@test.wedding', 'nope')).resolves.toEqual({
      success: false,
      error: 'Invalid email or password',
    })
    expect(client.getSnapshot().isAuthenticated).toBe(false)
  })

  it('signs in a non-admin account without granting admin', async () => {
    const client = createInMemoryAuthClient({})
    await expect(client.signIn('member@test.wedding', 'member-fixture-password')).resolves.toEqual({
      success: true,
    })
    expect(client.getSnapshot()).toMatchObject({ isAuthenticated: true, isAdmin: false })
  })

  it('notifies subscribers and clears state on sign out', async () => {
    const client = createInMemoryAuthClient({ initialUser: FIXTURE_ADMIN_USER })
    const listener = vi.fn()
    const unsubscribe = client.subscribe(listener)

    await client.signOut()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(client.getSnapshot()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
    })
    unsubscribe()
    await client.signOut()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('wraps a shared-data snapshot for the real wiring path', async () => {
    const snapshot: AdminAuthSnapshot = {
      user: FIXTURE_ADMIN_USER,
      isLoading: false,
      isAuthenticated: true,
      isAdmin: true,
    }
    const signIn = vi.fn(() => Promise.resolve({ success: true as const }))
    const signOut = vi.fn(() => Promise.resolve())
    const client = createSnapshotAuthClient(snapshot, { signIn, signOut })

    expect(client.getSnapshot()).toBe(snapshot)
    await client.signIn('a@b.c', 'pw')
    expect(signIn).toHaveBeenCalledWith('a@b.c', 'pw')
    expect(typeof client.subscribe(() => undefined)).toBe('function')
  })
})

describe('createInMemoryAdminApi', () => {
  it('serves the frozen dashboard counters', async () => {
    const api = createInMemoryAdminApi()
    await expect(api.fetchDashboardCounts()).resolves.toEqual({
      photos: 42,
      pendingUploads: 3,
      guestbookMessages: 18,
      approvedUploads: 7,
      peopleReviewBatchesInFlight: 0,
      lastGuestTaggingSyncLabel: 'No guest sync yet',
    })
  })

  it('filters uploads by status', async () => {
    const api = createInMemoryAdminApi()
    expect(await api.fetchUploads('pending')).toHaveLength(3)
    expect(await api.fetchUploads('approved')).toHaveLength(2)
    expect((await api.fetchUploads('rejected'))[0]?.rejection_reason).toContain('Too blurry')
  })

  it('approves an upload and audits actor + from→to', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { userId: 'admin-1', email: 'admin@test.wedding', name: 'Admin' }

    const updated = await api.moderateUpload({ id: 'upload-pending-1', action: 'approve', actor })

    expect(updated.status).toBe('approved')
    expect(await api.fetchUploads('approved')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'upload-pending-1' })])
    )
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'guest_upload',
        entityId: 'upload-pending-1',
        action: 'upload_approved_published',
        fromStatus: 'pending',
        toStatus: 'approved',
        actor,
      })
    )
    const log = await api.fetchAuditLog()
    expect(log[0]?.summary).toBe('Guest upload approved')
    expect(log[0]?.actorEmail).toBe('admin@test.wedding')
  })

  it('rejects an upload with an optional reason and audits it', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    const updated = await api.moderateUpload({
      id: 'upload-pending-2',
      action: 'reject',
      reason: 'Duplicate frame',
      actor,
    })

    expect(updated.status).toBe('rejected')
    expect(updated.rejection_reason).toBe('Duplicate frame')
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'upload_rejected',
        fromStatus: 'pending',
        toStatus: 'rejected',
        metadata: { rejection_reason: 'Duplicate frame' },
      })
    )
  })

  it('bulk approves and audits every selected upload', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    const updated = await api.bulkModerate({
      ids: ['upload-pending-1', 'upload-pending-2'],
      action: 'approve',
      actor,
    })

    expect(updated).toHaveLength(2)
    expect(auditSpy).toHaveBeenCalledTimes(2)
  })

  it('bulk rejects with the bulk action label and bulk_count metadata', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    await api.bulkModerate({
      ids: ['upload-pending-1', 'upload-pending-3'],
      action: 'reject',
      reason: 'Out of focus',
      actor,
    })

    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'upload_bulk_rejected',
        summary: 'Guest upload bulk rejected: Out of focus',
        metadata: { rejection_reason: 'Out of focus', bulk_count: 2 },
      })
    )
  })

  it('publishes approved photo URLs to one of the four albums and audits the album', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    const result = await api.publishToAlbum({
      ids: ['upload-approved-1', 'upload-approved-2'],
      album: 'Wedding Day',
      actor,
    })

    expect(result.published).toBe(4)
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'upload_approved_published',
        summary: 'Guest upload photos published to Wedding Day album',
        metadata: { album: 'Wedding Day' },
      })
    )
  })

  it('deletes one guestbook message and audits guestbook_message_deleted', async () => {
    const auditSpy = vi.fn<(entry: LogAuditInput) => void>()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    const deleted = await api.deleteGuestbookMessages({ ids: ['gb-msg-1'], actor })

    expect(deleted).toBe(1)
    expect(await api.fetchGuestbookMessages()).toHaveLength(2)
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'guestbook_message',
        entityId: 'gb-msg-1',
        action: 'guestbook_message_deleted',
        actor,
      })
    )
  })

  it('audits guestbook_bulk_deleted per message with a bulk_count', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    await api.deleteGuestbookMessages({ ids: ['gb-msg-1', 'gb-msg-2'], actor })

    expect(auditSpy).toHaveBeenCalledTimes(2)
    expect(getLastAuditInput(auditSpy)).toMatchObject({
      action: 'guestbook_bulk_deleted',
      metadata: { bulk_count: 2 },
    })
  })

  it('approves a claim (identity verification is delegated to the real data layer)', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    const updated = await api.moderateClaim({ id: 'claim-pending-1', decision: 'approve', actor })

    expect(updated.status).toBe('approved')
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'photo_claim',
        action: 'claim_approved',
        fromStatus: 'pending',
        toStatus: 'approved',
      })
    )
  })

  it('requires a rejection reason and records it in the audit entry', async () => {
    const auditSpy = vi.fn()
    const api = createInMemoryAdminApi({ onAudit: auditSpy })
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    await expect(
      api.moderateClaim({ id: 'claim-pending-1', decision: 'reject', reason: '  ', actor })
    ).rejects.toThrow('A rejection reason is required.')
    expect(auditSpy).not.toHaveBeenCalled()

    const updated = await api.moderateClaim({
      id: 'claim-pending-1',
      decision: 'reject',
      reason: 'Face belongs to another guest',
      actor,
    })

    expect(updated.status).toBe('rejected')
    expect(updated.rejectionReason).toBe('Face belongs to another guest')
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'claim_rejected',
        metadata: { rejection_reason: 'Face belongs to another guest' },
      })
    )
  })

  it('returns the audit log newest-first capped at 500 rows', async () => {
    const api = createInMemoryAdminApi()
    const actor = { email: 'admin@test.wedding', name: 'Admin' }

    for (let index = 0; index < 505; index += 1) {
      await api.logAudit({
        entityType: 'guest_upload',
        entityId: `upload-${index}`,
        action: 'upload_approved_unpublished',
        actor,
        summary: `Entry ${index}`,
      })
    }

    const log = await api.fetchAuditLog()
    expect(log).toHaveLength(500)
    expect(log[0]?.summary).toBe('Entry 504')
    expect(Date.parse(log[0]?.createdAt ?? '')).toBeGreaterThan(Date.parse(log[1]?.createdAt ?? ''))
  })
})
