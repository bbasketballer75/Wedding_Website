import { useMemo, useCallback, useEffect } from 'react'
import { ActivityCard } from './ActivityCard'
import { ActivityFilters } from './ActivityFilters'
import { NewActivityBanner } from './NewActivityBanner'
import { EmptyActivityState } from './EmptyActivityState'
import { useActivityRealtime } from '@/hooks/useActivityRealtime'
import { activityFeedStore } from '@/stores/activityFeedStore'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { fetchActivityFeed } from '@/lib/supabase'

const typeFilterMap = {
  all: null,
  photos: 'photo_upload',
  guestbook: 'guestbook_entry',
  moments: 'featured_moment',
} as const

export function ActivityFeed() {
  const items = activityFeedStore(state => state.items)
  const activeFilter = activityFeedStore(state => state.activeFilter)
  const isLoading = activityFeedStore(state => state.isLoading)
  const hasMore = activityFeedStore(state => state.hasMore)
  const setItems = activityFeedStore(state => state.setItems)
  const setHasMore = activityFeedStore(state => state.setHasMore)
  const setIsLoading = activityFeedStore(state => state.setIsLoading)

  // Subscribe to realtime updates
  useActivityRealtime()

  // Load more callback for infinite scroll
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    setIsLoading(true)
    try {
      const moreItems = await fetchActivityFeed(20)
      if (moreItems.length === 0) {
        setHasMore(false)
      } else {
        setItems([...items, ...moreItems])
      }
    } catch (error) {
      console.error('Failed to load more:', error)
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, items, setItems, setHasMore, setIsLoading])

  // Infinite scroll trigger at threshold
  const [targetRef, isIntersecting] = useIntersectionObserver({
    rootMargin: '200px',
    threshold: 0.1,
  })

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading) {
      loadMore()
    }
  }, [isIntersecting, hasMore, isLoading, loadMore])

  // Client-side filtering
  const filteredItems = useMemo(() => {
    const filterType = typeFilterMap[activeFilter]
    if (!filterType) return items
    return items.filter(item => item.type === filterType)
  }, [items, activeFilter])

  if (items.length === 0 && !isLoading) {
    return <EmptyActivityState />
  }

  return (
    <div className='w-full max-w-2xl mx-auto'>
      <NewActivityBanner />
      <ActivityFilters />

      <div className='flex flex-col gap-3'>
        {filteredItems.map(item => (
          <ActivityCard key={item.id} item={item} />
        ))}
      </div>

      {hasMore && items.length > 0 && (
        <div ref={targetRef} className='mt-6 text-center py-4'>
          <p className='text-sm text-charcoal-500'>
            {isLoading ? 'Loading more...' : 'Scroll for more or end of feed'}
          </p>
        </div>
      )}
    </div>
  )
}
