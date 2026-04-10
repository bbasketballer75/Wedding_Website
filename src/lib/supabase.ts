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
  box?: {
    left: number
    top: number
    width: number
    height: number
  } | null
}

export interface Photo {
  id: string
  url: string
  thumbnail: string
  download_url?: string | null
  album?: string
  album_sort_order?: number | null
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
  photo_fingerprints: string[]
  video_urls: string[]
  video_fingerprints: string[]
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
  email?: string
  content: string
  media_url?: string
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
  | 'upload_removed_from_gallery'
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

export type MediaReviewBatchStatus = 'pending' | 'in_review' | 'approved' | 'archived'
export type MediaReviewClusterStatus = 'pending' | 'confirmed' | 'ignored' | 'merged' | 'split_requested'
export type MediaReviewFaceStatus = 'pending' | 'confirmed' | 'ignored'
export type GuestFaceTaggingBatchStatus = 'prepared' | 'synced' | 'failed'

export interface MediaReviewBatch {
  id: string
  batch_key: string
  label: string
  status: MediaReviewBatchStatus
  source_root?: string | null
  working_root?: string | null
  artifact_bucket: string
  artifact_prefix: string
  artifact_paths: Record<string, Json | undefined>
  notes?: string | null
  cluster_count: number
  detection_count: number
  pushed_by_user_id?: string | null
  pushed_by_email?: string | null
  created_at: string
  updated_at: string
}

export interface MediaReviewClusterMember {
  faceId?: string
  sourceRecordId?: string | null
  sourceRelativePath?: string
  thumbnailPath?: string | null
  thumbnailObjectPath?: string | null
  x?: number
  y?: number
  box?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface MediaReviewCluster {
  id: string
  batch_id: string
  cluster_id: string
  review_status: MediaReviewClusterStatus
  confirmed_name?: string | null
  merge_into_cluster_id?: string | null
  split_requested: boolean
  split_notes?: string | null
  sample_thumbnail_path?: string | null
  member_count: number
  average_quality_score?: number | null
  source_record_ids: string[]
  members: MediaReviewClusterMember[]
  metadata: Record<string, Json | undefined>
  created_at: string
  updated_at: string
}

export interface UpdateMediaReviewClusterInput {
  reviewStatus?: MediaReviewClusterStatus
  confirmedName?: string | null
  mergeIntoClusterId?: string | null
  splitRequested?: boolean
  splitNotes?: string | null
}

export interface MediaReviewFace {
  id: string
  batch_id: string
  face_id: string
  cluster_id?: string | null
  source_record_id?: string | null
  source_relative_path?: string | null
  photo_url?: string | null
  thumbnail_url?: string | null
  thumbnail_object_path?: string | null
  x: number
  y: number
  box: Record<string, Json | undefined>
  quality_score?: number | null
  review_status: MediaReviewFaceStatus
  confirmed_name?: string | null
  person_key?: string | null
  notes?: string | null
  metadata: Record<string, Json | undefined>
  created_at: string
  updated_at: string
}

export interface GuestFaceTaggingBatch {
  id: string
  batch_key: string
  label: string
  status: GuestFaceTaggingBatchStatus
  exportable_upload_count: number
  exportable_photo_count: number
  synced_photo_count: number
  skipped_photo_count: number
  last_error?: string | null
  notes?: string | null
  metadata: Record<string, Json | undefined>
  created_by_user_id?: string | null
  created_by_email?: string | null
  synced_by_user_id?: string | null
  synced_by_email?: string | null
  last_synced_at?: string | null
  created_at: string
  updated_at: string
}

export interface PhotoCommentRecord {
  id: string
  photo_key: string
  author: string
  content: string
  created_at: string
  session_id?: string | null
  is_hidden?: boolean
  hidden_at?: string | null
  hidden_by_user_id?: string | null
  hidden_reason?: string | null
}

export interface AdminPhotoCommentRecord extends PhotoCommentRecord {
  album?: string | null
  caption?: string | null
  thumbnail?: string | null
  url?: string | null
}

export interface PhotoEngagementSummary {
  photo_key: string
  likes_count: number
  comments_count: number
  hidden_comments_count: number
}

export const PHOTO_ALBUMS = ['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads'] as const
export type PhotoAlbum = (typeof PHOTO_ALBUMS)[number]

export interface AlbumOrganizerPhoto extends Photo {
  album: PhotoAlbum
  album_sort_order: number
}

export interface AlbumOrganizerMoveInput {
  photoId: string
  targetAlbum: PhotoAlbum
}

export interface SaveAlbumOrganizationResult {
  saved_album: PhotoAlbum
  current_album_count: number
  moved_count: number
  deleted_count: number
}

export interface DeleteGalleryPhotosResult {
  deleted_count: number
  deleted_photo_keys: string[]
  deleted_photo_urls: string[]
}

export interface PhotoLikeStatus {
  photo_key: string
  likes_count: number
  liked: boolean
}

export interface UpdateMediaReviewFaceInput {
  reviewStatus?: MediaReviewFaceStatus
  confirmedName?: string | null
  personKey?: string | null
  notes?: string | null
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

export async function fetchMediaReviewBatches() {
  return await supabase
    .from('media_review_batches')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<MediaReviewBatch[]>()
}

export async function fetchKnownPeopleNames() {
  const names = new Set<string>()
  const pageSize = 500
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('photos')
      .select('faces')
      .range(from, to)
      .returns<Array<{ faces: PhotoFace[] | null }>>()

    if (error) {
      return { data: null, error }
    }

    const rows = data || []
    rows.forEach((row) => {
      ;(row.faces || []).forEach((face) => {
        const name = face.name?.trim()
        if (name) names.add(name)
      })
    })

    if (rows.length < pageSize) {
      break
    }

    from += pageSize
  }

  const { data: reviewFaces, error: reviewError } = await supabase
    .from('media_review_faces')
    .select('confirmed_name')
    .not('confirmed_name', 'is', null)
    .returns<Array<{ confirmed_name: string | null }>>()

  if (reviewError) {
    return { data: null, error: reviewError }
  }

  ;(reviewFaces || []).forEach((row) => {
    const name = row.confirmed_name?.trim()
    if (name) names.add(name)
  })

  return {
    data: [...names].sort((left, right) => left.localeCompare(right)),
    error: null,
  }
}

export async function fetchGuestFaceTaggingBatches() {
  return await supabase
    .from('guest_face_tagging_batches')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<GuestFaceTaggingBatch[]>()
}

export async function fetchPhotoLikeStatuses(photoKeys: string[], sessionId: string) {
  return await supabase
    .rpc('get_photo_like_statuses', {
      p_photo_keys: photoKeys,
      p_session_id: sessionId,
    })
    .returns<PhotoLikeStatus[]>()
}

export async function fetchPhotoEngagementSummary(photoKeys: string[]) {
  return await supabase
    .rpc('get_photo_engagement_summary_v1', {
      p_photo_keys: photoKeys,
    })
    .returns<PhotoEngagementSummary[]>()
}

export async function togglePhotoLike(photoKey: string, sessionId: string) {
  const response = await supabase
    .rpc('toggle_photo_like_v2', {
      p_photo_key: photoKey,
      p_session_id: sessionId,
    })

  if (response.error || !Array.isArray(response.data) || response.data.length === 0) {
    return {
      ...response,
      data: null,
    }
  }

  const status = response.data[0]

  return {
    ...response,
    data: {
      photo_key: status.result_photo_key,
      likes_count: status.result_likes_count,
      liked: status.result_liked,
    } satisfies PhotoLikeStatus,
  }
}

export async function fetchPhotoComments(photoKey: string) {
  return await supabase
    .from('photo_comments')
    .select('*')
    .eq('photo_key', photoKey)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .returns<PhotoCommentRecord[]>()
}

export async function addPhotoComment(
  photoKey: string,
  content: string,
  author = 'Guest',
  sessionId: string,
) {
  return await supabase
    .rpc('create_photo_comment_v1', {
      p_photo_key: photoKey,
      p_author: author,
      p_content: content,
      p_session_id: sessionId,
    })
    .single<PhotoCommentRecord>()
}

export async function fetchRecentPhotoComments(limit = 40) {
  return await supabase
    .rpc('get_recent_photo_comments_v1', {
      p_limit: limit,
    })
    .returns<AdminPhotoCommentRecord[]>()
}

export async function hidePhotoComment(commentId: string, hidden = true, reason?: string) {
  return await supabase
    .rpc('hide_photo_comment_v1', {
      p_comment_id: commentId,
      p_hidden: hidden,
      p_reason: reason ?? null,
    })
    .single<Pick<PhotoCommentRecord, 'id' | 'photo_key' | 'is_hidden'>>()
}

export async function deletePhotoComment(commentId: string) {
  return await supabase
    .rpc('delete_photo_comment_v1', {
      p_comment_id: commentId,
    })
    .single<{ deleted_id: string; photo_key: string }>()
}

export async function fetchAlbumPhotos(album: PhotoAlbum) {
  return await supabase
    .from('photos')
    .select('*')
    .eq('album', album)
    .order('album_sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<AlbumOrganizerPhoto[]>()
}

export async function fetchPhotoAlbumCounts() {
  const results = await Promise.all(
    PHOTO_ALBUMS.map(async (album) => {
      const response = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('album', album)

      return [album, response.count || 0] as const
    })
  )

  return Object.fromEntries(results) as Record<PhotoAlbum, number>
}

export async function fetchNextAlbumSortOrder(album: PhotoAlbum) {
  const { data, error } = await supabase
    .from('photos')
    .select('album_sort_order')
    .eq('album', album)
    .order('album_sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ album_sort_order: number | null }>()

  if (error) {
    return { data: 1, error }
  }

  return {
    data: Number(data?.album_sort_order || 0) + 1,
    error: null,
  }
}

export async function saveAlbumOrganization(
  album: PhotoAlbum,
  orderedPhotoIds: string[],
  moves: AlbumOrganizerMoveInput[],
  deletePhotoIds: string[] = [],
) {
  return await supabase
    .rpc('save_album_organization_v2', {
      p_album: album,
      p_ordered_photo_ids: orderedPhotoIds,
      p_moves: moves.map((move) => ({
        photoId: move.photoId,
        targetAlbum: move.targetAlbum,
      })),
      p_delete_photo_ids: deletePhotoIds,
    })
    .single<SaveAlbumOrganizationResult>()
}

export async function deleteGalleryPhotos({
  photoIds = [],
  photoUrls = [],
}: {
  photoIds?: string[]
  photoUrls?: string[]
}) {
  return await supabase
    .rpc('delete_gallery_photos_v1', {
      p_photo_ids: photoIds,
      p_photo_urls: photoUrls,
    })
    .single<DeleteGalleryPhotosResult>()
}

export async function fetchMediaReviewClusters(batchId: string) {
  return await supabase
    .from('media_review_clusters')
    .select('*')
    .eq('batch_id', batchId)
    .order('updated_at', { ascending: false })
    .returns<MediaReviewCluster[]>()
}

export async function fetchMediaReviewFaces(batchId: string) {
  return await supabase
    .from('media_review_faces')
    .select('*')
    .eq('batch_id', batchId)
    .order('updated_at', { ascending: false })
    .returns<MediaReviewFace[]>()
}

export async function updateMediaReviewBatchStatus(batchId: string, status: MediaReviewBatchStatus) {
  return await supabase
    .from('media_review_batches')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .select('*')
    .single<MediaReviewBatch>()
}

export async function updateMediaReviewCluster(clusterId: string, input: UpdateMediaReviewClusterInput) {
  return await supabase
    .from('media_review_clusters')
    .update({
      review_status: input.reviewStatus,
      confirmed_name: input.confirmedName,
      merge_into_cluster_id: input.mergeIntoClusterId,
      split_requested: input.splitRequested,
      split_notes: input.splitNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clusterId)
    .select('*')
    .single<MediaReviewCluster>()
}

export async function updateMediaReviewFace(faceId: string, input: UpdateMediaReviewFaceInput) {
  return await supabase
    .from('media_review_faces')
    .update({
      review_status: input.reviewStatus,
      confirmed_name: input.confirmedName,
      person_key: input.personKey,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', faceId)
    .select('*')
    .single<MediaReviewFace>()
}

export async function updateManyMediaReviewFaces(faceIds: string[], input: UpdateMediaReviewFaceInput) {
  return await supabase
    .from('media_review_faces')
    .update({
      review_status: input.reviewStatus,
      confirmed_name: input.confirmedName,
      person_key: input.personKey,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .in('id', faceIds)
    .select('*')
    .returns<MediaReviewFace[]>()
}

export async function createMediaReviewArtifactSignedUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds = 60 * 60
) {
  return await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds)
}

export async function downloadMediaReviewArtifact(bucket: string, objectPath: string) {
  return await supabase.storage
    .from(bucket)
    .download(objectPath)
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

export async function fetchWeddingDayPhotos(limit = 6): Promise<Photo[]> {
  // Try fetching photos from the Wedding Day album as a reliable fallback
  const { data, error } = await supabase
    .from('photos')
    .select('id, url, thumbnail, album, caption, faces, created_at')
    .eq('album', 'Wedding Day')
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Photo[]
}

export async function fetchPhotosWithFaces(): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, url, thumbnail, album, caption, faces')
    .not('faces', 'is', null)
    .neq('faces', '[]')
  if (error) throw error
  return (data ?? []) as Photo[]
}

export async function fetchApprovedGuestUploads(): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
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
