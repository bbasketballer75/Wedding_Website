import { useEffect, useRef } from 'react'
import { ACTIVITY_COPY, activityTabId } from './constants'
import { ActivityFilters } from './ActivityFilters'
import { ActivityCard } from './ActivityCard'
import { ActivitySkeletons } from './ActivitySkeletons'
import { EmptyActivityState } from './EmptyActivityState'
import { NewActivityBanner } from './NewActivityBanner'
import { filterActivityItems } from './data'
import type { ActivityFilterType, ActivityItem } from './types'

export interface ActivityFeedProps {
  items: readonly ActivityItem[]
  activeFilter: ActivityFilterType
  onFilterChange: (filter: ActivityFilterType) => void
  /** Pending realtime inserts not yet shown in the feed (banner count). */
  newItemsCount: number
  onLoadNewItems: () => void
  isLoading: boolean
  hasMore: boolean
  loadError: string | null
  onLoadMore: () => void
  /** Clock seam for deterministic relative timestamps. */
  now?: Date
}

/**
 * Frozen `ActivityFeed` port (`src/components/activity/ActivityFeed.tsx`).
 *
 * Visible behavior is 1:1: banner above tabs, client-side type filtering, the
 * "Scroll for more or end of feed"/"Loading more..." sentinel, the global empty
 * state, and append-on-intersect infinite loading (`rootMargin: 200px`,
 * `threshold: 0.1`). Deltas: real tab semantics (`role="tab"`/`tabpanel`), and
 * the observer is created only when a sentinel actually exists (the frozen effect
 * ran on every state change). Loading/error states are new because the frozen page
 * rendered a blank feed on those paths.
 */
export function ActivityFeed({
  items,
  activeFilter,
  onFilterChange,
  newItemsCount,
  onLoadNewItems,
  isLoading,
  hasMore,
  loadError,
  onLoadMore,
  now,
}: ActivityFeedProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Auto-load the next page when the sentinel enters the viewport. Environments
  // without IntersectionObserver (jsdom) simply keep the footer informational.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const target = sentinelRef.current
    if (!target || !hasMore || isLoading) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px', threshold: 0.1 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  if (loadError && items.length === 0) {
    return (
      <div className='w-full max-w-2xl mx-auto'>
        <p
          role='alert'
          className='rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300'
        >
          {loadError}
        </p>
      </div>
    )
  }

  if (isLoading && items.length === 0) {
    return (
      <div className='w-full max-w-2xl mx-auto'>
        <ActivityFilters activeFilter={activeFilter} onChange={onFilterChange} />
        <ActivitySkeletons />
      </div>
    )
  }

  // Frozen early return: an empty feed replaces banner + tabs with the empty state.
  if (items.length === 0) return <EmptyActivityState />

  const filteredItems = filterActivityItems(items, activeFilter)

  return (
    <div className='w-full max-w-2xl mx-auto'>
      <NewActivityBanner count={newItemsCount} onLoad={onLoadNewItems} />
      <ActivityFilters activeFilter={activeFilter} onChange={onFilterChange} />

      <div
        id='activity-feed-panel'
        role='tabpanel'
        aria-labelledby={activityTabId(activeFilter)}
        aria-label={ACTIVITY_COPY.feedLabel}
        tabIndex={0}
        className='outline-none'
      >
        <div className='flex flex-col gap-3' data-testid='activity-feed'>
          {filteredItems.map(item => (
            <ActivityCard key={item.id} item={item} {...(now ? { now } : {})} />
          ))}
        </div>

        {items.length > 0 && (
          <div ref={sentinelRef} className='mt-6 py-4 text-center'>
            <p className='text-sm text-charcoal-500'>
              {isLoading && hasMore ? ACTIVITY_COPY.loadingMore : ACTIVITY_COPY.feedFooter}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
