import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  fetchPhotoEngagementSummary: vi.fn(),
  fetchPhotoLikeStatuses: vi.fn(),
  fetchPhotoComments: vi.fn(),
  addPhotoComment: vi.fn(),
  togglePhotoLike: vi.fn(),
  Photo: class {},
}))

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/components/gallery/constants', () => ({
  getPhotoEngagementSessionId: () => 'test-session',
  curatedPhotos: [
    {
      id: 'p1',
      url: '/a.jpg',
      thumbnail: '/a.jpg',
      source: 'professional',
      collection: 'Proposal',
      aspectRatio: 1,
    },
  ],
}))

vi.mock('@/components/gallery/data', () => ({
  mapSupabasePhoto: (p: never) => p,
  normalizeGalleryPhoto: (p: never) => p,
}))

// Import after mocks so they take effect
import { useGalleryData } from './useGalleryData'

describe('useGalleryData', () => {
  it('initializes with curated photos and Proposal tab', () => {
    const initialPhotos = [
      {
        id: 'curated-1',
        url: '/a.jpg',
        thumbnail: '/a.jpg',
        source: 'professional',
        collection: 'Proposal',
        aspectRatio: 1,
      } as never,
    ]
    const { result } = renderHook(() => useGalleryData('Proposal', initialPhotos, initialPhotos))
    expect(result.current.photos.length).toBe(1)
    expect(result.current.collection).toBe('Proposal')
    // isLoading is true initially then false after fetch resolves.
    // Both are valid initial states. We don't assert on it here.
  })

  it('switches collections', () => {
    const { result } = renderHook(() => useGalleryData())
    act(() => {
      result.current.setCollection('Wedding Photos')
    })
    expect(result.current.collection).toBe('Wedding Photos')
  })
})
