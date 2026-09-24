import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGallerySearchFilters } from './useGallerySearchFilters'
import type { GalleryPhoto } from '@/components/gallery/constants'

const basePhoto = (overrides: Partial<GalleryPhoto> = {}): GalleryPhoto =>
  ({
    id: 'p1',
    url: '/p1.jpg',
    thumbnail: '/p1.jpg',
    aspectRatio: 1,
    source: 'professional',
    collection: 'Proposal',
    tags: [],
    faces: [],
    ...overrides,
  }) as GalleryPhoto

describe('useGallerySearchFilters', () => {
  it('initializes with empty search', () => {
    const { result } = renderHook(() =>
      useGallerySearchFilters({ photos: [], selectedCollection: 'Proposal' })
    )
    expect(result.current.searchQuery).toBe('')
    expect(result.current.hasActiveFilters).toBe(false)
  })

  it('exposes albumOrderedPhotos sorted by albumSortOrder', () => {
    const photos = [
      basePhoto({ id: 'a', albumSortOrder: 3 }),
      basePhoto({ id: 'b', albumSortOrder: 1 }),
      basePhoto({ id: 'c', albumSortOrder: 2 }),
    ]
    const { result } = renderHook(() =>
      useGallerySearchFilters({ photos, selectedCollection: 'Proposal' })
    )
    expect(result.current.albumOrderedPhotos.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('collectionScopedPhotos filters by selectedCollection', () => {
    const photos = [
      basePhoto({ id: 'a', collection: 'Proposal' }),
      basePhoto({ id: 'b', collection: 'Bach+ette' }),
      basePhoto({ id: 'c', collection: 'Proposal' }),
    ]
    const { result } = renderHook(() =>
      useGallerySearchFilters({ photos, selectedCollection: 'Bach+ette' })
    )
    expect(result.current.collectionScopedPhotos.map(p => p.id)).toEqual(['b'])
  })

  it('setSearchQuery narrows filteredPhotos by caption text', () => {
    const photos = [
      basePhoto({ id: 'a', caption: 'The walk into the surprise' }),
      basePhoto({ id: 'b', caption: 'A quiet pause' }),
    ]
    const { result } = renderHook(() =>
      useGallerySearchFilters({ photos, selectedCollection: 'Proposal' })
    )
    act(() => result.current.setSearchQuery('quiet'))
    expect(result.current.filteredPhotos.map(p => p.id)).toEqual(['b'])
    expect(result.current.hasActiveFilters).toBe(true)
  })

  it('clearAllFilters resets the search filter', () => {
    const { result } = renderHook(() =>
      useGallerySearchFilters({ photos: [], selectedCollection: 'Proposal' })
    )
    act(() => result.current.setSearchQuery('hi'))
    act(() => result.current.clearAllFilters())
    expect(result.current.searchQuery).toBe('')
    expect(result.current.hasActiveFilters).toBe(false)
  })
})
