import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Message } from './types'
import { INITIAL_VISIBLE_MESSAGES } from './constants'

export interface UseGuestbookFeedResult {
  searchQuery: string
  setSearchQuery: (query: string) => void
  visibleCount: number
  setVisibleCount: (count: number) => void
  filteredMessages: Message[]
  visibleMessages: Message[]
  hasMoreMessages: boolean
  highlightedMessageId: string | null
  resetVisibleCount: () => void
}

export function useGuestbookFeed(messages: Message[]): UseGuestbookFeedResult {
  const [searchParams] = useSearchParams()
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_MESSAGES)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  // Sync ?message= deep-link param → highlighted message id
  useEffect(() => {
    const requestedMessageId = searchParams.get('message')
    if (!requestedMessageId) {
      setHighlightedMessageId(null)
      return
    }
    setHighlightedMessageId(requestedMessageId)
  }, [searchParams])

  // Memoized so the deep-link effect below doesn't re-run on every render
  const filteredMessages = useMemo(
    () =>
      searchQuery.trim()
        ? messages.filter(m => {
            const q = searchQuery.toLowerCase()
            return m.name.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
          })
        : messages,
    [messages, searchQuery]
  )

  // Cap slice synchronously so visibleCount being stale for one frame never shows
  // more items than exist in the current filtered set.
  const visibleMessages = filteredMessages.slice(0, Math.min(visibleCount, filteredMessages.length))
  const hasMoreMessages = filteredMessages.length > visibleCount

  // Reset visible count when search changes so pagination stays accurate
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [searchQuery])

  useEffect(() => {
    if (!highlightedMessageId) return

    const highlightedIndex = filteredMessages.findIndex(
      message => message.id === highlightedMessageId
    )
    if (highlightedIndex === -1) {
      // The deep-linked message is filtered out by the current search — clear it so the
      // link destination becomes visible rather than silently failing.
      if (searchQuery) setSearchQuery('')
      return
    }

    if (highlightedIndex >= visibleCount) {
      setVisibleCount(highlightedIndex + 1)
      return
    }

    const timeout = window.setTimeout(() => {
      document
        .getElementById(`guestbook-message-${highlightedMessageId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 220)
    return () => window.clearTimeout(timeout)
  }, [filteredMessages, highlightedMessageId, visibleCount, searchQuery])

  const resetVisibleCount = useCallback(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [])

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
