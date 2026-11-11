/**
 * Frozen activity-feed copy, filter map and feed sizes.
 *
 * Text oracle: `contracts/content/rendered/activity.json` (captured from the frozen
 * app under `contracts/fixtures/activity.json`). Every user-visible string in the
 * feature lives here so text parity is reviewable in one place.
 */
import type { ActivityFilterType, ActivityType } from './types'

/** Contracts clock: the parity harness freezes time here (`contracts/ui.json` fixedNow). */
export const ACTIVITY_FIXED_NOW = '2026-11-08T17:00:00.000Z'

/** Frozen `/activity` initial page load (`fetchActivityFeed(100)`). */
export const ACTIVITY_FEED_LIMIT = 100

/** Frozen infinite-scroll page size (`fetchActivityFeed(20)`). */
export const ACTIVITY_PAGE_SIZE = 20

/** Frozen filter tabs, in render order (`src/components/activity/ActivityFilters.tsx`). */
export const ACTIVITY_FILTERS: ReadonlyArray<{ value: ActivityFilterType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'photos', label: 'Photos' },
  { value: 'guestbook', label: 'Guestbook' },
  { value: 'moments', label: 'Moments' },
]

/**
 * Frozen `typeFilterMap` (`src/components/activity/ActivityFeed.tsx`):
 * filter → activity type; `null` means "no filter".
 */
export const ACTIVITY_TYPE_FILTER: Record<ActivityFilterType, ActivityType | null> = {
  all: null,
  photos: 'photo_upload',
  guestbook: 'guestbook_entry',
  moments: 'featured_moment',
}

/** Frozen per-type card labels (`src/components/activity/ActivityCard.tsx`). */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  photo_upload: 'shared a photo',
  guestbook_entry: 'signed the guestbook',
  featured_moment: 'Featured moment',
}

/** DOM id of a filter tab, shared with the feed panel's `aria-labelledby`. */
export function activityTabId(filter: ActivityFilterType): string {
  return `activity-tab-${filter}`
}

/** Every user-visible string (kept identical to the frozen oracle). */
export const ACTIVITY_COPY = {
  title: 'Activity',
  /** Frozen banner label; the em dash is part of the oracle text. */
  banner: (count: number) => `${count} new activity — click to load`,
  feedFooter: 'Scroll for more or end of feed',
  loadingMore: 'Loading more...',
  emptyTitle: 'Be the first to contribute',
  emptyBody: 'The activity feed is empty. Share a photo or leave a message in the guestbook!',
  emptyShareCta: 'Share a Photo',
  emptyGuestbookCta: 'Sign Guestbook',
  anonymousName: 'Anonymous',
  /** Accessible names that are not visible copy (a11y only, not text parity). */
  filterLabel: 'Filter activity',
  feedLabel: 'Activity feed',
  loadingLabel: 'Loading activity',
  loadError: 'Having trouble loading the activity feed right now — please try again.',
  newActivityAnnouncement: (count: number) =>
    `${count} new activity available. Activate the banner to add it to the feed.`,
} as const
