import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FilmGuestClip } from './filmGuestClips'
import { useFilmGuestClips, type FilmGuestClipsLoader } from './useFilmGuestClips'

function clip(overrides: Partial<FilmGuestClip> = {}): FilmGuestClip {
  return {
    id: 'upload-1-0',
    uploadId: 'upload-1',
    guestName: 'Jamie Rivera',
    title: 'Right after the toasts',
    description: 'Our table, right after the toasts.',
    videoUrl: 'https://cdn.example.com/clip-1.mp4',
    createdAt: '2025-05-11T10:00:00.000Z',
    badge: 'From your phones',
    trail: 'Ceremony',
    ...overrides,
  }
}

function deferredLoader(): {
  loadClips: FilmGuestClipsLoader
  resolve: (clips: readonly FilmGuestClip[]) => void
  reject: (error: Error) => void
} {
  let resolveFn: (clips: readonly FilmGuestClip[]) => void = () => undefined
  let rejectFn: (error: Error) => void = () => undefined
  const promise = new Promise<readonly FilmGuestClip[]>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })
  return { loadClips: () => promise, resolve: resolveFn, reject: rejectFn }
}

describe('useFilmGuestClips', () => {
  it('starts loading, then exposes the injected loader rows', async () => {
    const loadClips = vi.fn(() => Promise.resolve([clip()]))

    const { result } = renderHook(() => useFilmGuestClips(loadClips))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.clips).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.clips).toEqual([clip()])
    expect(loadClips).toHaveBeenCalledTimes(1)
  })

  it('settles to an empty (self-hidden) state when the loader returns no rows', async () => {
    const { result } = renderHook(() => useFilmGuestClips(() => Promise.resolve([])))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.clips).toEqual([])
  })

  it('never breaks the film page when the data read fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useFilmGuestClips(() => Promise.reject(new Error('data layer offline')))
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.clips).toEqual([])
    consoleError.mockRestore()
  })

  it('does not update state after unmount (data resolves late)', async () => {
    const deferred = deferredLoader()
    const { result, unmount } = renderHook(() => useFilmGuestClips(deferred.loadClips))

    unmount()
    deferred.resolve([clip()])

    // Flush the microtask queue; a late setState would warn/fail here.
    await Promise.resolve()
    expect(result.current.clips).toEqual([])
  })
})
