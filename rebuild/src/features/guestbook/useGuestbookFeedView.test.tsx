import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { INITIAL_VISIBLE_MESSAGES } from './constants'
import { useGuestbookFeedView } from './useGuestbookFeedView'
import type { GuestbookMessage } from './types'

function makeMessages(count: number): GuestbookMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `message-${index + 1}`,
    name: `Guest ${index + 1}`,
    content: `Memory number ${index + 1} from the celebration.`,
    createdAt: `2025-05-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    mediaUrl: null,
    reactions: {},
    comments: [],
  }))
}

describe('useGuestbookFeedView', () => {
  it('paginates 8 notes at a time ("Read more notes")', () => {
    const messages = makeMessages(12)
    const { result } = renderHook(() => useGuestbookFeedView({ messages }))

    expect(result.current.visibleMessages).toHaveLength(INITIAL_VISIBLE_MESSAGES)
    expect(result.current.hasMoreMessages).toBe(true)

    act(() =>
      result.current.setVisibleCount(result.current.visibleCount + INITIAL_VISIBLE_MESSAGES)
    )
    expect(result.current.visibleMessages).toHaveLength(12)
    expect(result.current.hasMoreMessages).toBe(false)
  })

  it('filters by name or message content and resets pagination for a new query', () => {
    const messages = makeMessages(12)
    const { result } = renderHook(() => useGuestbookFeedView({ messages }))

    act(() => result.current.setVisibleCount(12))
    expect(result.current.visibleMessages).toHaveLength(12)

    act(() => result.current.setSearchQuery('Guest 3'))
    expect(result.current.filteredMessages).toHaveLength(1)
    expect(result.current.visibleMessages).toHaveLength(1)
    expect(result.current.filteredMessages[0]?.id).toBe('message-3')

    act(() => result.current.setSearchQuery('celebration'))
    expect(result.current.filteredMessages).toHaveLength(12)

    act(() => result.current.setSearchQuery('no-such-note'))
    expect(result.current.filteredMessages).toHaveLength(0)

    act(() => result.current.resetVisibleCount())
    expect(result.current.visibleCount).toBe(INITIAL_VISIBLE_MESSAGES)
  })

  it('honours an initial search term from ?q=', () => {
    const messages = makeMessages(12)
    const { result } = renderHook(() =>
      useGuestbookFeedView({ messages, initialSearch: 'Guest 2' })
    )
    expect(result.current.searchQuery).toBe('Guest 2')
    expect(result.current.filteredMessages).toHaveLength(1)
  })

  it('expands the page so a ?message= deep link is always visible and scrolls to it once', () => {
    const messages = makeMessages(12)
    const scrollToMessage = vi.fn()
    const { result, rerender } = renderHook(
      (props: { highlightedMessageId: string | null }) =>
        useGuestbookFeedView({
          messages,
          initialSearch: '',
          highlightedMessageId: props.highlightedMessageId,
          scrollToMessage,
        }),
      { initialProps: { highlightedMessageId: 'message-11' } }
    )

    expect(result.current.visibleMessages).toHaveLength(11)
    expect(result.current.highlightedMessageId).toBe('message-11')
    expect(scrollToMessage).toHaveBeenCalledTimes(1)
    expect(scrollToMessage).toHaveBeenCalledWith('message-11')

    // Re-rendering the same deep link does not re-scroll.
    rerender({ highlightedMessageId: 'message-11' })
    expect(scrollToMessage).toHaveBeenCalledTimes(1)

    rerender({ highlightedMessageId: 'message-2' })
    expect(result.current.visibleMessages).toHaveLength(8)
    expect(scrollToMessage).toHaveBeenCalledTimes(2)
    expect(scrollToMessage).toHaveBeenLastCalledWith('message-2')
  })

  it('leaves the full list intact when a search conflicts with the deep link', () => {
    const messages = makeMessages(4)
    const { result } = renderHook(() =>
      useGuestbookFeedView({
        messages,
        // The page clears a conflicting ?q= when ?message= is present.
        initialSearch: '',
        highlightedMessageId: 'message-4',
      })
    )
    expect(result.current.searchQuery).toBe('')
    expect(result.current.filteredMessages).toHaveLength(4)
    expect(result.current.visibleMessages.map(message => message.id)).toContain('message-4')
  })

  it('handles an unknown deep-link id without expanding or scrolling', () => {
    const messages = makeMessages(3)
    const scrollToMessage = vi.fn()
    const { result } = renderHook(() =>
      useGuestbookFeedView({
        messages,
        highlightedMessageId: 'missing-message',
        scrollToMessage,
      })
    )
    expect(result.current.visibleMessages).toHaveLength(3)
    expect(scrollToMessage).toHaveBeenCalledWith('missing-message')
  })
})
