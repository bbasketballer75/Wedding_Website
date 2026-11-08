/**
 * Activity feed contract types (Wave 6 W6-4).
 *
 * These mirror the frozen `ActivityLogItem` display surface (`src/lib/supabase/types.ts`)
 * and the typed `shared/data/activity.ts` boundary 1:1, so wiring the feature to the
 * data layer is mechanical:
 *
 *   ActivityApi.loadFeed(limit)  -> fetchActivityFeed(limit)
 *   ActivityApi.subscribe(fn)    -> subscribeToActivityInserts(fn, { enabled: !window.__E2E__ })
 *
 * The feature never imports `@supabase/supabase-js`; the realtime channel is injected
 * through `ActivityApi.subscribe` (the "channel factory" seam).
 */

export const ACTIVITY_TYPES = ['photo_upload', 'guestbook_entry', 'featured_moment'] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_SOURCE_TYPES = [
  'guest_uploads',
  'guestbook_messages',
  'site_editorial_features',
] as const

export type ActivitySourceType = (typeof ACTIVITY_SOURCE_TYPES)[number]

/** Frozen filter vocabulary (`src/stores/activityFeedStore.ts`). */
export type ActivityFilterType = 'all' | 'photos' | 'guestbook' | 'moments'

/** Normalised activity item — exactly what the feed renders. */
export interface ActivityItem {
  id: string
  type: ActivityType
  sourceId: string
  sourceType: ActivitySourceType
  displayName: string | null
  thumbnailUrl: string | null
  contentPreview: string | null
  createdAt: string
}

/** Handle returned by a realtime subscription. */
export interface ActivitySubscription {
  unsubscribe: () => void
}

/**
 * Injected data boundary (no direct Supabase import in the feature).
 *
 * `subscribe` is the "channel factory": the frozen app built
 * `supabase.channel('activity_feed').on('postgres_changes', { event: 'INSERT',
 * schema: 'public', table: 'activity_log' }, ...)`. Production passes the
 * `shared/data/activity` implementation; tests pass a controllable fake.
 */
export interface ActivityApi {
  loadFeed: (limit: number) => Promise<ActivityItem[]>
  subscribe: (onInsert: (item: ActivityItem) => void) => ActivitySubscription
}
