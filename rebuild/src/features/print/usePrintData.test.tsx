import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuestbookPrintEntry } from '@/shared/data/guestbook'
import type { Photo, PhotoAlbum } from '@/shared/data/photos'
import { usePrintAlbums } from './usePrintAlbums'
import { usePrintGuestbook } from './usePrintGuestbook'

/**
 * Hook-level tests for the `/print` data seams.
 *
 * These cover the paths the page tests cannot reach cleanly: loader failures
 * (empty-safe fallback), concurrent-load dedupe, loader-identity changes and the
 * clamped max-photos setter. `console.error` is spied because the hooks report
 * recoverable read failures there.
 */

function makePhoto(id: string): Photo {
  return {
    id,
    url: `/images/${id}.webp`,
    thumbnail: `/images/${id}.webp`,
    caption: null,
  } as unknown as Photo
}

const ENTRIES: readonly GuestbookPrintEntry[] = [
  { id: 'note-1', name: 'A Guest', createdAt: '2025-05-11T00:00:00Z', content: 'Lovely day.' },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePrintAlbums', () => {
  it('pre-loads Wedding Day and exposes the included album state', async () => {
    const photos = [makePhoto('wedding-1'), makePhoto('wedding-2')]
    const loadAlbumPhotos = vi.fn((album: PhotoAlbum) =>
      Promise.resolve(album === 'Wedding Day' ? photos : [])
    )

    const { result } = renderHook(() => usePrintAlbums({ loadAlbumPhotos }))

    await waitFor(() => expect(result.current.totalPhotoCount).toBe(2))

    expect(loadAlbumPhotos).toHaveBeenCalledTimes(1)
    expect(loadAlbumPhotos).toHaveBeenCalledWith('Wedding Day')
    expect(result.current.includedAlbums.map(state => state.album)).toEqual(['Wedding Day'])
    expect(result.current.albumStates).toHaveLength(4)
  })

  it('falls back to an empty album when the loader rejects', async () => {
    const error = new Error('offline')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const loadAlbumPhotos = vi.fn(() => Promise.reject(error))

    const { result } = renderHook(() => usePrintAlbums({ loadAlbumPhotos }))

    await waitFor(() => {
      const weddingDay = result.current.albumStates.find(state => state.album === 'Wedding Day')
      expect(weddingDay?.loading).toBe(false)
    })

    expect(result.current.totalPhotoCount).toBe(0)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('dedupes a concurrent load for the same album', async () => {
    let release: ((photos: readonly Photo[]) => void) | undefined
    const pending = new Promise<readonly Photo[]>(resolve => {
      release = resolve
    })
    const loadAlbumPhotos = vi.fn((album: PhotoAlbum): Promise<readonly Photo[]> => {
      if (album === 'Wedding Day') return Promise.resolve([] as readonly Photo[])
      return pending
    })

    const { result } = renderHook(() => usePrintAlbums({ loadAlbumPhotos }))
    await waitFor(() => expect(loadAlbumPhotos).toHaveBeenCalledTimes(1))

    let first: Promise<readonly Photo[]> | undefined
    let second: Promise<readonly Photo[]> | undefined
    await act(async () => {
      first = result.current.loadAlbumPhotos('Engagement')
      second = result.current.loadAlbumPhotos('Engagement')
      release?.([makePhoto('engagement-1')])
      await Promise.all([first, second])
    })

    expect(loadAlbumPhotos).toHaveBeenCalledTimes(2)
    expect(loadAlbumPhotos).toHaveBeenLastCalledWith('Engagement')
  })

  it('does not re-read when a caller passes a fresh loader object', async () => {
    const firstLoader = vi.fn(() => Promise.resolve([] as readonly Photo[]))
    const secondLoader = vi.fn(() => Promise.resolve([] as readonly Photo[]))

    const { rerender } = renderHook(
      ({
        loadAlbumPhotos,
      }: {
        loadAlbumPhotos: (album: PhotoAlbum) => Promise<readonly Photo[]>
      }) => usePrintAlbums({ loadAlbumPhotos }),
      { initialProps: { loadAlbumPhotos: firstLoader } }
    )
    await waitFor(() => expect(firstLoader).toHaveBeenCalledTimes(1))

    rerender({ loadAlbumPhotos: secondLoader })

    expect(secondLoader).not.toHaveBeenCalled()
    expect(firstLoader).toHaveBeenCalledTimes(1)
  })

  it('clamps the max-photos setter to the frozen numeric bounds', () => {
    const loadAlbumPhotos = vi.fn(() => Promise.resolve([] as readonly Photo[]))
    const { result } = renderHook(() => usePrintAlbums({ loadAlbumPhotos }))

    expect(result.current.maxPhotosPerAlbum).toBe(40)

    act(() => result.current.setMaxPhotosPerAlbum(9_000))
    expect(result.current.maxPhotosPerAlbum).toBe(500)

    act(() => result.current.setMaxPhotosPerAlbum(-3))
    expect(result.current.maxPhotosPerAlbum).toBe(1)

    act(() => result.current.setMaxPhotosPerAlbum(Number.NaN))
    expect(result.current.maxPhotosPerAlbum).toBe(1)

    act(() => result.current.setMaxPhotosPerAlbum(12.9))
    expect(result.current.maxPhotosPerAlbum).toBe(12)
  })
})

describe('usePrintGuestbook', () => {
  it('loads chronologically and starts included', async () => {
    const loadGuestbook = vi.fn(() => Promise.resolve(ENTRIES))
    const { result } = renderHook(() => usePrintGuestbook({ loadGuestbook }))

    expect(result.current.loading).toBe(true)
    expect(result.current.includeGuestbook).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual(ENTRIES)
    expect(loadGuestbook).toHaveBeenCalledTimes(1)
  })

  it('toggles inclusion and falls back to an empty keepsake on failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const loadGuestbook = vi.fn(() => Promise.reject(new Error('offline')))
    const { result } = renderHook(() => usePrintGuestbook({ loadGuestbook }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual([])

    act(() => result.current.toggleGuestbook())
    expect(result.current.includeGuestbook).toBe(false)

    act(() => result.current.setIncludeGuestbook(true))
    expect(result.current.includeGuestbook).toBe(true)
  })
})
