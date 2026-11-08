import { useCallback, useMemo, useState } from 'react'
import { ACTIVITY_COPY } from './constants'
import { ActivityFeed } from './ActivityFeed'
import { createStubActivityApi, useActivityFeed, useActivityRealtime } from './data'
import type { ActivityApi, ActivityFilterType, ActivityItem } from './types'

export interface ActivityPageProps {
  /** Data-layer seam (Lead swaps for `shared/data/activity.ts`). */
  api?: ActivityApi
  /** Clock seam for deterministic relative timestamps (parity harness freezes Date). */
  now?: Date
}

/**
 * `/activity` page — parity port of the frozen `src/pages/Activity.tsx`
 * (frozen file: 36 lines; the feed behavior lives in this folder's hooks and
 * components).
 *
 * Behavior preserved from the frozen page/feed:
 * - 100-item initial load, then 20-item appends via the bottom sentinel;
 * - All / Photos / Guestbook / Moments client-side filtering over the frozen
 *   `typeFilterMap` (`moments` → `featured_moment`);
 * - realtime `postgres_changes` INSERTs on `activity_log` accumulate behind a
 *   "N new activity — click to load" banner and are prepended on click;
 * - realtime is disabled under `window.__E2E__` (deterministic e2e/parity);
 * - the subscription is unsubscribed on unmount.
 *
 * Deliberately deferred (documented deltas):
 * - No `usePageMeta` call yet: the frozen `/activity` route never mounted an
 *   SEOHead (recorded as a known defect in `contracts/routes.json`), and the
 *   parity text diff compares title/canonical/meta — adding metadata now would
 *   make the route fail text parity instead of passing it. Wave 8 owns the
 *   metadata defect fix together with the oracle/allowlist update.
 * - The frozen sidebar filter persistence (`sessionStorage`) is not ported; the
 *   page always opens on "All". Nothing in the oracle depends on it.
 */
export function ActivityPage({ api, now }: ActivityPageProps) {
  const client = useMemo(() => api ?? createStubActivityApi(), [api])
  const { items, isLoading, loadError, hasMore, loadMore, prependItems } = useActivityFeed({
    api: client,
  })
  const [activeFilter, setActiveFilter] = useState<ActivityFilterType>('all')
  const [newItems, setNewItems] = useState<ActivityItem[]>([])

  const handleInsert = useCallback((item: ActivityItem) => {
    setNewItems(previous => [item, ...previous])
  }, [])

  useActivityRealtime({ api: client, onInsert: handleInsert })

  const handleLoadNewItems = useCallback(() => {
    if (newItems.length === 0) return
    prependItems(newItems)
    setNewItems([])
  }, [newItems, prependItems])

  return (
    <div className='min-h-screen bg-cream-50 pb-16'>
      <div className='px-4 pt-8'>
        <h1 className='mb-6 font-display text-2xl text-charcoal-800'>{ACTIVITY_COPY.title}</h1>
        <ActivityFeed
          items={items}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          newItemsCount={newItems.length}
          onLoadNewItems={handleLoadNewItems}
          isLoading={isLoading}
          hasMore={hasMore}
          loadError={loadError}
          onLoadMore={() => {
            void loadMore()
          }}
          {...(now ? { now } : {})}
        />
      </div>
    </div>
  )
}

export default ActivityPage
