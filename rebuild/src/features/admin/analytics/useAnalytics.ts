import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ANALYTICS_WINDOWS,
  analyticsData,
  emptyAnalyticsCounts,
  type AnalyticsCounts,
  type AnalyticsData,
  type AnalyticsWindow,
} from './analytics-data'

/**
 * Windowed DB-count state for `/admin/analytics`.
 *
 * Frozen behaviour (`src/pages/admin/Analytics.tsx`): one read per selected
 * window, a spinner while loading, and no traffic analytics (GA4/Sentry stay
 * outside the app). The loader is injected; the default binding performs the
 * six frozen count queries.
 */
export interface UseAnalyticsOptions {
  readonly data?: AnalyticsData
}

export interface UseAnalyticsResult {
  window: AnalyticsWindow
  windows: readonly AnalyticsWindow[]
  counts: AnalyticsCounts
  loading: boolean
  error: string | null
  changeWindow: (window: AnalyticsWindow) => void
}

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsResult {
  const data = options.data ?? analyticsData
  const fetchCounts = data.fetchCounts

  const [selectedWindow, setSelectedWindow] = useState<AnalyticsWindow>('30d')
  const [counts, setCounts] = useState<AnalyticsCounts>(emptyAnalyticsCounts)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Guards against out-of-order responses when the window changes quickly.
  const requestIdRef = useRef(0)

  const loadCounts = useCallback(
    async (selectedWindow: AnalyticsWindow): Promise<void> => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      try {
        setLoading(true)
        setError(null)
        const next = await fetchCounts(selectedWindow)
        if (requestId !== requestIdRef.current) return
        setCounts(next)
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return
        console.error('Analytics: could not load the database counts.', loadError)
        setError('Failed to load analytics')
        setCounts(emptyAnalyticsCounts())
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    },
    [fetchCounts]
  )

  // Initial read for the default window; deferred so the effect performs no
  // synchronous state update (frozen page also defers with setTimeout(…, 0)).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCounts('30d')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCounts])

  const changeWindow = useCallback(
    (nextWindow: AnalyticsWindow): void => {
      setSelectedWindow(nextWindow)
      void loadCounts(nextWindow)
    },
    [loadCounts]
  )

  return {
    window: selectedWindow,
    windows: ANALYTICS_WINDOWS,
    counts,
    loading,
    error,
    changeWindow,
  }
}
