import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GUESTBOOK_FIXED_NOW, createStubGuestbookApi, useGuestbookReplies } from './data'
import type { GuestbookApi, GuestbookComment } from './types'

function createApi(overrides: Partial<GuestbookApi> = {}): GuestbookApi {
  return Object.assign(
    createStubGuestbookApi(),
    {
      addReply: vi.fn(() =>
        Promise.resolve<GuestbookComment>({
          id: 'saved-reply-1',
          author: 'Guest',
          content: 'Congratulations!',
          createdAt: GUESTBOOK_FIXED_NOW,
        })
      ),
    },
    overrides
  )
}

describe('useGuestbookReplies', () => {
  it('appends optimistically then swaps in the saved reply', async () => {
    const api = createApi()
    const { result } = renderHook(() =>
      useGuestbookReplies({ api, now: () => new Date(GUESTBOOK_FIXED_NOW).getTime() })
    )

    await act(async () => {
      await result.current.handleSubmitReply('message-1', '  Congratulations!  ')
    })

    expect(api.addReply).toHaveBeenCalledWith({
      messageId: 'message-1',
      author: 'Guest',
      content: 'Congratulations!',
    })
    const replies = result.current.extraComments['message-1'] ?? []
    expect(replies).toHaveLength(1)
    expect(replies[0]?.id).toBe('saved-reply-1')
    expect(result.current.replyError).toBeNull()
  })

  it('rolls back the optimistic reply and reports the failure', async () => {
    const api = createApi({ addReply: vi.fn(() => Promise.reject(new Error('insert failed'))) })
    const { result } = renderHook(() => useGuestbookReplies({ api }))

    await act(async () => {
      await result.current.handleSubmitReply('message-3', 'So happy for you both.')
    })

    expect(result.current.extraComments['message-3'] ?? []).toHaveLength(0)
    expect(result.current.replyError).toMatch(/could not be saved/)
    expect(result.current.replyErrorForMessageId).toBe('message-3')
  })

  it('ignores empty replies', async () => {
    const api = createApi()
    const { result } = renderHook(() => useGuestbookReplies({ api }))

    await act(async () => {
      await result.current.handleSubmitReply('message-1', '   ')
    })
    expect(api.addReply).not.toHaveBeenCalled()
    expect(result.current.extraComments).toEqual({})
  })
})
