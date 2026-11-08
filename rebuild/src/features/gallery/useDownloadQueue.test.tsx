import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDownloadQueue } from './data'
import { MAX_SELECTION } from './constants'
import type { GalleryPhoto } from './data'

function makePhotos(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    url: `/images/engagement/PoradaProposal-${index + 1}.webp`,
    thumbnail: `/images/engagement/PoradaProposal-${index + 1}.webp`,
    caption: `Photo ${index + 1}`,
    likes: index,
    aspectRatio: 1,
    faces: [],
    tags: [],
    source: 'professional',
    collection: 'Proposal',
    albumSortOrder: index + 1,
  }))
}

describe('useDownloadQueue (selection queue)', () => {
  it('adds, ignores duplicates, toggles and removes', () => {
    const photos = makePhotos(3)
    const { result } = renderHook(() => useDownloadQueue())

    act(() => {
      expect(result.current.add(photos[0] as GalleryPhoto)).toBe(true)
    })
    expect(result.current.count).toBe(1)
    expect(result.current.selectedIds.has('photo-1')).toBe(true)

    act(() => {
      expect(result.current.add(photos[0] as GalleryPhoto)).toBe(false)
    })
    expect(result.current.count).toBe(1)

    act(() => result.current.toggle(photos[1] as GalleryPhoto))
    expect(result.current.count).toBe(2)

    act(() => result.current.toggle(photos[1] as GalleryPhoto))
    expect(result.current.count).toBe(1)

    act(() => result.current.remove('photo-1'))
    expect(result.current.count).toBe(0)
    expect(result.current.queue).toEqual([])
  })

  it('enforces the 50-photo cap via add()', () => {
    const photos = makePhotos(MAX_SELECTION + 5)
    const { result } = renderHook(() => useDownloadQueue())

    for (const photo of photos) {
      act(() => {
        result.current.add(photo)
      })
    }

    expect(result.current.count).toBe(MAX_SELECTION)
    expect(result.current.isFull).toBe(true)
    act(() => {
      expect(result.current.add(photos[MAX_SELECTION] as GalleryPhoto)).toBe(false)
    })
    expect(result.current.count).toBe(MAX_SELECTION)
  })

  it('selectAll stops at the cap and reports how many were added', () => {
    const photos = makePhotos(MAX_SELECTION + 10)
    const { result } = renderHook(() => useDownloadQueue())

    let added = 0
    act(() => {
      added = result.current.selectAll(photos)
    })
    expect(added).toBe(MAX_SELECTION)
    expect(result.current.count).toBe(MAX_SELECTION)

    act(() => {
      added = result.current.selectAll(photos)
    })
    expect(added).toBe(0)
    expect(result.current.count).toBe(MAX_SELECTION)
  })

  it('selectAll skips duplicates and clears with clear()', () => {
    const photos = makePhotos(3)
    const { result } = renderHook(() => useDownloadQueue())

    act(() => {
      result.current.add(photos[0] as GalleryPhoto)
    })
    act(() => {
      expect(result.current.selectAll(photos)).toBe(2)
    })
    expect(result.current.count).toBe(3)

    act(() => result.current.clear())
    expect(result.current.count).toBe(0)
    expect(result.current.isFull).toBe(false)
  })

  it('seeds from an initial 50-capped queue (?share= contract)', () => {
    const photos = makePhotos(MAX_SELECTION + 5)
    const initial = photos.slice(0, MAX_SELECTION + 5).map(photo => ({
      id: photo.id,
      url: photo.url,
      thumbnail: photo.thumbnail,
      caption: photo.caption,
      downloadUrl: photo.url,
      collection: photo.collection,
    }))
    const { result } = renderHook(() => useDownloadQueue(initial))
    expect(result.current.count).toBe(MAX_SELECTION)
  })
})
