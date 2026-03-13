import { createClient } from '@supabase/supabase-js'
import type { Json } from '@/types/supabase.generated'
import type { MemoryTrailId } from '@/data/memoryTrails'

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
  video_visibility?: 'archive_only' | 'guest_highlights' | 'featured'
  memory_trail?: MemoryTrailId | null
  editorial_title?: string | null
  editorial_summary?: string | null
  featured_rank?: number | null
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

export type SiteEditorialFeatureSlot =
  | 'home_newest_standout_upload'
  | 'home_featured_guestbook_note'
  | 'home_moment_of_the_week'
  | 'film_featured_guest_video'

export type SiteEditorialFeatureSourceType =
  | 'guest_upload'
  | 'guestbook_message'
  | 'film_chapter'
  | 'custom'

export interface SiteEditorialFeature {
  id: string
  slot: SiteEditorialFeatureSlot
  title: string
  summary?: string | null
  trail?: string | null
  memory_trail?: MemoryTrailId | null
  badge_label?: string | null
  cta_label?: string | null
  source_type: SiteEditorialFeatureSourceType
  source_id?: string | null
  source_label?: string | null
  source_url?: string | null
  is_active: boolean
  display_order: number
  metadata: Record<string, Json | undefined>
  starts_at?: string | null
  ends_at?: string | null
  updated_by_user_id?: string | null
  updated_by_email?: string | null
  created_at: string
  updated_at: string
}

export interface SiteEditorialFeatureHistoryEntry {
  id: string
  slot: SiteEditorialFeatureSlot
  feature_id?: string | null
  actor_user_id?: string | null
  actor_email?: string | null
  actor_name?: string | null
  change_summary: string
  previous_feature: Record<string, unknown>
  next_feature: Record<string, unknown>
  created_at: string
}

export interface SiteEditorialFeatureActor {
  userId?: string | null
  email?: string | null
}

export interface UpsertSiteEditorialFeatureInput {
  slot: SiteEditorialFeatureSlot
  title: string
  summary?: string | null
  trail?: string | null
  memoryTrail?: MemoryTrailId | null
  badgeLabel?: string | null
  ctaLabel?: string | null
  sourceType: SiteEditorialFeatureSourceType
  sourceId?: string | null
  sourceLabel?: string | null
  sourceUrl?: string | null
  startsAt?: string | null
  endsAt?: string | null
  isActive?: boolean
  displayOrder?: number
  metadata?: Record<string, Json | undefined>
  actor?: SiteEditorialFeatureActor | null
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

export async function fetchSiteEditorialFeatures(slot?: SiteEditorialFeatureSlot) {
  let query = supabase
    .from('site_editorial_features')
    .select('*')
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (slot) {
    query = query.eq('slot', slot)
  }

  return await query.returns<SiteEditorialFeature[]>()
}

export async function fetchSiteEditorialFeatureHistory(slot?: SiteEditorialFeatureSlot) {
  let query = supabase
    .from('site_editorial_feature_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  if (slot) {
    query = query.eq('slot', slot)
  }

  return await query.returns<SiteEditorialFeatureHistoryEntry[]>()
}

export async function fetchSiteEditorialFeatureBySlot(slot: SiteEditorialFeatureSlot) {
  return await supabase
    .from('site_editorial_features')
    .select('*')
    .eq('slot', slot)
    .maybeSingle<SiteEditorialFeature>()
}

export interface RecordSiteEditorialFeatureHistoryInput {
  slot: SiteEditorialFeatureSlot
  featureId?: string | null
  changeSummary: string
  previousFeature?: Record<string, unknown>
  nextFeature?: Record<string, unknown>
  actor?: ModerationAuditActor | null
}

export async function recordSiteEditorialFeatureHistory(input: RecordSiteEditorialFeatureHistoryInput) {
  return await supabase
    .from('site_editorial_feature_history')
    .insert({
      slot: input.slot,
      feature_id: input.featureId ?? null,
      actor_user_id: input.actor?.userId ?? null,
      actor_email: input.actor?.email ?? null,
      actor_name: input.actor?.name ?? null,
      change_summary: input.changeSummary,
      previous_feature: input.previousFeature ?? {},
      next_feature: input.nextFeature ?? {},
    })
    .select('*')
    .single<SiteEditorialFeatureHistoryEntry>()
}

export async function upsertSiteEditorialFeature(input: UpsertSiteEditorialFeatureInput) {
  return await supabase
    .from('site_editorial_features')
    .upsert(
      {
        slot: input.slot,
        title: input.title,
        summary: input.summary ?? null,
        trail: input.trail ?? null,
        memory_trail: input.memoryTrail ?? null,
        badge_label: input.badgeLabel ?? null,
        cta_label: input.ctaLabel ?? null,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        source_label: input.sourceLabel ?? null,
        source_url: input.sourceUrl ?? null,
        is_active: input.isActive ?? true,
        display_order: input.displayOrder ?? 0,
        metadata: input.metadata ?? {},
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        updated_by_user_id: input.actor?.userId ?? null,
        updated_by_email: input.actor?.email ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'slot',
      }
    )
    .select('*')
    .single<SiteEditorialFeature>()
}
