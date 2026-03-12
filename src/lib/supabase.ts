import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

/**
 * Single Supabase client instance for the entire application.
 * 
 * Configuration:
 * - Auth: Auto-refresh tokens, persist session, detect session in URL
 * - Realtime: Limited to 10 events per second to prevent flooding
 * - All auth changes are handled by AuthProvider (see providers/AuthProvider.tsx)
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types for our database tables
export interface PhotoFace {
  id: string
  name: string
  x: number
  y: number
}

export interface Photo {
  id: string
  url: string
  thumbnail: string
  caption?: string
  category?: string
  location?: string
  date?: string
  likes: number
  photographer?: string
  is_professional: boolean
  tags: string[]
  faces: PhotoFace[]
  created_at: string
}

export interface GuestUpload {
  id: string
  guest_name: string
  guest_email: string
  message?: string
  photo_urls: string[]
  video_urls: string[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface GuestbookMessage {
  id: string
  name: string
  email: string
  content: string
  type: 'text' | 'voice' | 'video'
  media_url?: string
  reactions: Record<string, number>
  created_at: string
}

export type ModerationAuditEntityType = 'guest_upload' | 'guestbook_message'

export type ModerationAuditAction =
  | 'upload_moved_to_pending'
  | 'upload_approved_unpublished'
  | 'upload_approved_published'
  | 'upload_rejected'
  | 'upload_bulk_rejected'
  | 'guestbook_message_deleted'
  | 'guestbook_bulk_deleted'

export interface ModerationAuditLog {
  id: string
  entity_type: ModerationAuditEntityType
  entity_id: string
  action: ModerationAuditAction
  actor_user_id?: string | null
  actor_email?: string | null
  actor_name?: string | null
  from_status?: string | null
  to_status?: string | null
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ModerationAuditActor {
  userId?: string | null
  email?: string | null
  name?: string | null
}

export interface RecordModerationAuditInput {
  entityType: ModerationAuditEntityType
  entityId: string
  action: ModerationAuditAction
  summary: string
  metadata?: Record<string, unknown>
  fromStatus?: string | null
  toStatus?: string | null
  actor?: ModerationAuditActor | null
}

export interface ModerationAuditTimelineFilters {
  entityType?: ModerationAuditEntityType
  entityId?: string
  action?: ModerationAuditAction
  actorEmail?: string
  limit?: number
}

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
