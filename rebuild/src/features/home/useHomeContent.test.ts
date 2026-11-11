import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useHomeContent } from './useHomeContent'

const EMPTY_QUERY = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
}

vi.mock('@/shared/data/hooks', () => ({
  useTopPhotos: () => EMPTY_QUERY,
  useGuestbookMessages: () => EMPTY_QUERY,
  useEditorialFeatures: () => EMPTY_QUERY,
}))

describe('useHomeContent (data-layer boundary)', () => {
  it('maps an empty data layer to the frozen empty state', () => {
    const { result } = renderHook(() => useHomeContent())

    expect(result.current).toEqual({
      loading: false,
      error: null,
      guestPhotos: [],
      guestQuotes: [],
      momentOfTheWeek: null,
      standoutUpload: null,
      featuredNote: null,
    })
  })
})
