import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHomeContent } from './useHomeContent'

describe('useHomeContent (TODO Wave 3 boundary)', () => {
  it('returns the deterministic empty state until the data layer is wired', () => {
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
