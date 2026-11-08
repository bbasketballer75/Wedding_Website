import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createStubActivityApi,
  filterActivityItems,
  isE2ESandbox,
  useActivityFeed,
  useActivityRealtime,
} from './data'
import { ACTIVITY_FIXTURE } from './fixtures'
import type {
  ActivityApi,
  ActivityItem,
  ActivitySourceType,
  ActivitySubscription,
  ActivityType,
} from './types'

function makeItem(id: string, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id,
    type: 'photo_upload',
    sourceId: `source-${id}`,
    sourceType: 'guest_uploads',
    displayName: `Guest ${id}`,
    thumbnailUrl: null,
    contentPreview: null,
    createdAt: '2025-05-10T14:00:00.000Z',
    ...overrides,
  }
}

function makeItems(
  start: number,
  count: number,
  overrides: Partial<ActivityItem> = {}
): ActivityItem[] {
  return Array.from({ length: count }, (_, index) => makeItem(`a-${start + index}`, overrides))
}

/** Feed pages + a controllable realtime handler for hook/page tests. */
function createControllableApi(pages?: readonly (readonly ActivityItem[])[]) {
  const stub = createStubActivityApi(pages ? { pages } : {})
  const realtime = {
    handler: null as ((item: ActivityItem) => void) | null,
    unsubscribe: vi.fn<() => void>(),
  }
  const subscribe = vi.fn((onInsert: (item: ActivityItem) => void): ActivitySubscription => {
    realtime.handler = onInsert
    return { unsubscribe: realtime.unsubscribe }
  })
  const api: ActivityApi = { loadFeed: stub.loadFeed, subscribe }
  return { api, realtime, subscribe }
}

describe('filterActivityItems', () => {
  const items = [
    makeItem('photo', { type: 'photo_upload' }),
    makeItem('note', { type: 'guestbook_entry' }),
    makeItem('moment', { type: 'featured_moment' }),
  ]

  it('maps the frozen filters to the moments type map', () => {
    expect(filterActivityItems(items, 'all').map(item => item.id)).toEqual([
      'photo',
      'note',
      'moment',
    ])
    expect(filterActivityItems(items, 'photos').map(item => item.id)).toEqual(['photo'])
    expect(filterActivityItems(items, 'guestbook').map(item => item.id)).toEqual(['note'])
    expect(filterActivityItems(items, 'moments').map(item => item.id)).toEqual(['moment'])
  })

  it('does not mutate or share the item array', () => {
    const filtered = filterActivityItems(items, 'all')
    expect(filtered).not.toBe(items)
    filtered.pop()
    expect(items).toHaveLength(3)
  })
})

describe('createStubActivityApi', () => {
  it('serves the frozen fixture page, then an empty page', async () => {
    const api = createStubActivityApi()
    const first = await api.loadFeed(100)
    expect(first.map(item => item.id)).toEqual(['act-1', 'act-2'])
    expect(first[0]).not.toBe(ACTIVITY_FIXTURE[0])
    expect(await api.loadFeed(20)).toEqual([])
  })

  it('serves injected pages in order', async () => {
    const api = createStubActivityApi({ pages: [makeItems(1, 2), makeItems(3, 1), []] })
    expect((await api.loadFeed(100)).map(item => item.id)).toEqual(['a-1', 'a-2'])
    expect((await api.loadFeed(20)).map(item => item.id)).toEqual(['a-3'])
    expect(await api.loadFeed(20)).toEqual([])
  })
})

describe('useActivityFeed', () => {
  it('loads the first page, appends the next page, then stops on an empty page', async () => {
    const api = createStubActivityApi({ pages: [makeItems(1, 3), makeItems(4, 2), []] })
    const { result } = renderHook(() => useActivityFeed({ api }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items.map(item => item.id)).toEqual(['a-1', 'a-2', 'a-3'])
    expect(result.current.hasMore).toBe(true)
    expect(result.current.loadError).toBeNull()

    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.items.map(item => item.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4', 'a-5'])

    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.hasMore).toBe(false)
    expect(result.current.items).toHaveLength(5)

    // A third loadMore is a no-op once the feed has ended.
    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.items).toHaveLength(5)
  })

  it('de-dupes appends by id and prepends banner items newest-first', async () => {
    const api = createStubActivityApi({
      pages: [makeItems(1, 3), [makeItem('a-2'), makeItem('a-4')], []],
    })
    const { result } = renderHook(() => useActivityFeed({ api }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.items.map(item => item.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4'])

    const bannerItems = [makeItem('live-2'), makeItem('live-1')]
    act(() => result.current.prependItems(bannerItems))
    expect(result.current.items.map(item => item.id)).toEqual([
      'live-2',
      'live-1',
      'a-1',
      'a-2',
      'a-3',
      'a-4',
    ])

    // Same-id prepends are ignored (no duplicated cards).
    act(() => result.current.prependItems([makeItem('a-3')]))
    expect(result.current.items.filter(item => item.id === 'a-3')).toHaveLength(1)
  })

  it('records a load error and shows an empty feed', async () => {
    const failingApi: ActivityApi = {
      loadFeed: () => Promise.reject(new Error('network down')),
      subscribe: () => ({ unsubscribe: () => undefined }),
    }
    const { result } = renderHook(() => useActivityFeed({ api: failingApi }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(result.current.loadError).toBe(
      'Having trouble loading the activity feed right now — please try again.'
    )
  })
})

describe('useActivityRealtime', () => {
  it('delivers INSERTs through the injected subscription and unsubscribes on unmount', () => {
    const { api, realtime, subscribe } = createControllableApi()
    const onInsert = vi.fn()
    const { unmount } = renderHook(() => useActivityRealtime({ api, onInsert }))

    expect(subscribe).toHaveBeenCalledTimes(1)
    const item = makeItem('live-1')
    act(() => realtime.handler?.(item))
    expect(onInsert).toHaveBeenCalledWith(item)

    unmount()
    expect(realtime.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe when the injected sandbox predicate is true', () => {
    const { api, subscribe } = createControllableApi()
    renderHook(() => useActivityRealtime({ api, onInsert: vi.fn(), isSandbox: () => true }))
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('does not subscribe when window.__E2E__ is set (frozen kill switch)', () => {
    const { api, subscribe } = createControllableApi()
    const windowWithE2E = window as Window & { __E2E__?: boolean }
    windowWithE2E.__E2E__ = true
    try {
      expect(isE2ESandbox()).toBe(true)
      renderHook(() => useActivityRealtime({ api, onInsert: vi.fn() }))
      expect(subscribe).not.toHaveBeenCalled()
    } finally {
      delete windowWithE2E.__E2E__
    }
  })

  it('re-subscribes when the injected api changes', () => {
    const first = createControllableApi()
    const second = createControllableApi()
    const onInsert = vi.fn()
    const { rerender } = renderHook(
      ({ api }: { api: ActivityApi }) => useActivityRealtime({ api, onInsert }),
      { initialProps: { api: first.api } }
    )
    expect(first.subscribe).toHaveBeenCalledTimes(1)

    rerender({ api: second.api })
    expect(first.realtime.unsubscribe).toHaveBeenCalledTimes(1)
    expect(second.subscribe).toHaveBeenCalledTimes(1)
  })
})

/** Compile-time guard: the exported unions stay aligned with the frozen DB enums. */
const TYPE_GUARD: Record<ActivityType, true> = {
  photo_upload: true,
  guestbook_entry: true,
  featured_moment: true,
}
const SOURCE_TYPE_GUARD: Record<ActivitySourceType, true> = {
  guest_uploads: true,
  guestbook_messages: true,
  site_editorial_features: true,
}

describe('contract types', () => {
  it('covers every activity type and source type', () => {
    expect(Object.keys(TYPE_GUARD)).toHaveLength(3)
    expect(Object.keys(SOURCE_TYPE_GUARD)).toHaveLength(3)
  })
})
