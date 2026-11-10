/**
 * Adapter tests for `app/routes/admin-api.ts` (Wave 9 W9-5).
 *
 * Every test injects the structural mock client from
 * `shared/data/test-support/mock-client` and asserts the exact table/RPC query
 * shapes the adapter emits, the frozen error copy, empty-state behaviour, and
 * the "no double audit logging" invariant (mutation paths must write exactly one
 * `moderation_audit_log` row per entity — the shared-data mutations do it, the
 * adapter must not repeat it).
 */
import { describe, expect, it } from 'vitest'
import {
  ADMIN_API_ERROR_COPY,
  ADMIN_AUDIT_LOG_LIMIT,
  createSupabaseAdminApi,
} from '@/app/routes/admin-api'
import { DataError } from '@/shared/data/errors'
import { loadFixtures } from '@/shared/data/test-support/fixtures'
import {
  createMockClient,
  type MockCall,
  type MockClientConfig,
} from '@/shared/data/test-support/mock-client'

const fixtures = loadFixtures()
const adminAuditSeed = fixtures.adminSession.auditLog
const adminMessages = fixtures.guestbook.adminMessages
const pendingClaimRaw = fixtures.claims.pending[0] as Record<string, unknown>

// ─── Fixture builders (wire shapes the data layer parses) ───────────────────

function uploadRow(
  status: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'upload-1',
    guest_name: 'Riley Thompson',
    guest_email: 'riley@example.com',
    message: 'Captured a few special moments from our table!',
    photo_urls: ['/images/engagement/PoradaProposal-29.webp'],
    video_urls: [],
    photo_fingerprints: ['fp-1'],
    video_fingerprints: [],
    status,
    created_at: '2025-05-11T09:00:00Z',
    video_visibility: 'archive_only',
    memory_trail: null,
    editorial_title: null,
    editorial_summary: null,
    featured_rank: null,
    rejection_reason: null,
    ...overrides,
  }
}

function auditRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'audit-mock-1',
    entity_type: 'guest_upload',
    entity_id: 'upload-1',
    action: 'upload_approved_published',
    actor_user_id: null,
    actor_email: null,
    actor_name: null,
    from_status: null,
    to_status: null,
    summary: 'Mock audit row',
    metadata: {},
    created_at: '2025-05-11T10:00:00Z',
    ...overrides,
  }
}

function batchRow(status: string, id = `batch-${status}`): Record<string, unknown> {
  return {
    id,
    batch_key: id,
    label: 'Guest uploads',
    status,
    artifact_bucket: 'media-review-artifacts',
    artifact_prefix: id,
    artifact_paths: {},
    cluster_count: 1,
    detection_count: 2,
    notes: null,
    created_at: '2025-05-12T09:00:00Z',
    updated_at: '2025-05-13T09:00:00Z',
  }
}

function taggingRow(lastSyncedAt: string | null): Record<string, unknown> {
  return {
    id: 'tagging-1',
    batch_key: 'guest-tagging',
    label: 'Guest tagging',
    status: 'synced',
    exportable_upload_count: 2,
    exportable_photo_count: 4,
    synced_photo_count: 4,
    skipped_photo_count: 0,
    last_error: null,
    last_synced_at: lastSyncedAt,
    created_at: '2025-05-12T09:00:00Z',
    updated_at: '2025-05-13T09:00:00Z',
  }
}

const actor = { userId: 'admin-1', email: 'admin@test.wedding', name: 'Admin' }

// ─── Call-shape helpers ─────────────────────────────────────────────────────

function callsTo(calls: readonly MockCall[], target: string, method: string): MockCall[] {
  return calls.filter(call => call.target === target && call.method === method)
}

function auditInserts(calls: readonly MockCall[]): Array<Record<string, unknown>> {
  return callsTo(calls, 'moderation_audit_log', 'insert').map(
    call => call.args[0] as Record<string, unknown>
  )
}

function makeApi(config: MockClientConfig) {
  const handle = createMockClient(config)
  return { api: createSupabaseAdminApi(handle.client), handle }
}

async function expectFrozenCopy(
  operation: Promise<unknown>,
  copy: string,
  expectedCode?: string
): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(DataError)
  await operation.catch((error: unknown) => {
    const dataError = error as DataError
    expect(dataError.message).toBe(copy)
    if (expectedCode) expect(dataError.code).toBe(expectedCode)
    expect(dataError.message).not.toMatch(/permission denied|postgrest/i)
  })
}

// ─── Dashboard counts ──────────────────────────────────────────────────────

describe('fetchDashboardCounts', () => {
  it('maps the four count probes plus the review/tagging signals', async () => {
    const { api, handle } = makeApi({
      tables: {
        photos: { count: 42 },
        guest_uploads: [{ count: 3 }, { count: 7 }],
        guestbook_messages: { count: 18 },
        media_review_batches: {
          data: [batchRow('in_review'), batchRow('pending', 'batch-pending'), batchRow('approved')],
        },
        guest_face_tagging_batches: { data: [taggingRow('2025-05-14T09:00:00.000Z')] },
      },
    })

    const counts = await api.fetchDashboardCounts()

    expect(counts).toEqual({
      photos: 42,
      pendingUploads: 3,
      guestbookMessages: 18,
      approvedUploads: 7,
      peopleReviewBatchesInFlight: 2,
      lastGuestTaggingSyncLabel: new Date('2025-05-14T09:00:00.000Z').toLocaleString(),
    })

    // Frozen count probes: head-only exact counts, pending/approved filters.
    expect(callsTo(handle.calls, 'guest_uploads', 'select')).toHaveLength(2)
    expect(callsTo(handle.calls, 'guest_uploads', 'eq').map(call => call.args)).toEqual([
      ['status', 'pending'],
      ['status', 'approved'],
    ])
    expect(callsTo(handle.calls, 'media_review_batches', 'order')[0]?.args).toEqual([
      'updated_at',
      { ascending: false },
    ])
    expect(callsTo(handle.calls, 'guest_face_tagging_batches', 'order')[0]?.args).toEqual([
      'updated_at',
      { ascending: false },
    ])
  })

  it('falls back to the frozen "no sync yet" label when no tagging batch synced', async () => {
    const { api } = makeApi({
      tables: {
        photos: { count: 0 },
        guest_uploads: [{ count: 0 }, { count: 0 }],
        guestbook_messages: { count: 0 },
        media_review_batches: { data: [] },
        guest_face_tagging_batches: { data: [taggingRow(null)] },
      },
    })

    const counts = await api.fetchDashboardCounts()
    expect(counts.peopleReviewBatchesInFlight).toBe(0)
    expect(counts.lastGuestTaggingSyncLabel).toBe('No guest sync yet')
  })
})

// ─── Upload moderation ─────────────────────────────────────────────────────

describe('upload moderation', () => {
  it('reads one status queue in frozen order and maps rows', async () => {
    const { api, handle } = makeApi({
      tables: { guest_uploads: { data: [uploadRow('pending')] } },
    })

    const uploads = await api.fetchUploads('pending')

    expect(uploads).toHaveLength(1)
    expect(uploads[0]).toMatchObject({
      id: 'upload-1',
      status: 'pending',
      photoUrls: ['/images/engagement/PoradaProposal-29.webp'],
    })
    expect(callsTo(handle.calls, 'guest_uploads', 'eq')[0]?.args).toEqual(['status', 'pending'])
    expect(callsTo(handle.calls, 'guest_uploads', 'order')[0]?.args).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('approves via the shared mutation (one audit row) and returns the updated upload', async () => {
    const { api, handle } = makeApi({
      tables: {
        guest_uploads: [
          { data: { status: 'pending' } },
          { data: null },
          { data: uploadRow('approved') },
        ],
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    const upload = await api.moderateUpload({ id: 'upload-1', action: 'approve', actor })

    expect(upload.status).toBe('approved')
    expect(callsTo(handle.calls, 'guest_uploads', 'update')[0]?.args).toEqual([
      { status: 'approved' },
    ])
    // Exactly one audit row: the shared-data mutation owns the audit write.
    expect(auditInserts(handle.calls)).toHaveLength(1)
    expect(auditInserts(handle.calls)[0]).toMatchObject({
      entity_type: 'guest_upload',
      entity_id: 'upload-1',
      action: 'upload_approved_published',
      from_status: 'pending',
      to_status: 'approved',
      actor_email: 'admin@test.wedding',
    })
  })

  it('rejects with the trimmed reason and returns the rejected upload', async () => {
    const { api, handle } = makeApi({
      tables: {
        guest_uploads: [
          { data: { status: 'pending' } },
          { data: null },
          { data: uploadRow('rejected', { rejection_reason: 'Blurry' }) },
        ],
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    const upload = await api.moderateUpload({
      id: 'upload-1',
      action: 'reject',
      reason: '  Blurry  ',
      actor,
    })

    expect(upload.status).toBe('rejected')
    expect(callsTo(handle.calls, 'guest_uploads', 'update')[0]?.args).toEqual([
      { status: 'rejected', rejection_reason: 'Blurry' },
    ])
    expect(auditInserts(handle.calls)).toHaveLength(1)
    expect(auditInserts(handle.calls)[0]).toMatchObject({
      action: 'upload_rejected',
      summary: 'Guest upload rejected: Blurry',
      metadata: { rejection_reason: 'Blurry' },
    })
  })

  it('bulk-rejects with one audit row per upload and re-reads the queue rows', async () => {
    const { api, handle } = makeApi({
      tables: {
        guest_uploads: [
          { data: null },
          { data: [uploadRow('rejected', { id: 'a' }), uploadRow('rejected', { id: 'b' })] },
        ],
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    const uploads = await api.bulkModerate({
      ids: ['a', 'b'],
      action: 'reject',
      reason: 'Duplicate',
      actor,
    })

    expect(uploads.map(upload => upload.id)).toEqual(['a', 'b'])
    expect(callsTo(handle.calls, 'guest_uploads', 'in')[0]?.args).toEqual(['id', ['a', 'b']])
    expect(auditInserts(handle.calls)).toHaveLength(2)
    for (const insert of auditInserts(handle.calls)) {
      expect(insert).toMatchObject({
        action: 'upload_bulk_rejected',
        summary: 'Guest upload bulk rejected: Duplicate',
      })
    }
  })

  it('publishes to the frozen album vocabulary and audits once per upload', async () => {
    const { api, handle } = makeApi({
      tables: {
        guest_uploads: {
          data: [{ id: 'a', guest_name: 'Riley Thompson', photo_urls: ['u1', 'u2'] }],
        },
        photos: { data: [{ id: 'p1' }, { id: 'p2' }] },
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    const result = await api.publishToAlbum({ ids: ['a'], album: 'Wedding Day', actor })

    expect(result).toEqual({ published: 2 })
    expect(callsTo(handle.calls, 'photos', 'insert')[0]?.args[0]).toEqual([
      expect.objectContaining({ url: 'u1', album: 'Wedding Day', category: 'Wedding Day' }),
      expect.objectContaining({ url: 'u2', album: 'Wedding Day', category: 'Wedding Day' }),
    ])
    expect(auditInserts(handle.calls)).toHaveLength(1)
    expect(auditInserts(handle.calls)[0]).toMatchObject({
      summary: 'Guest upload photos published to Wedding Day album',
      metadata: { album: 'Wedding Day' },
    })
  })

  it('rejects an album outside the frozen vocabulary without touching the client', async () => {
    const { api, handle } = makeApi({})

    await expectFrozenCopy(
      api.publishToAlbum({
        ids: ['a'],
        album: 'Not An Album' as never,
        actor,
      }),
      ADMIN_API_ERROR_COPY.publish,
      'validation:album'
    )
    expect(handle.calls).toHaveLength(0)
  })
})

// ─── Guestbook moderation ──────────────────────────────────────────────────

describe('guestbook moderation', () => {
  it('reads admin rows (email + replies) newest first', async () => {
    const { api, handle } = makeApi({
      tables: { guestbook_messages: { data: adminMessages } },
    })

    const messages = await api.fetchGuestbookMessages()

    expect(messages).toHaveLength(adminMessages.length)
    expect(messages[0]).toMatchObject({
      id: 'gb-msg-1',
      name: 'Sarah Mitchell',
      email: 'sarah@example.com',
    })
    const selectCall = callsTo(handle.calls, 'guestbook_messages', 'select')[0]
    expect(selectCall?.args[0]).toContain('email')
    expect(callsTo(handle.calls, 'guestbook_messages', 'order')[0]?.args).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('bulk-deletes and writes one bulk audit row per message', async () => {
    const { api, handle } = makeApi({
      tables: {
        guestbook_messages: [
          { data: adminMessages.slice(0, 2) },
          { data: [{ id: 'gb-msg-1' }, { id: 'gb-msg-2' }] },
        ],
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    const deleted = await api.deleteGuestbookMessages({
      ids: ['gb-msg-1', 'gb-msg-2'],
      actor,
    })

    expect(deleted).toBe(2)
    expect(callsTo(handle.calls, 'guestbook_messages', 'delete')[0]?.args).toEqual([])
    expect(callsTo(handle.calls, 'guestbook_messages', 'in')[0]?.args).toEqual([
      'id',
      ['gb-msg-1', 'gb-msg-2'],
    ])
    expect(auditInserts(handle.calls)).toHaveLength(2)
    expect(auditInserts(handle.calls)[0]).toMatchObject({
      entity_type: 'guestbook_message',
      action: 'guestbook_bulk_deleted',
      summary: 'Deleted guestbook message from Sarah Mitchell.',
      metadata: { bulk_count: 2 },
    })
  })

  it('single-delete uses the single-message audit action', async () => {
    const { api, handle } = makeApi({
      tables: {
        guestbook_messages: [{ data: adminMessages.slice(0, 1) }, { data: [{ id: 'gb-msg-1' }] }],
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    await api.deleteGuestbookMessages({ ids: ['gb-msg-1'], actor })

    const inserts = auditInserts(handle.calls)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ action: 'guestbook_message_deleted' })
    expect(inserts[0]?.['metadata']).not.toHaveProperty('bulk_count')
  })
})

// ─── Claims ────────────────────────────────────────────────────────────────

function updatedClaim(status: string): Record<string, unknown> {
  return { ...pendingClaimRaw, status, updated_at: '2025-05-14T10:00:00Z' }
}

describe('claims moderation', () => {
  it('reads the claim queue with the relation select in frozen order', async () => {
    const { api, handle } = makeApi({
      tables: { photo_claims: { data: fixtures.claims.pending } },
    })

    const claims = await api.fetchClaims('pending')

    expect(claims.length).toBeGreaterThan(0)
    expect(claims[0]).toMatchObject({ id: 'claim-pending-1', status: 'pending' })
    expect(callsTo(handle.calls, 'photo_claims', 'select')[0]?.args[0]).toBe(
      '*, guest_identities(*), photos(*)'
    )
    expect(callsTo(handle.calls, 'photo_claims', 'eq')[0]?.args).toEqual(['status', 'pending'])
    expect(callsTo(handle.calls, 'photo_claims', 'order')[0]?.args).toEqual([
      'created_at',
      { ascending: false },
    ])
  })

  it('approves via the shared transition (identity verified, face synced, one audit row)', async () => {
    const { api, handle } = makeApi({
      tables: {
        photo_claims: [
          { data: pendingClaimRaw },
          { data: null },
          { data: updatedClaim('approved') },
        ],
        guest_identities: { data: null },
        media_review_faces: { data: null },
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    const claim = await api.moderateClaim({ id: 'claim-pending-1', decision: 'approve', actor })

    expect(claim.status).toBe('approved')
    expect(callsTo(handle.calls, 'guest_identities', 'update')[0]?.args).toEqual([
      { is_verified: true },
    ])
    expect(callsTo(handle.calls, 'media_review_faces', 'update')).toHaveLength(1)
    expect(auditInserts(handle.calls)).toHaveLength(1)
    expect(auditInserts(handle.calls)[0]).toMatchObject({
      entity_type: 'photo_claim',
      action: 'claim_approved',
      to_status: 'approved',
    })
  })

  it('rejects with a trimmed reason and the rejection audit metadata', async () => {
    const { api, handle } = makeApi({
      tables: {
        photo_claims: [
          { data: pendingClaimRaw },
          { data: null },
          { data: updatedClaim('rejected') },
        ],
        moderation_audit_log: { data: [auditRow()] },
      },
    })

    await api.moderateClaim({
      id: 'claim-pending-1',
      decision: 'reject',
      reason: '  Photos do not match  ',
      actor,
    })

    expect(callsTo(handle.calls, 'photo_claims', 'update')[0]?.args[0]).toMatchObject({
      status: 'rejected',
      rejection_reason: 'Photos do not match',
    })
    expect(callsTo(handle.calls, 'media_review_faces', 'update')).toHaveLength(0)
    expect(auditInserts(handle.calls)).toHaveLength(1)
    expect(auditInserts(handle.calls)[0]).toMatchObject({
      action: 'claim_rejected',
      metadata: { rejection_reason: 'Photos do not match' },
    })
  })

  it('requires a rejection reason before touching the data layer', async () => {
    const { api, handle } = makeApi({})

    await expectFrozenCopy(
      api.moderateClaim({ id: 'claim-1', decision: 'reject', actor }),
      ADMIN_API_ERROR_COPY.missingRejectionReason,
      'validation:reason'
    )
    expect(handle.calls).toHaveLength(0)
  })
})

// ─── Audit log ─────────────────────────────────────────────────────────────

describe('audit log', () => {
  it('reads the frozen 500-row newest-first timeline', async () => {
    const { api, handle } = makeApi({
      tables: { moderation_audit_log: { data: adminAuditSeed } },
    })

    const entries = await api.fetchAuditLog()

    expect(entries).toHaveLength(adminAuditSeed.length)
    expect(entries[0]).toMatchObject({ id: 'audit-1', entityType: 'guest_upload' })
    expect(callsTo(handle.calls, 'moderation_audit_log', 'order')[0]?.args).toEqual([
      'created_at',
      { ascending: false },
    ])
    expect(callsTo(handle.calls, 'moderation_audit_log', 'limit')[0]?.args).toEqual([
      ADMIN_AUDIT_LOG_LIMIT,
    ])
  })

  it('logAudit writes one audit row with the actor and parses the result', async () => {
    const { api, handle } = makeApi({
      tables: {
        moderation_audit_log: {
          data: [
            auditRow({
              entity_type: 'guestbook_message',
              entity_id: 'gb-msg-1',
              action: 'guestbook_message_deleted',
              summary: 'Deleted guestbook message from Sarah Mitchell.',
              actor_email: 'admin@test.wedding',
              actor_name: 'Admin',
              actor_user_id: 'admin-1',
              from_status: null,
              to_status: 'deleted',
            }),
          ],
        },
      },
    })

    const entry = await api.logAudit({
      entityType: 'guestbook_message',
      entityId: 'gb-msg-1',
      action: 'guestbook_message_deleted',
      summary: 'Deleted guestbook message from Sarah Mitchell.',
      actor,
      toStatus: 'deleted',
    })

    expect(entry).toMatchObject({
      id: 'audit-mock-1',
      entityType: 'guestbook_message',
      entityId: 'gb-msg-1',
      action: 'guestbook_message_deleted',
      actorEmail: 'admin@test.wedding',
      toStatus: 'deleted',
    })
    const inserts = auditInserts(handle.calls)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      entity_type: 'guestbook_message',
      entity_id: 'gb-msg-1',
      action: 'guestbook_message_deleted',
      actor_user_id: 'admin-1',
      actor_email: 'admin@test.wedding',
      actor_name: 'Admin',
      to_status: 'deleted',
    })
  })
})

// ─── Error mapping + empty states ─────────────────────────────────────────

describe('error mapping and empty states', () => {
  it('maps raw PostgREST failures to the frozen copy and keeps the safe code', async () => {
    const { api } = makeApi({
      tables: {
        guest_uploads: {
          error: {
            message: 'permission denied for table guest_uploads',
            code: '42501',
          },
        },
      },
    })

    await expectFrozenCopy(
      api.fetchUploads('pending'),
      ADMIN_API_ERROR_COPY.uploadsRead,
      'postgrest:42501'
    )
  })

  it('maps DataError messages (never the raw text) on mutation failures', async () => {
    const { api } = makeApi({
      tables: {
        guest_uploads: {
          error: { message: 'permission denied for table guest_uploads', code: '42501' },
        },
      },
    })

    await expectFrozenCopy(
      api.moderateUpload({ id: 'upload-1', action: 'approve', actor }),
      ADMIN_API_ERROR_COPY.uploadApprove,
      'postgrest:42501'
    )
  })

  it('returns empty collections when the tables are empty', async () => {
    const { api } = makeApi({
      tables: {
        guest_uploads: { data: [] },
        guestbook_messages: { data: [] },
        photo_claims: { data: [] },
        moderation_audit_log: { data: [] },
      },
    })

    await expect(api.fetchUploads('pending')).resolves.toEqual([])
    await expect(api.fetchGuestbookMessages()).resolves.toEqual([])
    await expect(api.fetchClaims('approved')).resolves.toEqual([])
    await expect(api.fetchAuditLog()).resolves.toEqual([])
  })

  it('treats an empty id list as a no-op for mutations', async () => {
    const { api, handle } = makeApi({})

    await expect(api.bulkModerate({ ids: [], action: 'approve', actor })).resolves.toEqual([])
    await expect(api.deleteGuestbookMessages({ ids: [], actor })).resolves.toBe(0)
    await expect(api.publishToAlbum({ ids: [], album: 'Wedding Day', actor })).resolves.toEqual({
      published: 0,
    })
    expect(handle.calls).toHaveLength(0)
  })
})
