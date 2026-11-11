import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStubGuestbookApi, useGuestbookComposer, GUESTBOOK_FIXED_NOW } from './data'
import { createRateLimiter } from './rateLimit'
import { GUESTBOOK_COPY } from './constants'
import type { GuestbookApi } from './types'

function createApi(overrides: Partial<GuestbookApi> = {}): GuestbookApi {
  return { ...createStubGuestbookApi(), ...overrides }
}

interface ScheduledTask {
  callback: () => void
  delayMs: number
}

function manualScheduler() {
  const tasks: ScheduledTask[] = []
  return {
    tasks,
    schedule: (callback: () => void, delayMs: number) => {
      tasks.push({ callback, delayMs })
      return tasks.length
    },
    runNext: () => {
      const next = tasks.shift()
      next?.callback()
    },
    runAll: () => {
      while (tasks.length > 0) tasks.shift()?.callback()
    },
  }
}

function submitEvent() {
  return { preventDefault: () => undefined }
}

function fillValidNote(
  result: { current: ReturnType<typeof useGuestbookComposer> },
  { name = 'Austin', email = '', content = 'A truly memorable note from the wedding day.' } = {}
) {
  act(() => {
    result.current.setName(name)
    result.current.setEmail(email)
    result.current.setContent(content)
  })
}

describe('useGuestbookComposer', () => {
  it('validates fields before calling the API', async () => {
    const api = createApi({ submitMessage: vi.fn() })
    const prependMessage = vi.fn()
    const scheduler = manualScheduler()
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api,
        prependMessage,
        resetVisibleCount: vi.fn(),
        schedule: scheduler.schedule,
        now: () => new Date(GUESTBOOK_FIXED_NOW).getTime(),
      })
    )

    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })

    expect(result.current.errors.name).toMatch(/between 2 and 50/)
    expect(result.current.errors.content).toMatch(/at least 10/)
    expect(api.submitMessage).not.toHaveBeenCalled()
  })

  it('submits through the API, optimistically prepends and schedules the frozen reset', async () => {
    const submitMessage = vi.fn(() =>
      Promise.resolve({
        status: 'submitted' as const,
        messageId: 'saved-1',
        rateLimitRemaining: 2,
        viaFallback: false,
      })
    )
    const api = createApi({ submitMessage })
    const prependMessage = vi.fn()
    const resetVisibleCount = vi.fn()
    const scheduler = manualScheduler()
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api,
        prependMessage,
        resetVisibleCount,
        schedule: scheduler.schedule,
        now: () => new Date(GUESTBOOK_FIXED_NOW).getTime(),
      })
    )

    act(() => result.current.openComposer())
    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })

    expect(submitMessage).toHaveBeenCalledWith({
      name: 'Austin',
      email: '',
      content: 'A truly memorable note from the wedding day.',
    })
    expect(prependMessage).toHaveBeenCalledWith({
      id: 'saved-1',
      name: 'Austin',
      content: 'A truly memorable note from the wedding day.',
      createdAt: GUESTBOOK_FIXED_NOW,
      mediaUrl: null,
      reactions: {},
      comments: [],
    })
    expect(resetVisibleCount).toHaveBeenCalledOnce()
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.statusMessage).toBe(GUESTBOOK_COPY.submitSuccess)
    expect(result.current.lastSubmitViaFallback).toBe(false)

    // Frozen 2200 ms reset is scheduled, not slept: invoke it manually.
    expect(scheduler.tasks).toHaveLength(1)
    expect(scheduler.tasks[0]?.delayMs).toBe(2200)
    act(() => scheduler.runAll())
    expect(result.current.showForm).toBe(false)
    expect(result.current.name).toBe('')
    expect(result.current.content).toBe('')
  })

  it('flags the documented RPC fallback path instead of hiding it (R17)', async () => {
    const submitMessage = vi.fn(() =>
      Promise.resolve({
        status: 'submitted' as const,
        messageId: 'saved-2',
        rateLimitRemaining: null,
        viaFallback: true,
      })
    )
    const api = createApi({ submitMessage })
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api,
        prependMessage: vi.fn(),
        resetVisibleCount: vi.fn(),
        schedule: manualScheduler().schedule,
      })
    )
    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.lastSubmitViaFallback).toBe(true)
  })

  it('silently succeeds on a filled honeypot without calling the API', async () => {
    const submitMessage = vi.fn(() =>
      Promise.resolve({
        status: 'submitted' as const,
        messageId: 'saved-3',
        rateLimitRemaining: null,
        viaFallback: false,
      })
    )
    const api = createApi({ submitMessage })
    const scheduler = manualScheduler()
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api,
        prependMessage: vi.fn(),
        resetVisibleCount: vi.fn(),
        schedule: scheduler.schedule,
      })
    )

    act(() => result.current.setWebsite('https://spam.example'))
    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })

    expect(submitMessage).not.toHaveBeenCalled()
    expect(scheduler.tasks[0]?.delayMs).toBe(500)
    act(() => scheduler.runNext())
    expect(result.current.isSubmitted).toBe(true)
    // A second scheduled callback performs the visible form reset.
    expect(scheduler.tasks[0]?.delayMs).toBe(2200)
    act(() => scheduler.runAll())
    expect(result.current.showForm).toBe(false)
    expect(result.current.website).toBe('')
  })

  it('enforces the client 3/minute limiter before the API call', async () => {
    let clock = 0
    const submitMessage = vi.fn(() =>
      Promise.resolve({
        status: 'submitted' as const,
        messageId: 'saved-4',
        rateLimitRemaining: null,
        viaFallback: false,
      })
    )
    const api = createApi({ submitMessage })
    const scheduler = manualScheduler()
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api,
        prependMessage: vi.fn(),
        resetVisibleCount: vi.fn(),
        limiter: createRateLimiter({ maxRequests: 2, windowMs: 60_000, now: () => clock }),
        schedule: scheduler.schedule,
      })
    )

    for (let index = 0; index < 2; index += 1) {
      fillValidNote(result)
      await act(async () => {
        await result.current.handleSubmit(submitEvent())
      })
    }
    expect(submitMessage).toHaveBeenCalledTimes(2)

    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(submitMessage).toHaveBeenCalledTimes(2)
    expect(result.current.statusMessage).toMatch(/Give it a moment/)

    clock += 60_000
    act(() => result.current.setShowForm(true))
    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(submitMessage).toHaveBeenCalledTimes(3)
  })

  it('surfaces API failures and rate-limited results', async () => {
    const throwingApi = createApi({
      submitMessage: vi.fn(() => Promise.reject(new Error('network down'))),
    })
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api: throwingApi,
        prependMessage: vi.fn(),
        resetVisibleCount: vi.fn(),
        schedule: manualScheduler().schedule,
      })
    )
    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(result.current.submitError).toBe(GUESTBOOK_COPY.submitError)
    expect(result.current.isSubmitted).toBe(false)
  })

  it('shows the server rate-limit message when the API returns rate-limited', async () => {
    const rateLimitedApi = createApi({
      submitMessage: vi.fn(() =>
        Promise.resolve({
          status: 'rate-limited' as const,
          message: 'The server says: slow down.',
          resetAfterSeconds: 42,
        })
      ),
    })
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api: rateLimitedApi,
        prependMessage: vi.fn(),
        resetVisibleCount: vi.fn(),
        schedule: manualScheduler().schedule,
      })
    )
    fillValidNote(result)
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(result.current.statusMessage).toBe('The server says: slow down.')
    expect(result.current.isSubmitted).toBe(false)
  })

  it('validates an optional email when one is typed', async () => {
    const submitMessage = vi.fn()
    const api = createApi({ submitMessage })
    const { result } = renderHook(() =>
      useGuestbookComposer({
        api,
        prependMessage: vi.fn(),
        resetVisibleCount: vi.fn(),
        schedule: manualScheduler().schedule,
      })
    )
    fillValidNote(result, { email: 'not-an-email' })
    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(result.current.errors.email).toBe('Enter a valid email address.')
    expect(submitMessage).not.toHaveBeenCalled()
  })
})
