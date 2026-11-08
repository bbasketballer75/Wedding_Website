/**
 * Activity feed data boundary (Wave 6 W6-4).
 *
 * Deterministic stub API + the two hooks the page needs, so the page, tests and
 * parity captures are stable before the typed data layer is wired through the app.
 *
 * TODO(Wave3): the Lead swaps this boundary for the real `shared/data/activity.ts`
 * exports. `ActivityApi` mirrors them 1:1:
 *   loadFeed(limit)  -> fetchActivityFeed(limit)
 *   subscribe(fn)    -> subscribeToActivityInserts(fn, { enabled: !isE2ESandbox() })
 * No component changes are needed — the page takes `api` as an injected prop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ACTIVITY_COPY,
  ACTIVITY_FEED_LIMIT,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_TYPE_FILTER,
} from './constants'
import { ACTIVITY_FIXTURE } from './fixtures'
import type { ActivityApi, ActivityFilterType, ActivityItem, ActivitySubscription } from './types'

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Frozen client-side filter (the `typeFilterMap` in `ActivityFeed.tsx`). */
export function filterActivityItems(
  items: readonly ActivityItem[],
  filter: ActivityFilterType
): ActivityItem[] {
  const type = ACTIVITY_TYPE_FILTER[filter]
  return type === null ? [...items] : items.filter(item => item.type === type)
}

function mergeUnique(
  existing: readonly ActivityItem[],
  incoming: readonly ActivityItem[]
): ActivityItem[] {
  const seen = new Set(existing.map(item => item.id))
  const merged = [...existing]
  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  return merged
}

/** Frozen realtime kill-switch: the e2e/parity sandbox sets `window.__E2E__`. */
export function isE2ESandbox(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as Window & { __E2E__?: boolean }).__E2E__)
}

/* -------------------------------------------------------------------------- */
/* Stub data boundary (TODO(Wave3): replace with shared/data/activity)         */
/* -------------------------------------------------------------------------- */

export interface StubActivityApiOptions {
  /**
   * Feed pages in load order: the first call is the 100-item initial load, each
   * later call is the 20-item infinite-scroll append. Defaults to the frozen
   * fixture page followed by an empty page (so the footer says "end of feed").
   */
  pages?: readonly (readonly ActivityItem[])[]
}

export function createStubActivityApi({
  pages = [ACTIVITY_FIXTURE, []],
}: StubActivityApiOptions = {}): ActivityApi {
  let call = 0
  return {
    loadFeed: () => {
      const page = pages[call] ?? []
      call += 1
      return Promise.resolve(page.map(item => ({ ...item })))
    },
    subscribe: (): ActivitySubscription => ({ unsubscribe: () => undefined }),
  }
}

/* -------------------------------------------------------------------------- */
/* useActivityFeed — initial load + infinite append + prepend (banner)        */
/* -------------------------------------------------------------------------- */

export interface UseActivityFeedOptions {
  api?: ActivityApi
  initialLimit?: number
  pageSize?: number
}

export interface UseActivityFeedResult {
  items: ActivityItem[]
  isLoading: boolean
  loadError: string | null
  hasMore: boolean
  /** Loads the next page and appends it (deduplicated by id). */
  loadMore: () => Promise<void>
  /** Banner click: puts new realtime items at the top of the feed. */
  prependItems: (items: readonly ActivityItem[]) => void
}

export function useActivityFeed({
  api,
  initialLimit = ACTIVITY_FEED_LIMIT,
  pageSize = ACTIVITY_PAGE_SIZE,
}: UseActivityFeedOptions = {}): UseActivityFeedResult {
  const client = useMemo(() => api ?? createStubActivityApi(), [api])
  const [items, setItems] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const knownIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      loadingRef.current = true
      setIsLoading(true)
      try {
        const loaded = await client.loadFeed(initialLimit)
        if (cancelled) return
        knownIdsRef.current = new Set(loaded.map(item => item.id))
        setItems(loaded)
        setLoadError(null)
      } catch {
        if (cancelled) return
        setItems([])
        setLoadError(ACTIVITY_COPY.loadError)
      } finally {
        if (!cancelled) setIsLoading(false)
        loadingRef.current = false
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [client, initialLimit])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setIsLoading(true)
    try {
      const more = await client.loadFeed(pageSize)
      // The API is page-based without an offset in this wave; a page that brings
      // no NEW ids means the feed is exhausted. This also stops a mocked/static
      // source from making the sentinel loop forever on "Loading more...".
      const fresh = more.filter(item => !knownIdsRef.current.has(item.id))
      if (fresh.length === 0) {
        setHasMore(false)
        return
      }
      for (const item of fresh) knownIdsRef.current.add(item.id)
      // The frozen store appended blindly and could duplicate rows; de-dupe by id
      // while keeping the frozen newest-first order.
      setItems(previous => mergeUnique(previous, fresh))
    } catch {
      setHasMore(false)
      setLoadError(ACTIVITY_COPY.loadError)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }, [client, hasMore, pageSize])

  const prependItems = useCallback((newItems: readonly ActivityItem[]) => {
    for (const item of newItems) knownIdsRef.current.add(item.id)
    setItems(previous => mergeUnique(newItems, previous))
  }, [])

  return { items, isLoading, loadError, hasMore, loadMore, prependItems }
}

/* -------------------------------------------------------------------------- */
/* useActivityRealtime — injected postgres_changes INSERT channel             */
/* -------------------------------------------------------------------------- */

export interface UseActivityRealtimeOptions {
  api: ActivityApi
  /** Called once per inserted activity row (the banner accumulates them). */
  onInsert: (item: ActivityItem) => void
  /** Injectable sandbox predicate; defaults to the frozen `window.__E2E__` flag. */
  isSandbox?: () => boolean
}

/**
 * Frozen `useActivityRealtime` port: subscribes to `activity_log` INSERTs and
 * unsubscribes on unmount. The frozen hook created the channel directly from the
 * Supabase client; here the channel factory is injected through `api.subscribe`,
 * so the feature has no Supabase import and tests can drive inserts synchronously.
 */
export function useActivityRealtime({
  api,
  onInsert,
  isSandbox = isE2ESandbox,
}: UseActivityRealtimeOptions): void {
  useEffect(() => {
    if (isSandbox()) return
    const subscription = api.subscribe(onInsert)
    return () => subscription.unsubscribe()
  }, [api, isSandbox, onInsert])
}
