import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Port of the frozen `useInfiniteScroll` (src/hooks/useInfiniteScroll.ts),
 * minus its 300 ms artificial delay (a sleep the quality bar forbids) and its
 * state-in-effect reset. The visible contract is unchanged: page 1 is
 * preloaded, `loadMore()` reveals the next page, `hasMore` gates the trigger,
 * and the displayed window resets when the item set changes.
 */
export interface UseInfiniteScrollOptions<T> {
  items: T[]
  itemsPerPage?: number
  threshold?: number
  rootRef?: { current: Element | null }
}

export interface UseInfiniteScrollResult<T> {
  displayedItems: T[]
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
  reset: () => void
  observerRef: { current: HTMLDivElement | null }
}

interface PaginationState<T> {
  /** Item array the page counter belongs to; a new array identity resets to page 1. */
  items: T[]
  page: number
}

export function useInfiniteScroll<T>({
  items,
  itemsPerPage = 12,
  threshold = 100,
  rootRef,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const [pagination, setPagination] = useState<PaginationState<T>>({ items, page: 1 })
  const observerRef = useRef<HTMLDivElement | null>(null)

  // Derived (not effect-driven) reset: when the filtered item set changes the
  // window falls back to page 1 until the next explicit loadMore.
  const page = pagination.items === items ? pagination.page : 1
  const displayedItems = items.slice(0, page * itemsPerPage)
  const hasMore = displayedItems.length < items.length

  const loadMore = useCallback(() => {
    setPagination(previous => {
      const basePage = previous.items === items ? previous.page : 1
      const lastPage = Math.max(1, Math.ceil(items.length / itemsPerPage))
      return { items, page: Math.min(basePage + 1, lastPage) }
    })
  }, [items, itemsPerPage])

  const reset = useCallback(() => {
    setPagination({ items, page: 1 })
  }, [items])

  // Auto-load when the sentinel enters the viewport. The sentinel + explicit
  // button both exist in the DOM, so environments without IntersectionObserver
  // (jsdom, reduced-capability browsers) still have the manual path.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const target = observerRef.current
    if (!target || !hasMore) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { root: rootRef?.current ?? null, rootMargin: `${threshold}px` }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loadMore, rootRef, threshold])

  return { displayedItems, hasMore, isLoading: false, loadMore, reset, observerRef }
}
