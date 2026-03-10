import { useState, useEffect, useCallback, useRef } from 'react'

interface UseInfiniteScrollOptions<T> {
  items: T[]
  itemsPerPage?: number
  threshold?: number
}

interface UseInfiniteScrollReturn<T> {
  displayedItems: T[]
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
  reset: () => void
  observerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Custom hook for implementing infinite scroll with proper race condition handling
 * Uses AbortController for cancellation and proper async/await patterns
 */
export function useInfiniteScroll<T>({
  items,
  itemsPerPage = 12,
  threshold = 100,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [displayedItems, setDisplayedItems] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)
  
  // Use ref for abort controller to avoid stale closures and enable proper cleanup
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Use ref to track pending load operations
  const pendingLoadRef = useRef<Promise<void> | null>(null)

  const hasMore = displayedItems.length < items.length

  /**
   * Load more items with proper async handling and cancellation support
   */
  const loadMore = useCallback(async () => {
    // Prevent concurrent loads
    if (isLoading || !hasMore || pendingLoadRef.current) {
      return
    }

    // Cancel any previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this operation
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setIsLoading(true)

    // Create the load promise
    const loadPromise = (async () => {
      try {
        // Simulate network delay for smooth UX
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (!signal.aborted) {
              resolve()
            }
          }, 300)

          // Listen for abort signal
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })

        // Check if aborted before updating state
        if (signal.aborted) {
          return
        }

        // Calculate next page items
        const nextPage = page + 1
        const endIndex = nextPage * itemsPerPage
        const newItems = items.slice(0, endIndex)

        // Check again if aborted before state update
        if (signal.aborted) {
          return
        }

        // Batch state updates to ensure consistency
        setDisplayedItems(newItems)
        setPage(nextPage)
      } catch (error) {
        // Ignore abort errors (they're expected during cleanup)
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.error('Error loading more items:', error)
      } finally {
        // Only clear loading state if this operation wasn't aborted
        if (!signal.aborted) {
          setIsLoading(false)
        }
      }
    })()

    // Track the pending operation
    pendingLoadRef.current = loadPromise

    try {
      await loadPromise
    } finally {
      // Clear pending ref if this is still the current operation
      if (pendingLoadRef.current === loadPromise) {
        pendingLoadRef.current = null
      }
    }
  }, [items, page, itemsPerPage, isLoading, hasMore])

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    // Cancel any pending operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    pendingLoadRef.current = null

    setDisplayedItems(items.slice(0, itemsPerPage))
    setPage(1)
    setIsLoading(false)
  }, [items, itemsPerPage])

  // Reset when items change
  useEffect(() => {
    reset()
  }, [reset])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Intersection Observer for auto-load
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { rootMargin: `${threshold}px` }
    )

    const currentRef = observerRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
      observer.disconnect()
    }
  }, [loadMore, hasMore, isLoading, threshold])

  return {
    displayedItems,
    hasMore,
    isLoading,
    loadMore,
    reset,
    observerRef,
  }
}

export default useInfiniteScroll
