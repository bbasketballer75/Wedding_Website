/**
 * Barrel re-export — preserves `@/lib/supabase` as the public entry point.
 *
 * The actual implementation lives in src/lib/supabase/ split by domain:
 *   - client.ts          → Supabase client + env validation
 *   - types.ts           → All DB-row type definitions
 *   - moderation.ts      → Moderation audit log (record + fetch)
 *   - mediaReview.ts     → Media review batches/clusters/faces
 *   - photos.ts          → Gallery queries, engagement, album org
 *   - editorial.ts       → Site editorial features (home/film slots)
 *   - guestUploads.ts    → Guest upload fetch + admin approve/reject/bulk
 *   - claims.ts          → Photo claiming + share tokens
 *   - activity.ts        → Activity feed (recent uploads, notes, features)
 *
 * Imports across the codebase should keep using `@/lib/supabase` — do not
 * reach into the submodules directly unless you have a strong reason.
 */
export { supabase } from './supabase/client'

// Value exports (constants that are used at runtime, e.g. PHOTO_ALBUMS in .map())
export { PHOTO_ALBUMS } from './supabase/types'

// Type-only exports (interfaces + type aliases)
export type {
  // Photos
  PhotoFace,
  PhotoComment,
  Photo,
  PhotoCommentRecord,
  AdminPhotoCommentRecord,
  PhotoEngagementSummary,
  PhotoLikeStatus,
  // Albums
  PhotoAlbum,
  AlbumOrganizerPhoto,
  AlbumOrganizerMoveInput,
  SaveAlbumOrganizationResult,
  DeleteGalleryPhotosResult,
  // Guests
  GuestUpload,
  GuestbookMessage,
  GuestIdentity,
  PhotoClaim,
  // Moderation
  ModerationAuditEntityType,
  ModerationAuditAction,
  ModerationAuditLog,
  ModerationAuditActor,
  RecordModerationAuditInput,
  ModerationAuditTimelineFilters,
  // Media review
  MediaReviewBatchStatus,
  MediaReviewClusterStatus,
  MediaReviewFaceStatus,
  GuestFaceTaggingBatchStatus,
  MediaReviewBatch,
  MediaReviewClusterMember,
  MediaReviewCluster,
  UpdateMediaReviewClusterInput,
  MediaReviewFace,
  GuestFaceTaggingBatch,
  UpdateMediaReviewFaceInput,
  // Editorial
  SiteEditorialFeatureSlot,
  SiteEditorialFeatureSourceType,
  SiteEditorialFeature,
  SiteEditorialFeatureHistoryEntry,
  SiteEditorialFeatureActor,
  UpsertSiteEditorialFeatureInput,
  RecordSiteEditorialFeatureHistoryInput,
  // Activity
  ActivityLogItem,
} from './supabase/types'

// ─── Moderation ──────────────────────────────────────────────────────────
export {
  recordModerationAudit,
  fetchModerationAuditTimeline,
  fetchModerationAuditForEntity,
} from './supabase/moderation'

// ─── Media review ─────────────────────────────────────────────────────────
export {
  fetchMediaReviewBatches,
  fetchKnownPeopleNames,
  fetchGuestFaceTaggingBatches,
  fetchMediaReviewClusters,
  fetchMediaReviewFaces,
  updateMediaReviewBatchStatus,
  updateMediaReviewCluster,
  updateMediaReviewFace,
  updateManyMediaReviewFaces,
  createMediaReviewArtifactSignedUrl,
  downloadMediaReviewArtifact,
} from './supabase/mediaReview'

// ─── Photos ───────────────────────────────────────────────────────────────
export {
  fetchPhotosByUrls,
  fetchWeddingDayPhotos,
  fetchPhotosWithFaces,
  fetchPhotoLikeStatuses,
  fetchPhotoEngagementSummary,
  togglePhotoLike,
  fetchPhotoComments,
  addPhotoComment,
  fetchRecentPhotoComments,
  hidePhotoComment,
  deletePhotoComment,
  fetchAlbumPhotos,
  fetchPhotoAlbumCounts,
  fetchNextAlbumSortOrder,
  saveAlbumOrganization,
  deleteGalleryPhotos,
} from './supabase/photos'

// ─── Editorial ────────────────────────────────────────────────────────────
export {
  fetchSiteEditorialFeatures,
  fetchSiteEditorialFeatureHistory,
  fetchSiteEditorialFeatureBySlot,
  recordSiteEditorialFeatureHistory,
  upsertSiteEditorialFeature,
} from './supabase/editorial'

// ─── Guest uploads ────────────────────────────────────────────────────────
export {
  fetchApprovedGuestUploads,
  fetchPendingGuestUploads,
  fetchGuestUploadsByStatus,
  approveGuestUpload,
  rejectGuestUpload,
  bulkApproveGuestUploads,
  bulkRejectGuestUploads,
  publishGuestUploadPhotosToAlbum,
  fetchGuestUploadStatus,
} from './supabase/guestUploads'

// ─── Claims + share tokens ───────────────────────────────────────────────
export {
  fetchVerifiedIdentities,
  fetchPendingClaims,
  fetchApprovedClaims,
  fetchRejectedClaims,
  submitClaims,
  submitPhotoClaim,
  submitFaceClaim,
  approvePhotoClaim,
  rejectPhotoClaim,
  fetchPotentialPhotosToClaimByEmail,
  getOrCreateShareToken,
  fetchGuestContributionsByToken,
} from './supabase/claims'

// ─── Activity feed ────────────────────────────────────────────────────────
export { fetchActivityFeed, fetchActivityItem } from './supabase/activity'

// Default export keeps wildcard-import compatibility (`import * as sb from '@/lib/supabase'`).
export { supabase as default } from './supabase/client'