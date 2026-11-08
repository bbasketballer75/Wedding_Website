import { describe, expect, it } from 'vitest'
import { DataError } from './errors'
import {
  MODERATION_ACTIONS,
  MODERATION_ENTITY_TYPES,
  fetchDashboardCounts,
  fetchModerationAuditForEntity,
  fetchModerationAuditTimeline,
  parseModerationAuditEntries,
  parseModerationAuditEntry,
  recordModerationAudit,
} from './moderation'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

const fixtures = loadFixtures()
const auditFixture = fixtures.adminSession.auditLog

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-new',
    entity_type: 'guest_upload',
    entity_id: 'upload-1',
    action: 'upload_approved_published',
    actor_user_id: null,
    actor_email: null,
    actor_name: null,
    from_status: null,
    to_status: null,
    summary: 'summary',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('moderation audit parsing (contracts/fixtures/adminSession.json)', () => {
  it('parses the frozen admin audit entries', () => {
    const entries = parseModerationAuditEntries(auditFixture)

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      id: 'audit-1',
      entityType: 'guest_upload',
      entityId: 'upload-pending-1',
      action: 'upload_approved_published',
      actorEmail: 'admin@test.wedding',
      actorName: 'Admin',
      summary: "Approved Riley Thompson's upload and published to gallery.",
    })
  })

  it('drops malformed entries', () => {
    expect(parseModerationAuditEntry(null)).toBeNull()
    expect(parseModerationAuditEntry({ id: 'a', entity_id: 'e' })).toBeNull()
    expect(parseModerationAuditEntries([auditFixture[0], null, {}])).toHaveLength(1)
  })

  it('exposes the frozen enums', () => {
    expect([...MODERATION_ENTITY_TYPES]).toEqual([
      'guest_upload',
      'guestbook_message',
      'photo_claim',
    ])
    expect([...MODERATION_ACTIONS]).toEqual([
      'upload_moved_to_pending',
      'upload_approved_unpublished',
      'upload_approved_published',
      'upload_removed_from_gallery',
      'upload_rejected',
      'upload_bulk_rejected',
      'guestbook_message_deleted',
      'guestbook_bulk_deleted',
      'claim_approved',
      'claim_rejected',
    ])
  })
})

describe('recordModerationAudit', () => {
  it('inserts the frozen payload and returns the row', async () => {
    const { client, calls } = createMockClient({
      tables: { moderation_audit_log: { data: [auditRow()] } },
    })

    const row = await recordModerationAudit(
      {
        entityType: 'guest_upload',
        entityId: 'upload-1',
        action: 'upload_approved_published',
        summary: 'Approved',
        fromStatus: 'pending',
        toStatus: 'approved',
        metadata: { album: 'Engagement' },
        actor: { userId: 'admin-1', email: 'admin@test.wedding', name: 'Admin' },
      },
      client
    )

    expect(row.id).toBe('audit-new')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'insert',
      args: [
        {
          entity_type: 'guest_upload',
          entity_id: 'upload-1',
          action: 'upload_approved_published',
          summary: 'Approved',
          metadata: { album: 'Engagement' },
          from_status: 'pending',
          to_status: 'approved',
          actor_user_id: 'admin-1',
          actor_email: 'admin@test.wedding',
          actor_name: 'Admin',
        },
      ],
    })
  })

  it('omits absent optional fields entirely (exactOptional-compatible)', async () => {
    const { client, calls } = createMockClient({
      tables: { moderation_audit_log: { data: [auditRow()] } },
    })

    await recordModerationAudit(
      {
        entityType: 'photo_claim',
        entityId: 'claim-1',
        action: 'claim_rejected',
        summary: 'Rejected',
      },
      client
    )

    const payload = calls.find(call => call.method === 'insert')?.args[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('from_status')
    expect(payload).not.toHaveProperty('to_status')
    expect(payload).not.toHaveProperty('actor_user_id')
    expect(payload.metadata).toEqual({})
  })

  it('rejects empty results and wraps errors', async () => {
    const empty = createMockClient({ tables: { moderation_audit_log: { data: [] } } })
    await expect(
      recordModerationAudit(
        { entityType: 'guest_upload', entityId: 'u', action: 'upload_rejected', summary: 'x' },
        empty.client
      )
    ).rejects.toMatchObject({ code: 'insert:empty-result' })

    const broken = createMockClient({
      tables: { moderation_audit_log: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(
      recordModerationAudit(
        { entityType: 'guest_upload', entityId: 'u', action: 'upload_rejected', summary: 'x' },
        broken.client
      )
    ).rejects.toBeInstanceOf(DataError)
  })
})

describe('moderation timeline', () => {
  it('applies every filter and the limit', async () => {
    const { client, calls } = createMockClient({
      tables: { moderation_audit_log: { data: auditFixture } },
    })

    const rows = await fetchModerationAuditTimeline(
      {
        entityType: 'guest_upload',
        entityId: 'upload-1',
        action: 'upload_approved_published',
        actorEmail: 'admin@test.wedding',
        limit: 10,
      },
      client
    )

    expect(rows).toHaveLength(3)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'eq',
      args: ['entity_type', 'guest_upload'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'eq',
      args: ['entity_id', 'upload-1'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'eq',
      args: ['action', 'upload_approved_published'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'eq',
      args: ['actor_email', 'admin@test.wedding'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'limit',
      args: [10],
    })
  })

  it('defaults to 200 rows and orders newest first', async () => {
    const { client, calls } = createMockClient({
      tables: { moderation_audit_log: { data: [] } },
    })

    await fetchModerationAuditTimeline({}, client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'limit',
      args: [200],
    })
  })

  it('fetchModerationAuditForEntity delegates with entity filters', async () => {
    const { client, calls } = createMockClient({
      tables: { moderation_audit_log: { data: [] } },
    })

    await fetchModerationAuditForEntity('photo_claim', 'claim-1', 5, client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'eq',
      args: ['entity_type', 'photo_claim'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'limit',
      args: [5],
    })
  })

  it('wraps read failures', async () => {
    const { client } = createMockClient({
      tables: { moderation_audit_log: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchModerationAuditTimeline({}, client)).rejects.toBeInstanceOf(DataError)
  })
})

describe('admin dashboard counts', () => {
  it('runs the four exact-count probes', async () => {
    const { client, calls } = createMockClient({
      tables: {
        photos: { count: 42 },
        guest_uploads: [{ count: 3 }, { count: 7 }],
        guestbook_messages: { count: 18 },
      },
    })

    await expect(fetchDashboardCounts(client)).resolves.toEqual({
      photos: 42,
      pendingUploads: 3,
      guestbookMessages: 18,
      approvedUploads: 7,
    })

    const headSelects = calls.filter(call => {
      const options = call.args[1]
      return (
        call.method === 'select' &&
        typeof options === 'object' &&
        options !== null &&
        (options as { count?: unknown }).count === 'exact'
      )
    })
    expect(headSelects).toHaveLength(4)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'eq',
      args: ['status', 'pending'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'eq',
      args: ['status', 'approved'],
    })
  })

  it('wraps count failures', async () => {
    const { client } = createMockClient({
      tables: { photos: { error: new Error('boom') } },
    })
    await expect(fetchDashboardCounts(client)).rejects.toBeInstanceOf(DataError)
  })
})
