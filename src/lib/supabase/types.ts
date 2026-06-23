/**
 * Shared database-row types for the entire Supabase surface.
 *
 * Kept in one file so cross-domain modules (photos, guestUploads, claims,
 * moderation, mediaReview, editorial, activity) all import the same shapes
 * without circular references between functional modules.
 */
import type { Json } from '@/types/supabase.generated'
import type { MemoryTrailId } from '@/data/memoryTrails'

// ──────────────────────────────────────────────────────────────────────────
// Photos + photo engagement
// ──────────────────────────────────────────────────────────────────────────

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

export interface PhotoLikeStatus {
  photo_key: string
  likes_count: number
  liked: boolean
}

// ──────────────────────────────────────────────────────────────────────────
// Albums
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Guests + guest uploads
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Photo claiming (guest identities + photo_claims)
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Moderation audit log
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Media review pipeline (batches, clusters, faces, face-tagging batches)
// ──────────────────────────────────────────────────────────────────────────

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

export interface UpdateMediaReviewFaceInput {
  reviewStatus?: MediaReviewFaceStatus
  confirmedName?: string | null
  personKey?: string | null
  notes?: string | null
}

// ──────────────────────────────────────────────────────────────────────────
// Site editorial features
// ──────────────────────────────────────────────────────────────────────────

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

export interface RecordSiteEditorialFeatureHistoryInput {
  slot: SiteEditorialFeatureSlot
  featureId?: string | null
  changeSummary: string
  previousFeature?: Record<string, unknown>
  nextFeature?: Record<string, unknown>
  actor?: ModerationAuditActor | null
}

// ──────────────────────────────────────────────────────────────────────────
// Activity feed
// ──────────────────────────────────────────────────────────────────────────

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