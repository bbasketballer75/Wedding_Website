import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GUESTBOOK_FIXTURE, createStubGuestbookApi, useGuestbookReactions } from './data'
import type { GuestbookApi, GuestbookStorage } from './types'

function memoryStorage(): GuestbookStorage {
  const store = new Map<string, string>()
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: key => {
      store.delete(key)
    },
  }
}

function createApi(overrides: Partial<GuestbookApi> = {}): GuestbookApi {
  return Object.assign(
    createStubGuestbookApi(),
    {
      setReactions: vi.fn(() => Promise.resolve()),
    },
    overrides
  )
}

describe('useGuestbookReactions', () => {
  it('increments optimistically and persists the per-browser fingerprint marker', async () => {
    const api = createApi()
    const storage = memoryStorage()
    const { result } = renderHook(() =>
      useGuestbookReactions({
        messages: GUESTBOOK_FIXTURE,
        api,
        storage,
        createFingerprint: () => 'fp-test',
      })
    )

    expect(result.current.hasOwnReaction('message-1', 'love')).toBe(false)
    await act(async () => {
      await result.current.handleAddReaction('message-1', 'love')
    })

    expect(result.current.localReactions['message-1']?.love).toBe(13)
    expect(result.current.hasOwnReaction('message-1', 'love')).toBe(true)
    expect(result.current.hasAnyOwnReaction('message-1')).toBe(true)
    expect(api.setReactions).toHaveBeenCalledWith('message-1', { love: 13, clap: 4 })
    expect(storage.getItem('wedding-reacted:message-1:love:fp-test')).not.toBeNull()
  })

  it('toggles an already-reacted type back down (dedupe)', async () => {
    const api = createApi()
    const storage = memoryStorage()
    const { result } = renderHook(() =>
      useGuestbookReactions({
        messages: GUESTBOOK_FIXTURE,
        api,
        storage,
        createFingerprint: () => 'fp-test',
      })
    )

    await act(async () => {
      await result.current.handleAddReaction('message-1', 'love')
    })
    await act(async () => {
      await result.current.handleAddReaction('message-1', 'love')
    })

    expect(result.current.localReactions['message-1']?.love).toBe(12)
    expect(result.current.hasOwnReaction('message-1', 'love')).toBe(false)
    expect(storage.getItem('wedding-reacted:message-1:love:fp-test')).toBeNull()
  })

  it('rolls back the optimistic count and marker when the write fails', async () => {
    const api = createApi({ setReactions: vi.fn(() => Promise.reject(new Error('RLS'))) })
    const storage = memoryStorage()
    const { result } = renderHook(() =>
      useGuestbookReactions({
        messages: GUESTBOOK_FIXTURE,
        api,
        storage,
        createFingerprint: () => 'fp-test',
      })
    )

    await act(async () => {
      await result.current.handleAddReaction('message-1', 'clap')
    })

    expect(result.current.localReactions['message-1']?.clap).toBe(4)
    expect(result.current.hasOwnReaction('message-1', 'clap')).toBe(false)
    expect(storage.getItem('wedding-reacted:message-1:clap:fp-test')).toBeNull()
  })

  it('opens the picker for a message and ignores unknown ids', async () => {
    const api = createApi()
    const { result } = renderHook(() =>
      useGuestbookReactions({
        messages: GUESTBOOK_FIXTURE,
        api,
        storage: memoryStorage(),
        createFingerprint: () => 'fp-test',
      })
    )

    act(() => result.current.setReactionPickerForId('message-2'))
    expect(result.current.reactionPickerForId).toBe('message-2')

    await act(async () => {
      await result.current.handleAddReaction('missing-message', 'love')
    })
    expect(result.current.reactionPickerForId).toBeNull()
    expect(api.setReactions).not.toHaveBeenCalled()
  })

  it('reads an existing fingerprint from storage (no duplicate identity)', () => {
    const storage = memoryStorage()
    storage.setItem('wedding-guestbook-session-id', 'existing-fp')
    const { result } = renderHook(() =>
      useGuestbookReactions({
        messages: GUESTBOOK_FIXTURE,
        api: createApi(),
        storage,
        createFingerprint: () => 'new-fp',
      })
    )
    expect(result.current.fingerprint).toBe('existing-fp')
  })
})
