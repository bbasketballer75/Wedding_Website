import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GUEST_PHOTOS_COPY } from './constants'
import {
  computeGuestPhotosStats,
  createStubGuestPhotosApi,
  filterApprovedUploads,
  formatUploadDate,
  selectFeaturedPhotos,
  useGuestPhotosData,
} from './data'
import {
  createGuestPhotosFixture,
  createMixedStatusFixture,
  GUEST_PHOTOS_APPROVED_FIXTURE,
} from './fixtures'
import type { GuestPhotosApi } from './types'

function createApi(overrides: Partial<GuestPhotosApi> = {}): GuestPhotosApi {
  return { ...createStubGuestPhotosApi(), ...overrides }
}

describe('guest-photos pure helpers', () => {
  it('filters to approved uploads only', () => {
    const filtered = filterApprovedUploads(createMixedStatusFixture())
    expect(filtered.map(upload => upload.id)).toEqual(['upload-approved-1', 'upload-approved-2'])
  })

  it('computes the frozen stats (approved uploads + photo count)', () => {
    expect(computeGuestPhotosStats(GUEST_PHOTOS_APPROVED_FIXTURE)).toEqual({
      approvedUploads: 2,
      guestPhotos: 4,
    })
  })

  it('flattens featured photos in upload order and caps at six by default', () => {
    const featured = selectFeaturedPhotos(GUEST_PHOTOS_APPROVED_FIXTURE)
    expect(featured).toHaveLength(4)
    expect(featured[0]).toEqual({
      url: '/images/engagement/PoradaProposal-29.webp',
      guestName: 'Jamie Rivera',
    })

    const wider = [
      {
        ...GUEST_PHOTOS_APPROVED_FIXTURE[0]!,
        photoUrls: Array.from({ length: 5 }, (_, index) => `/images/extra-${index}.webp`),
      },
      {
        ...GUEST_PHOTOS_APPROVED_FIXTURE[1]!,
        photoUrls: ['/images/extra-5.webp', '/images/extra-6.webp'],
      },
    ]
    expect(selectFeaturedPhotos(wider)).toHaveLength(6)
    expect(selectFeaturedPhotos(wider, 3)).toHaveLength(3)
  })

  it('formats upload dates with the frozen en-US short month format', () => {
    expect(formatUploadDate('2025-05-11T10:00:00.000Z')).toBe('May 11, 2025')
  })

  it('stub API resolves the approved fixture', async () => {
    const uploads = await createStubGuestPhotosApi().loadApprovedUploads()
    expect(uploads).toHaveLength(2)
    expect(uploads[0]?.guestName).toBe('Jamie Rivera')
  })
})

describe('useGuestPhotosData', () => {
  it('loads the fixture, filters unapproved rows and derives stats/featured photos', async () => {
    const api = createApi({
      loadApprovedUploads: () => Promise.resolve(createMixedStatusFixture()),
    })
    const { result } = renderHook(() => useGuestPhotosData({ api }))

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.uploads).toHaveLength(2)
    expect(result.current.stats).toEqual({ approvedUploads: 2, guestPhotos: 4 })
    expect(result.current.featuredPhotos).toHaveLength(4)
    expect(result.current.error).toBeNull()
  })

  it('surfaces the frozen error copy and recovers on reload', async () => {
    const loadApprovedUploads = vi
      .fn<GuestPhotosApi['loadApprovedUploads']>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(createGuestPhotosFixture())
    const api = createApi({ loadApprovedUploads })
    const { result } = renderHook(() => useGuestPhotosData({ api }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe(GUEST_PHOTOS_COPY.errorBody)
    expect(result.current.uploads).toHaveLength(0)

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.uploads).toHaveLength(2))
    expect(result.current.error).toBeNull()
  })
})
