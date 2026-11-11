import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { INITIAL_VISIBLE_MESSAGES } from './constants'
import type { GuestbookMessage } from './types'

/**
 * Feed view state (frozen `src/pages/guestbook/useGuestbookFeed.ts`):
 * search, "Read more notes" pagination and the `?message=<id>` deep link.
 *
 * Deltas from the oracle (all deliberate for determinism / react-hooks v7):
 * - the deep link never calls setState from an effect: the highlighted id is a
 *   prop, the page-size expansion is derived, and a conflicting search is
 *   cleared at initialisation (the page passes `initialSearch: ''` for a deep
 *   link) instead of via an effect;
 * - scrolling uses an injectable `scrollIntoView` seam so tests assert the call
 *   without timers or smooth-scroll animations.
 */
export interface UseGuestbookFeedViewOptions {
  messages: GuestbookMessage[]
  /** From `?q=`; ignored/cleared when a message deep link is present. */
  initialSearch?: string
  /** From `?message=` (contracts/routes.json guestbook query contract). */
  highlightedMessageId?: string | null
  scrollToMessage?: (messageId: string) => void
}

export interface UseGuestbookFeedViewResult {
  searchQuery: string
  setSearchQuery: (query: string) => void
  visibleCount: number
  setVisibleCount: (count: number) => void
  filteredMessages: GuestbookMessage[]
  visibleMessages: GuestbookMessage[]
  hasMoreMessages: boolean
  highlightedMessageId: string | null
  resetVisibleCount: () => void
}

interface PaginationState {
  query: string
  count: number
}

export function useGuestbookFeedView({
  messages,
  initialSearch = '',
  highlightedMessageId = null,
  scrollToMessage,
}: UseGuestbookFeedViewOptions): UseGuestbookFeedViewResult {
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [pagination, setPagination] = useState<PaginationState>({
    query: initialSearch,
    count: INITIAL_VISIBLE_MESSAGES,
  })
  const lastScrolledRef = useRef<string | null>(null)

  // A deep link wins over a conflicting search: the page clears the initial
  // query when `?message=` is present, and any later query that filters the
  // linked note away simply returns the unfiltered list (the note stays visible).
  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return messages
    return messages.filter(
      message =>
        message.name.toLowerCase().includes(query) || message.content.toLowerCase().includes(query)
    )
  }, [messages, searchQuery])

  const highlightedIndex = useMemo(
    () =>
      highlightedMessageId
        ? messages.findIndex(message => message.id === highlightedMessageId)
        : -1,
    [highlightedMessageId, messages]
  )

  const baseVisibleCount =
    pagination.query === searchQuery ? pagination.count : INITIAL_VISIBLE_MESSAGES
  // Ensure the deep-linked note is always inside the visible page.
  const visibleCount =
    highlightedIndex >= 0 ? Math.max(baseVisibleCount, highlightedIndex + 1) : baseVisibleCount
  const visibleMessages = filteredMessages.slice(0, Math.min(visibleCount, filteredMessages.length))
  const hasMoreMessages = filteredMessages.length > visibleCount

  const setVisibleCount = useCallback(
    (count: number) => {
      setPagination({ query: searchQuery, count })
    },
    [searchQuery]
  )

  const resetVisibleCount = useCallback(() => {
    setPagination({ query: searchQuery, count: INITIAL_VISIBLE_MESSAGES })
  }, [searchQuery])

  // Scroll the deep-linked note into view once per requested id. No state is set
  // here, so it is effect-safe under react-hooks v7.
  useEffect(() => {
    if (!highlightedMessageId) {
      lastScrolledRef.current = null
      return
    }
    if (lastScrolledRef.current === highlightedMessageId) return
    lastScrolledRef.current = highlightedMessageId
    scrollToMessage?.(highlightedMessageId)
  }, [highlightedMessageId, scrollToMessage])

  return {
    searchQuery,
    setSearchQuery,
    visibleCount,
    setVisibleCount,
    filteredMessages,
    visibleMessages,
    hasMoreMessages,
    highlightedMessageId,
    resetVisibleCount,
  }
}
