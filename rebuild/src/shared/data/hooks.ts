/**
 * TanStack Query read hooks for the content pages (Waves 4-6).
 *
 * Design rules:
 * - Hooks are thin: keys come from `queryKeys`, work is done by the domain
 *   modules, so every read path is unit-testable without React.
 * - Every hook accepts an optional injected client (last argument / `client`
 *   option) for tests; production call sites pass nothing and the shared lazy
 *   client is used.
 * - `queryOptions` objects are exported where a route needs to prefetch or read
 *   the same cache entry outside React.
 * - No mutations here: Wave 6 wires mutations next to the UI that uses them, and
 *   invalidates the groups in `invalidationGroups`.
 */
import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import { fetchActivityFeed, type ActivityItem } from './activity'
import type { TypedSupabaseClient } from './client'
import { fetchClaimsByStatus, fetchPendingClaims, type PhotoClaim } from './claims'
import { fetchLiveEditorialFeatures, type EditorialFeature, type EditorialSlot } from './editorial'
import { fetchGuestbookMessages, type GuestbookMessage } from './guestbook'
import {
  fetchApprovedGuestUploads,
  fetchFilmGuestHighlights,
  type FilmHighlight,
  type GuestUpload,
} from './guestUploads'
import { fetchMediaReviewBatches, type MediaReviewBatch } from './mediaReview'
import { fetchDashboardCounts, type DashboardCounts } from './moderation'
import {
  GALLERY_PAGE_SIZE,
  fetchPhotoComments,
  fetchPhotoEngagementSummary,
  fetchPhotoLikeStatuses,
  fetchPhotoPage,
  fetchTopPhotos,
  fetchWeddingDayPhotos,
  indexPhotoEngagement,
  type Photo,
  type PhotoCommentRow,
  type PhotoEngagement,
  type PhotoEngagementSummary,
  type PhotoLikeStatus,
} from './photos'
import { queryKeys } from './queryKeys'

/** Home strip length (frozen home "standout moments" layout). */
export const HOME_PHOTO_LIMIT = 6
/** Home fallback row length (frozen "Wedding Day" fallback). */
export const HOME_FALLBACK_PHOTO_LIMIT = 6
/** Activity page page-size. */
export const ACTIVITY_FEED_LIMIT = 100

const MINUTE = 60_000

// ─────────────────────────────────────────────────────────────────────────────
// Query options (usable for prefetch/SSR-style loading too)
// ─────────────────────────────────────────────────────────────────────────────

export function topPhotosQueryOptions(limit = HOME_PHOTO_LIMIT, client?: TypedSupabaseClient) {
  return queryOptions({
    queryKey: queryKeys.photos.top(limit),
    queryFn: () => fetchTopPhotos(limit, client),
    staleTime: MINUTE,
  })
}

export function weddingDayPhotosQueryOptions(
  limit = HOME_FALLBACK_PHOTO_LIMIT,
  client?: TypedSupabaseClient
) {
  return queryOptions({
    queryKey: queryKeys.photos.list(0, limit),
    queryFn: () => fetchWeddingDayPhotos(limit, client),
    staleTime: MINUTE,
  })
}

export function guestbookMessagesQueryOptions(client?: TypedSupabaseClient) {
  return queryOptions({
    queryKey: queryKeys.guestbook.messagesWithComments(),
    queryFn: () => fetchGuestbookMessages(client),
    staleTime: MINUTE,
  })
}

export function approvedGuestUploadsQueryOptions(client?: TypedSupabaseClient) {
  return queryOptions({
    queryKey: queryKeys.guestUploads.approved(),
    queryFn: () => fetchApprovedGuestUploads(client),
    staleTime: MINUTE,
  })
}

export function editorialFeaturesQueryOptions(slot?: EditorialSlot, client?: TypedSupabaseClient) {
  return queryOptions({
    queryKey: queryKeys.editorial.features(slot),
    queryFn: () => fetchLiveEditorialFeatures(slot, new Date(), client),
    staleTime: MINUTE,
  })
}

export function filmHighlightsQueryOptions(client?: TypedSupabaseClient) {
  return queryOptions({
    queryKey: queryKeys.guestUploads.filmHighlights(),
    queryFn: () => fetchFilmGuestHighlights(client),
    staleTime: MINUTE,
  })
}

export function activityFeedQueryOptions(
  limit = ACTIVITY_FEED_LIMIT,
  client?: TypedSupabaseClient
) {
  return queryOptions({
    queryKey: queryKeys.activity.feed(limit),
    queryFn: () => fetchActivityFeed(limit, client),
    staleTime: 15_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────────────────────────────────────

/** Home "standout moments": most-liked photos. */
export function useTopPhotos(
  limit = HOME_PHOTO_LIMIT,
  client?: TypedSupabaseClient
): UseQueryResult<Photo[]> {
  return useQuery(topPhotosQueryOptions(limit, client))
}

/** Home gallery fallback row: latest Wedding Day photos. */
export function useWeddingDayPhotos(
  limit = HOME_FALLBACK_PHOTO_LIMIT,
  client?: TypedSupabaseClient
): UseQueryResult<Photo[]> {
  return useQuery(weddingDayPhotosQueryOptions(limit, client))
}

/** Home editorial slots, already filtered by the public visibility window. */
export function useEditorialFeatures(
  slot?: EditorialSlot,
  client?: TypedSupabaseClient
): UseQueryResult<EditorialFeature[]> {
  return useQuery(editorialFeaturesQueryOptions(slot, client))
}

/** Home guestbook preview (full feed; the UI slices what it renders). */
export function useGuestbookMessages(
  client?: TypedSupabaseClient
): UseQueryResult<GuestbookMessage[]> {
  return useQuery(guestbookMessagesQueryOptions(client))
}

/** Approved guest uploads (home reel + /guest-photos). */
export function useApprovedGuestUploads(
  client?: TypedSupabaseClient
): UseQueryResult<GuestUpload[]> {
  return useQuery(approvedGuestUploadsQueryOptions(client))
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallery
// ─────────────────────────────────────────────────────────────────────────────

export interface GalleryInfiniteQueryOptions {
  pageSize?: number
  client?: TypedSupabaseClient
}

/** Gallery feed as an infinite query (one cache entry, pages of `pageSize`). */
export function useGalleryPhotos(options: GalleryInfiniteQueryOptions = {}) {
  const pageSize = options.pageSize ?? GALLERY_PAGE_SIZE

  return useInfiniteQuery({
    queryKey: queryKeys.photos.infinite(pageSize),
    queryFn: ({ pageParam }) => fetchPhotoPage({ page: pageParam, pageSize }, options.client),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < pageSize ? undefined : lastPageParam + 1,
    staleTime: MINUTE,
  })
}

/** Per-session like statuses for the photos currently on screen. */
export function usePhotoLikeStatuses(
  photoKeys: readonly string[],
  sessionId: string,
  client?: TypedSupabaseClient
): UseQueryResult<PhotoLikeStatus[]> {
  return useQuery({
    queryKey: queryKeys.photos.likeStatuses(photoKeys, sessionId),
    queryFn: () => fetchPhotoLikeStatuses(photoKeys, sessionId, client),
    enabled: photoKeys.length > 0,
    staleTime: 30_000,
  })
}

/** Aggregate like/comment totals for the photos currently on screen. */
export function usePhotoEngagementSummary(
  photoKeys: readonly string[],
  client?: TypedSupabaseClient
): UseQueryResult<PhotoEngagementSummary[]> {
  return useQuery({
    queryKey: queryKeys.photos.engagementSummary(photoKeys),
    queryFn: () => fetchPhotoEngagementSummary(photoKeys, client),
    enabled: photoKeys.length > 0,
    staleTime: 30_000,
  })
}

/** Combined engagement index the gallery grid consumes. */
export function usePhotoEngagement(
  photoKeys: readonly string[],
  sessionId: string,
  client?: TypedSupabaseClient
): { index: Map<string, PhotoEngagement>; isLoading: boolean } {
  const statuses = usePhotoLikeStatuses(photoKeys, sessionId, client)
  const summaries = usePhotoEngagementSummary(photoKeys, client)

  return {
    index: indexPhotoEngagement(statuses.data ?? [], summaries.data ?? []),
    isLoading: statuses.isLoading || summaries.isLoading,
  }
}

/** Visible comments for the open lightbox photo. */
export function usePhotoComments(
  photoKey: string | null,
  client?: TypedSupabaseClient
): UseQueryResult<PhotoCommentRow[]> {
  return useQuery({
    queryKey: queryKeys.photos.comments(photoKey ?? ''),
    queryFn: () => fetchPhotoComments(photoKey ?? '', client),
    enabled: photoKey !== null,
    staleTime: 15_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Film / guest photos
// ─────────────────────────────────────────────────────────────────────────────

/** Film page guest-video highlights (approved, non-archive visibility, max 6). */
export function useFilmGuestHighlights(
  client?: TypedSupabaseClient
): UseQueryResult<FilmHighlight[]> {
  return useQuery(filmHighlightsQueryOptions(client))
}

/** Guest-photos contact sheet data (approved uploads; same query as home). */
export function useGuestPhotos(client?: TypedSupabaseClient): UseQueryResult<GuestUpload[]> {
  return useQuery(approvedGuestUploadsQueryOptions(client))
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity
// ─────────────────────────────────────────────────────────────────────────────

/** Newest-first activity feed. */
export function useActivityFeed(
  limit = ACTIVITY_FEED_LIMIT,
  client?: TypedSupabaseClient
): UseQueryResult<ActivityItem[]> {
  return useQuery(activityFeedQueryOptions(limit, client))
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin read paths (dashboard / claims / review) — wired in Wave 7
// ─────────────────────────────────────────────────────────────────────────────

/** Admin dashboard counters. */
export function useDashboardCounts(client?: TypedSupabaseClient): UseQueryResult<DashboardCounts> {
  return useQuery({
    queryKey: queryKeys.moderation.dashboardCounts(),
    queryFn: () => fetchDashboardCounts(client),
    staleTime: 15_000,
  })
}

/** Admin claim queue for one status. */
export function useClaimsByStatus(
  status: 'pending' | 'approved' | 'rejected',
  client?: TypedSupabaseClient
): UseQueryResult<PhotoClaim[]> {
  return useQuery({
    queryKey: queryKeys.claims.byStatus(status),
    queryFn: () => fetchClaimsByStatus(status, client),
    staleTime: 15_000,
  })
}

/** Admin pending-claims convenience hook. */
export function usePendingClaims(client?: TypedSupabaseClient): UseQueryResult<PhotoClaim[]> {
  return useQuery({
    queryKey: queryKeys.claims.pending(),
    queryFn: () => fetchPendingClaims(client),
    staleTime: 15_000,
  })
}

/** Admin review batches list. */
export function useMediaReviewBatches(
  client?: TypedSupabaseClient
): UseQueryResult<MediaReviewBatch[]> {
  return useQuery({
    queryKey: queryKeys.mediaReview.batches(),
    queryFn: () => fetchMediaReviewBatches(client),
    staleTime: 30_000,
  })
}
