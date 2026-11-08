/**
 * App-layer wiring for the Activity feature (Wave 6).
 * `subscribe` is skipped by the feature itself under `window.__E2E__`.
 */
import type { ActivityApi } from '@/features/activity'
import { fetchActivityFeed, subscribeToActivityInserts } from '@/shared/data/activity'

export const activityApi: ActivityApi = {
  loadFeed: limit => fetchActivityFeed(limit),
  subscribe: onInsert => subscribeToActivityInserts(onInsert),
}
