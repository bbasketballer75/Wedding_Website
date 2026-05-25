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

export interface PhotoComment {
  id: string
  author: string
  avatar?: string
  content: string
  timestamp: string
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
  blurHash?: string | null
  created_at: string
  // Optional UI-enrichment fields (not always fetched from DB)
  liked?: boolean
  likeCount?: number
  commentCount?: number
  comments?: PhotoComment[]
  time?: string
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
  rejection_reason?: string | null
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

export type ModerationAuditEntityType = 'guest_upload' | 'guestbook_message' | 'photo_claim'

export type ModerationAuditAction =
  | 'upload_moved_to_pending'
  | 'upload_approved_unpublished'
  | 'upload_approved_published'
  | 'upload_removed_from_gallery'
  | 'upload_rejected'
  | 'upload_bulk_rejected'
  | 'guestbook_message_deleted'
  | 'guestbook_bulk_deleted'
  | 'claim_approved'
  | 'claim_rejected'

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
export type MediaReviewClusterStatus =
  | 'pending'
  | 'confirmed'
  | 'ignored'
  | 'merged'
  | 'split_requested'
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
    rows.forEach(row => {
      ;(row.faces || []).forEach(face => {
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

  ;(reviewFaces || []).forEach(row => {
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
  const response = await supabase.rpc('toggle_photo_like_v2', {
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
  sessionId: string
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
    PHOTO_ALBUMS.map(async album => {
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
  deletePhotoIds: string[] = []
) {
  return await supabase
    .rpc('save_album_organization_v2', {
      p_album: album,
      p_ordered_photo_ids: orderedPhotoIds,
      p_moves: moves.map(move => ({
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

export async function updateMediaReviewBatchStatus(
  batchId: string,
  status: MediaReviewBatchStatus
) {
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

export async function updateMediaReviewCluster(
  clusterId: string,
  input: UpdateMediaReviewClusterInput
) {
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

export async function updateManyMediaReviewFaces(
  faceIds: string[],
  input: UpdateMediaReviewFaceInput
) {
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
  return await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresInSeconds)
}

export async function downloadMediaReviewArtifact(bucket: string, objectPath: string) {
  return await supabase.storage.from(bucket).download(objectPath)
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

export async function recordSiteEditorialFeatureHistory(
  input: RecordSiteEditorialFeatureHistoryInput
) {
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

// Fetch pending guest uploads for moderation queue
export async function fetchPendingGuestUploads(): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Fetch all guest uploads by status (for filter tabs)
export async function fetchGuestUploadsByStatus(
  status: 'pending' | 'approved' | 'rejected'
): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Approve a single guest upload
export async function approveGuestUpload(
  uploadId: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: existing } = await supabase
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .single()

  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'approved' })
    .eq('id', uploadId)

  if (error) throw error

  await recordModerationAudit({
    entityType: 'guest_upload',
    entityId: uploadId,
    action: 'upload_approved_published',
    fromStatus: existing?.status ?? null,
    toStatus: 'approved',
    summary: `Guest upload approved`,
    actor,
  })
}

// Reject a single guest upload with optional reason
export async function rejectGuestUpload(
  uploadId: string,
  reason?: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: existing } = await supabase
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .single()

  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .eq('id', uploadId)

  if (error) throw error

  await recordModerationAudit({
    entityType: 'guest_upload',
    entityId: uploadId,
    action: 'upload_rejected',
    fromStatus: existing?.status ?? null,
    toStatus: 'rejected',
    summary: reason ? `Guest upload rejected: ${reason}` : `Guest upload rejected`,
    metadata: reason ? { rejection_reason: reason } : {},
    actor,
  })
}

// Bulk approve guest uploads
export async function bulkApproveGuestUploads(
  uploadIds: string[],
  actor?: ModerationAuditActor
): Promise<void> {
  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'approved' })
    .in('id', uploadIds)

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_approved_published',
      fromStatus: 'pending',
      toStatus: 'approved',
      summary: `Guest upload bulk approved`,
      actor,
    })
  }
}

// Bulk reject guest uploads with optional reason
export async function bulkRejectGuestUploads(
  uploadIds: string[],
  reason?: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .in('id', uploadIds)

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_bulk_rejected',
      fromStatus: 'pending',
      toStatus: 'rejected',
      summary: reason ? `Guest upload bulk rejected: ${reason}` : `Guest upload bulk rejected`,
      metadata: reason ? { rejection_reason: reason } : {},
      actor,
    })
  }
}

// Publish selected guest upload photos to the main photos gallery under an album.
// Each photo_url in the selected uploads is inserted as a new photos row so it
// appears in the live gallery alongside professional photos.
export async function publishGuestUploadPhotosToAlbum(
  uploadIds: string[],
  album: PhotoAlbum,
  actor?: ModerationAuditActor
): Promise<{ published: number }> {
  if (uploadIds.length === 0) return { published: 0 }

  const { data: uploads, error: fetchError } = await supabase
    .from('guest_uploads')
    .select('id, guest_name, photo_urls')
    .in('id', uploadIds)

  if (fetchError) throw fetchError

  const photoRows = (uploads ?? []).flatMap(
    (upload: { id: string; guest_name: string; photo_urls: string[] }) =>
      upload.photo_urls.map(url => ({
        url,
        thumbnail: url,
        album,
        category: album,
        is_professional: false,
        caption: upload.guest_name ? `Photo by ${upload.guest_name}` : null,
      }))
  )

  if (photoRows.length === 0) return { published: 0 }

  const { data, error } = await supabase.from('photos').insert(photoRows).select('id')

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_approved_published',
      fromStatus: 'approved',
      toStatus: 'approved',
      summary: `Guest upload photos published to ${album} album`,
      metadata: { album },
      actor,
    })
  }

  return { published: data?.length ?? 0 }
}

// Fetch rejection reason for guest upload status page
export async function fetchGuestUploadStatus(email: string): Promise<GuestUpload | null> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select(
      'id, status, rejection_reason, created_at, photo_urls, photo_fingerprints, video_urls, video_fingerprints, guest_name, guest_email, message'
    )
    .eq('guest_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
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

// Activity Feed types and functions
export interface ActivityLogItem {
  id: string
  type: 'photo_upload' | 'guestbook_entry' | 'featured_moment'
  source_id: string
  source_type: 'guest_uploads' | 'guestbook_messages' | 'site_editorial_features'
  display_name: string | null
  thumbnail_url: string | null
  content_preview: string | null
  created_at: string
}

export async function fetchActivityFeed(limit = 100): Promise<ActivityLogItem[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function fetchActivityItem(
  sourceType: string,
  sourceId: string
): Promise<ActivityLogItem | null> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle()
  if (error) return null
  return data
}

// ============================================================================
// Photo Claiming Interfaces and API Functions
// ============================================================================

export interface GuestIdentity {
  id: string
  email: string
  session_id: string | null
  display_name: string
  is_verified: boolean
  created_at: string
}

export interface PhotoClaim {
  id: string
  guest_identity_id: string
  photo_id: string | null
  face_id: string | null
  claim_type: 'upload' | 'face'
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  updated_at: string
  guest_identities?: GuestIdentity
  photos?: Photo
}

/**
 * Fetch all guest identities that have been verified.
 */
export async function fetchVerifiedIdentities(): Promise<GuestIdentity[]> {
  const { data, error } = await supabase
    .from('guest_identities')
    .select('*')
    .eq('is_verified', true)
    .order('display_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

/**
 * Submits one or more photo/face claims for a guest.
 * Finds or creates the guest_identities record first.
 */
export async function submitClaims(
  email: string,
  displayName: string,
  claims: Array<{ photoId: string; faceId?: string | null; claimType: 'upload' | 'face' }>,
  sessionId?: string | null
): Promise<any[]> {
  if (claims.length === 0) return []

  // 1. Find or create guest identity
  const { data: existingIdentity } = await supabase
    .from('guest_identities')
    .select('id, is_verified')
    .eq('email', email)
    .maybeSingle()

  let identityId: string
  if (existingIdentity) {
    identityId = existingIdentity.id
    if (!existingIdentity.is_verified) {
      await supabase
        .from('guest_identities')
        .update({ display_name: displayName, session_id: sessionId ?? null })
        .eq('id', identityId)
    }
  } else {
    const { data: newIdentity, error: insertError } = await supabase
      .from('guest_identities')
      .insert({
        email,
        display_name: displayName,
        session_id: sessionId ?? null,
        is_verified: false,
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    identityId = newIdentity.id
  }

  // 2. Submit claims bulk
  const claimInserts = claims.map(c => ({
    guest_identity_id: identityId,
    photo_id: c.photoId,
    face_id: c.faceId ?? null,
    claim_type: c.claimType,
    status: 'pending',
  }))

  const { data, error } = await supabase.from('photo_claims').insert(claimInserts).select('*')

  if (error) throw error
  return data ?? []
}

/**
 * Wrapper to submit a single photo upload claim.
 */
export async function submitPhotoClaim(
  email: string,
  displayName: string,
  photoId: string,
  sessionId?: string | null
): Promise<any> {
  const claims = [{ photoId, claimType: 'upload' as const }]
  const results = await submitClaims(email, displayName, claims, sessionId)
  return results[0]
}

/**
 * Wrapper to submit a single face cluster claim.
 */
export async function submitFaceClaim(
  email: string,
  displayName: string,
  photoId: string,
  faceId: string,
  sessionId?: string | null
): Promise<any> {
  const claims = [{ photoId, faceId, claimType: 'face' as const }]
  const results = await submitClaims(email, displayName, claims, sessionId)
  return results[0]
}

/**
 * Fetch all pending claims in the moderation queue (Admin only).
 */
export async function fetchPendingClaims(): Promise<PhotoClaim[]> {
  const { data, error } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*), photos(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PhotoClaim[]
}

/**
 * Fetch all approved claims (Admin only).
 */
export async function fetchApprovedClaims(): Promise<PhotoClaim[]> {
  const { data, error } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*), photos(*)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PhotoClaim[]
}

/**
 * Fetch all rejected claims (Admin only).
 */
export async function fetchRejectedClaims(): Promise<PhotoClaim[]> {
  const { data, error } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*), photos(*)')
    .eq('status', 'rejected')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PhotoClaim[]
}

/**
 * Approve a guest's photo or face claim (Admin only).
 */
export async function approvePhotoClaim(
  claimId: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: claim, error: fetchError } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*)')
    .eq('id', claimId)
    .single()

  if (fetchError || !claim) throw new Error('Claim not found')

  const identity = claim.guest_identities

  // 1. Update claim status
  const { error: updateClaimError } = await supabase
    .from('photo_claims')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', claimId)

  if (updateClaimError) throw updateClaimError

  // 2. Mark identity as verified
  const { error: updateIdentityError } = await supabase
    .from('guest_identities')
    .update({ is_verified: true })
    .eq('id', claim.guest_identity_id)

  if (updateIdentityError) throw updateIdentityError

  // 3. If it's a face claim, sync with media_review_faces
  if (claim.claim_type === 'face' && claim.face_id) {
    const { error: syncError } = await supabase
      .from('media_review_faces')
      .update({
        confirmed_name: identity.display_name,
        review_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim.face_id)
    if (syncError) console.error('Error syncing face cluster name:', syncError)
  }

  // 4. Log moderation audit
  await recordModerationAudit({
    entityType: 'photo_claim',
    entityId: claimId,
    action: 'claim_approved',
    fromStatus: 'pending',
    toStatus: 'approved',
    summary: `Approved ${claim.claim_type} claim for ${identity.display_name} (${identity.email})`,
    actor,
  })
}

/**
 * Reject a guest's photo or face claim with an optional reason (Admin only).
 */
export async function rejectPhotoClaim(
  claimId: string,
  reason?: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: claim, error: fetchError } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*)')
    .eq('id', claimId)
    .single()

  if (fetchError || !claim) throw new Error('Claim not found')

  const identity = claim.guest_identities

  // 1. Update claim status
  const { error: updateClaimError } = await supabase
    .from('photo_claims')
    .update({
      status: 'rejected',
      rejection_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)

  if (updateClaimError) throw updateClaimError

  // 2. Log moderation audit
  await recordModerationAudit({
    entityType: 'photo_claim',
    entityId: claimId,
    action: 'claim_rejected',
    fromStatus: 'pending',
    toStatus: 'rejected',
    summary: reason
      ? `Rejected ${claim.claim_type} claim for ${identity.display_name} (${identity.email}): ${reason}`
      : `Rejected ${claim.claim_type} claim for ${identity.display_name} (${identity.email})`,
    metadata: reason ? { rejection_reason: reason } : {},
    actor,
  })
}

/**
 * Fetch all photos by their exact URLs.
 */
export async function fetchPhotosByUrls(urls: string[]): Promise<Photo[]> {
  if (urls.length === 0) return []
  const { data, error } = await supabase.from('photos').select('*').in('url', urls)

  if (error) throw error
  return (data ?? []) as Photo[]
}

/**
 * Fetch all approved uploads' photos by guest email.
 */
export async function fetchPotentialPhotosToClaimByEmail(email: string): Promise<Photo[]> {
  const { data: uploads, error } = await supabase
    .from('guest_uploads')
    .select('photo_urls')
    .eq('guest_email', email)
    .eq('status', 'approved')

  if (error) throw error
  if (!uploads || uploads.length === 0) return []

  const allUrls = uploads.flatMap(u => u.photo_urls || [])
  if (allUrls.length === 0) return []

  return await fetchPhotosByUrls(allUrls)
}

/**
 * Get or create a persistent guest sharing token for a given email.
 */
export async function getOrCreateShareToken(email: string): Promise<string> {
  const formattedEmail = email.trim().toLowerCase()

  // 1. Try to fetch existing token
  const { data } = await supabase
    .from('guest_share_tokens')
    .select('token')
    .eq('guest_email', formattedEmail)
    .maybeSingle()

  if (data?.token) {
    return data.token
  }

  // 2. Generate a new unique token if not found
  const newToken = crypto.randomUUID()
  const { data: inserted, error: insertError } = await supabase
    .from('guest_share_tokens')
    .insert({
      guest_email: formattedEmail,
      token: newToken,
    })
    .select('token')
    .single()

  if (insertError) {
    // Handle race conditions where another call inserted first
    const { data: retryData } = await supabase
      .from('guest_share_tokens')
      .select('token')
      .eq('guest_email', formattedEmail)
      .maybeSingle()

    if (retryData?.token) {
      return retryData.token
    }
    throw insertError
  }

  return inserted.token
}

/**
 * Fetch all guest contributions (uploads, guestbook, claimed photos) by their unique share token.
 */
export async function fetchGuestContributionsByToken(token: string): Promise<{
  guestName: string
  uploads: any[]
  guestbook: any[]
  claimedPhotos: any[]
} | null> {
  // 1. Fetch token and associated email
  const { data: tokenData, error: tokenError } = await supabase
    .from('guest_share_tokens')
    .select('guest_email')
    .eq('token', token)
    .maybeSingle()

  if (tokenError || !tokenData) {
    return null
  }

  const email = tokenData.guest_email

  // 2. Parallel queries for efficiency
  const [uploadsRes, guestbookRes, claimedRes, identityRes] = await Promise.all([
    // Fetch approved guest uploads matching the email
    supabase
      .from('guest_uploads')
      .select('*')
      .eq('guest_email', email)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),

    // Fetch guestbook messages matching the email
    supabase
      .from('guestbook_messages')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false }),

    // Fetch approved claimed photos by guest identity email
    supabase
      .from('guest_identities')
      .select('id, photo_claims(*, photos(*))')
      .eq('email', email)
      .eq('is_verified', true)
      .maybeSingle(),

    // Fetch any identity record to get verified name
    supabase.from('guest_identities').select('display_name').eq('email', email).maybeSingle(),
  ])

  const uploads = uploadsRes.data ?? []
  const guestbook = guestbookRes.data ?? []

  // Resolve claimed photos
  const claimedPhotos: any[] = []
  if (claimedRes.data?.photo_claims) {
    const claims = claimedRes.data.photo_claims as any[]
    claims.forEach(claim => {
      if (claim.status === 'approved' && claim.photos) {
        claimedPhotos.push(claim.photos)
      }
    })
  }

  // Resolve display name
  let guestName = identityRes.data?.display_name || ''
  if (!guestName && guestbook.length > 0) {
    guestName = guestbook[0].name
  }
  if (!guestName && uploads.length > 0) {
    guestName = uploads[0].guest_name
  }
  if (!guestName) {
    guestName = 'Special Guest'
  }

  return {
    guestName,
    uploads,
    guestbook,
    claimedPhotos,
  }
}
