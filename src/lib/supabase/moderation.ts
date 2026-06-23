/**
 * Moderation audit log — append-only history of every state-changing admin
 * action (guest upload approved/rejected/bulk, claim approved/rejected, etc.).
 *
 * Other modules (guestUploads, claims) call `recordModerationAudit` from this
 * module to log their state transitions.
 */
import { supabase } from './client'
import type {
  ModerationAuditEntityType,
  ModerationAuditLog,
  ModerationAuditTimelineFilters,
  RecordModerationAuditInput,
} from './types'

export async function recordModerationAudit(input: RecordModerationAuditInput) {
  return await supabase
    .from('moderation_audit_log')
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_user_id: input.actor?.userId ?? null,
      actor_email: input.actor?.email ?? null,
      actor_name: input.actor?.name ?? null,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single<ModerationAuditLog>()
}

export async function fetchModerationAuditTimeline(filters: ModerationAuditTimelineFilters = {}) {
  let query = supabase
    .from('moderation_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200)

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType)
  }

  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId)
  }

  if (filters.action) {
    query = query.eq('action', filters.action)
  }

  if (filters.actorEmail) {
    query = query.eq('actor_email', filters.actorEmail)
  }

  return await query.returns<ModerationAuditLog[]>()
}

export async function fetchModerationAuditForEntity(
  entityType: ModerationAuditEntityType,
  entityId: string,
  limit = 10
) {
  return await fetchModerationAuditTimeline({ entityType, entityId, limit })
}