import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  ANALYTICS_FIXTURES,
  ANALYTICS_WINDOW_LABELS,
  ANALYTICS_WINDOWS,
  emptyAnalyticsCounts,
} from './analytics-data'
import { useAnalytics } from './useAnalytics'

describe('analytics data + hook edge paths', () => {
  it('exposes the three windows and their frozen labels', () => {
    expect(ANALYTICS_WINDOWS).toEqual(['7d', '30d', '90d'])
    expect(ANALYTICS_WINDOW_LABELS).toEqual({
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
    })
    expect(emptyAnalyticsCounts()).toEqual({
      approvedUploads: 0,
      pendingUploads: 0,
      guestbookEntries: 0,
      publishedPhotos: 0,
      guestPhotos: 0,
      professionalPhotos: 0,
    })
  })

  it('returns the fixture counts per window through the injected seam', async () => {
    const fetchCounts = vi.fn(ANALYTICS_FIXTURES.fetchCounts)
    const data = { fetchCounts }
    const { result } = renderHook(() => useAnalytics({ data }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchCounts).toHaveBeenCalledWith('30d')
    expect(result.current.counts.approvedUploads).toBe(12)

    act(() => result.current.changeWindow('7d'))
    await waitFor(() => expect(fetchCounts).toHaveBeenLastCalledWith('7d'))
    await waitFor(() => expect(result.current.counts.approvedUploads).toBe(2))
  })

  it('falls back to zeroed counts and the frozen error copy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useAnalytics({ data: { fetchCounts: () => Promise.reject(new Error('offline')) } })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load analytics')
    expect(result.current.counts).toEqual(emptyAnalyticsCounts())
  })
})
