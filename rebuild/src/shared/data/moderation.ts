/**
 * Moderation audit log + admin dashboard counters.
 *
 * Frozen surface: `src/lib/supabase/moderation.ts` (record + timeline) and
 * `src/pages/admin/Dashboard.tsx` (four count-only probes).
 *
 * Baseline notes (A3 §6):
 * - actor fields are client-supplied, so any authenticated writer can forge an
 *   actor; the rebuild should move this insert behind an RPC that derives the
 *   actor from the JWT (tracked in the audit; not changed in Wave 3).
 * - `action` has no DB CHECK constraint, so the union here is the app contract.
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { DataError, toDataError, unwrapResult } from './errors'
import type { Json, TableRow } from './schema'
import { isJsonObject } from './schema'

export type ModerationAuditLogRow = TableRow<'moderation_audit_log'>

/** Entities that can be moderated (mirrors the DB CHECK constraint). */
export const MODERATION_ENTITY_TYPES = ['guest_upload', 'guestbook_message', 'photo_claim'] as const
export type ModerationEntityType = (typeof MODERATION_ENTITY_TYPES)[number]

/** Actions the frozen app records (client-side union; DB has no CHECK). */
export const MODERATION_ACTIONS = [
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
] as const
export type ModerationAuditAction = (typeof MODERATION_ACTIONS)[number]

/** Who performed a moderation action. */
export interface ModerationAuditActor {
  userId?: string | null
  email?: string | null
  name?: string | null
}

/** Input for appending one audit entry. */
export interface RecordModerationAuditInput {
  entityType: ModerationEntityType
  entityId: string
  action: ModerationAuditAction
  summary: string
  metadata?: Json
  fromStatus?: string | null
  toStatus?: string | null
  actor?: ModerationAuditActor | null
}

/** Filters for the admin audit timeline. */
export interface ModerationAuditTimelineFilters {
  entityType?: ModerationEntityType
  entityId?: string
  action?: ModerationAuditAction
  actorEmail?: string
  limit?: number
}

/** Normalised audit entry consumed by the admin timeline UI. */
export interface ModerationAuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  actorEmail: string | null
  actorName: string | null
  fromStatus: string | null
  toStatus: string | null
  summary: string
  metadata: Json
  createdAt: string
}

const MODERATION_READ_ERROR = 'The moderation history could not be loaded. Please try again.'
const MODERATION_WRITE_ERROR = 'The moderation action could not be recorded. Please try again.'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Parse one audit entry (tolerates the admin fixture's older `actor_id` shape). */
export function parseModerationAuditEntry(raw: unknown): ModerationAuditEntry | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const entityId = asString(record.entity_id)
  const summary = asString(record.summary)
  if (!id || !entityId || summary === null) return null

  return {
    id,
    entityType: asString(record.entity_type) ?? 'unknown',
    entityId,
    action: asString(record.action) ?? 'unknown',
    actorEmail: asString(record.actor_email),
    actorName: asString(record.actor_name),
    fromStatus: asString(record.from_status),
    toStatus: asString(record.to_status),
    summary,
    metadata: isJsonObject(record.metadata) ? record.metadata : {},
    createdAt: asString(record.created_at) ?? '',
  }
}

/** Parse a list, dropping malformed entries. */
export function parseModerationAuditEntries(raw: readonly unknown[]): ModerationAuditEntry[] {
  const entries: ModerationAuditEntry[] = []
  for (const item of raw) {
    const entry = parseModerationAuditEntry(item)
    if (entry) entries.push(entry)
  }
  return entries
}

/**
 * Append one audit entry. Callers are the moderation transitions in
 * `guestUploads.ts` / `claims.ts`; a failed audit write never blocks the
 * transition itself (the frozen app logs and continues out of band — here the
 * caller decides, we throw so it is observable in dev/tests).
 */
export async function recordModerationAudit(
  input: RecordModerationAuditInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<ModerationAuditLogRow> {
  const actor = input.actor ?? null

  const rows = unwrapResult(
    await client
      .from('moderation_audit_log')
      .insert({
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        summary: input.summary,
        metadata: input.metadata ?? {},
        ...(input.fromStatus !== undefined && input.fromStatus !== null
          ? { from_status: input.fromStatus }
          : {}),
        ...(input.toStatus !== undefined && input.toStatus !== null
          ? { to_status: input.toStatus }
          : {}),
        ...(actor?.userId != null ? { actor_user_id: actor.userId } : {}),
        ...(actor?.email != null ? { actor_email: actor.email } : {}),
        ...(actor?.name != null ? { actor_name: actor.name } : {}),
      })
      .select('*'),
    MODERATION_WRITE_ERROR
  )

  const row = (rows ?? [])[0]
  if (!row) {
    throw new DataError({
      message: MODERATION_WRITE_ERROR,
      code: 'insert:empty-result',
      cause: { table: 'moderation_audit_log', action: input.action },
    })
  }
  return row
}

/** Admin timeline, newest first, with the frozen app's filters. */
export async function fetchModerationAuditTimeline(
  filters: ModerationAuditTimelineFilters = {},
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<ModerationAuditLogRow[]> {
  let query = client
    .from('moderation_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200)

  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.entityId) query = query.eq('entity_id', filters.entityId)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.actorEmail) query = query.eq('actor_email', filters.actorEmail)

  const rows = unwrapResult(await query, MODERATION_READ_ERROR)
  return rows ?? []
}

/** Short history for one entity (admin detail drawers). */
export async function fetchModerationAuditForEntity(
  entityType: ModerationEntityType,
  entityId: string,
  limit = 10,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<ModerationAuditLogRow[]> {
  return fetchModerationAuditTimeline({ entityType, entityId, limit }, client)
}

/** Counters shown on the admin dashboard. */
export interface DashboardCounts {
  photos: number
  pendingUploads: number
  guestbookMessages: number
  approvedUploads: number
}

async function fetchExactCount(
  query: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  const { count, error } = await query
  if (error) throw toDataError(error, MODERATION_READ_ERROR)
  return count ?? 0
}

/** Four count-only probes, in parallel (frozen dashboard behaviour). */
export async function fetchDashboardCounts(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<DashboardCounts> {
  const [photos, pendingUploads, guestbookMessages, approvedUploads] = await Promise.all([
    fetchExactCount(client.from('photos').select('*', { count: 'exact', head: true })),
    fetchExactCount(
      client
        .from('guest_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
    ),
    fetchExactCount(client.from('guestbook_messages').select('*', { count: 'exact', head: true })),
    fetchExactCount(
      client
        .from('guest_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
    ),
  ])

  return { photos, pendingUploads, guestbookMessages, approvedUploads }
}
