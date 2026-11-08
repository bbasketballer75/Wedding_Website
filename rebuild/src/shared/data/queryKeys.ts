/**
 * Central TanStack Query keys.
 *
 * One module owns every key so invalidation is searched in one place and a key
 * cannot silently differ between a query and its invalidation. Keys are plain
 * readonly arrays; variable parts are normalised (sorted) where ordering is not
 * semantically meaningful so two callers with the same set hit the same cache
 * entry.
 *
 * Key layout: `[domain, resource, ...params]`.
 */

export { authKeys } from './auth'

/** Sort + freeze a list of ids/keys so cache identity depends on the set, not order. */
export function stableKeyPart(values: readonly string[]): string[] {
  return [...values].sort()
}

export const queryKeys = {
  photos: {
    all: ['photos'] as const,
    /** Paged all-photos listing (gallery). */
    list: (page: number, pageSize: number) => ['photos', 'list', page, pageSize] as const,
    /** Infinite-query gallery feed. */
    infinite: (pageSize: number) => ['photos', 'infinite', pageSize] as const,
    byAlbum: (album: string) => ['photos', 'album', album] as const,
    byUrls: (urls: readonly string[]) => ['photos', 'urls', ...stableKeyPart(urls)] as const,
    withFaces: () => ['photos', 'with-faces'] as const,
    top: (limit: number) => ['photos', 'top', limit] as const,
    albumCounts: () => ['photos', 'album-counts'] as const,
    nextSortOrder: (album: string) => ['photos', 'next-sort-order', album] as const,
    comments: (photoKey: string) => ['photos', 'comments', photoKey] as const,
    recentComments: (limit: number) => ['photos', 'comments', 'recent', limit] as const,
    likeStatuses: (photoKeys: readonly string[], sessionId: string) =>
      ['photos', 'like-statuses', sessionId, ...stableKeyPart(photoKeys)] as const,
    engagementSummary: (photoKeys: readonly string[]) =>
      ['photos', 'engagement-summary', ...stableKeyPart(photoKeys)] as const,
  },
  guestbook: {
    all: ['guestbook'] as const,
    messages: () => ['guestbook', 'messages'] as const,
    messagesWithComments: () => ['guestbook', 'messages', 'with-comments'] as const,
    forPrint: () => ['guestbook', 'print'] as const,
  },
  guestUploads: {
    all: ['guest-uploads'] as const,
    byStatus: (status: string) => ['guest-uploads', 'status', status] as const,
    approved: () => ['guest-uploads', 'status', 'approved'] as const,
    pending: () => ['guest-uploads', 'status', 'pending'] as const,
    statusByEmail: (email: string) => ['guest-uploads', 'email', email.toLowerCase()] as const,
    filmHighlights: () => ['guest-uploads', 'film-highlights'] as const,
  },
  editorial: {
    all: ['editorial'] as const,
    features: (slot?: string) => ['editorial', 'features', slot ?? 'all'] as const,
    bySlot: (slot: string) => ['editorial', 'features', slot] as const,
    history: (slot?: string) => ['editorial', 'history', slot ?? 'all'] as const,
  },
  claims: {
    all: ['claims'] as const,
    identities: () => ['claims', 'identities'] as const,
    byStatus: (status: string) => ['claims', 'status', status] as const,
    pending: () => ['claims', 'status', 'pending'] as const,
    approved: () => ['claims', 'status', 'approved'] as const,
    rejected: () => ['claims', 'status', 'rejected'] as const,
    potentialPhotosByEmail: (email: string) =>
      ['claims', 'potential-photos', email.toLowerCase()] as const,
  },
  guestShare: {
    all: ['guest-share'] as const,
    contributions: (token: string) => ['guest-share', 'contributions', token] as const,
  },
  activity: {
    all: ['activity'] as const,
    feed: (limit: number) => ['activity', 'feed', limit] as const,
    item: (sourceType: string, sourceId: string) =>
      ['activity', 'item', sourceType, sourceId] as const,
  },
  moderation: {
    all: ['moderation'] as const,
    auditTimeline: (filters: {
      entityType?: string
      entityId?: string
      action?: string
      actorEmail?: string
      limit?: number
    }) =>
      [
        'moderation',
        'audit',
        filters.entityType ?? 'all',
        filters.entityId ?? 'all',
        filters.action ?? 'all',
        filters.actorEmail ?? 'all',
        filters.limit ?? 200,
      ] as const,
    auditForEntity: (entityType: string, entityId: string) =>
      ['moderation', 'audit', entityType, entityId] as const,
    dashboardCounts: () => ['moderation', 'dashboard-counts'] as const,
  },
  mediaReview: {
    all: ['media-review'] as const,
    batches: () => ['media-review', 'batches'] as const,
    clusters: (batchId: string) => ['media-review', 'clusters', batchId] as const,
    faces: (batchId: string) => ['media-review', 'faces', batchId] as const,
    taggingBatches: () => ['media-review', 'tagging-batches'] as const,
    knownPeople: () => ['media-review', 'known-people'] as const,
  },
} as const

/** Invalidation groups used after mutations (kept here so they cannot drift). */
export const invalidationGroups = {
  photoEngagement: [queryKeys.photos.all],
  guestbook: [queryKeys.guestbook.all],
  guestUploads: [queryKeys.guestUploads.all, queryKeys.activity.all, queryKeys.moderation.all],
  editorial: [queryKeys.editorial.all, queryKeys.activity.all],
  claims: [queryKeys.claims.all, queryKeys.moderation.all, queryKeys.activity.all],
} as const
