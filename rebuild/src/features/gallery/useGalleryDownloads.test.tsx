import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGalleryDownloads } from './useGalleryDownloads'
import type { QueuedPhoto } from './data'

function makeQueue(count: number): QueuedPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    url: `/images/engagement/PoradaProposal-${index + 1}.webp`,
    thumbnail: `/images/engagement/PoradaProposal-${index + 1}.webp`,
    caption: `Photo ${index + 1}`,
    downloadUrl: `/images/engagement/PoradaProposal-${index + 1}.webp`,
    collection: 'Proposal',
  }))
}

describe('useGalleryDownloads', () => {
  it('plans a client zip for <=20 photos and drives progress to completion', async () => {
    const addToast = vi.fn()
    const { result } = renderHook(() => useGalleryDownloads({ queue: makeQueue(20), addToast }))

    let plan = null
    await act(async () => {
      plan = await result.current.handleDownloadPack()
    })

    expect(plan).toEqual({ strategy: 'client-zip', count: 20, endpoint: null })
    expect(result.current.batchPlan?.strategy).toBe('client-zip')
    expect(result.current.isDownloadingPack).toBe(false)
    expect(addToast).not.toHaveBeenCalled()
    expect(result.current.progress).toBe(100)
    expect(result.current.progressStatus).toContain('later wave')
  })

  it('plans the server download-pack path for 21-50 photos', async () => {
    const addToast = vi.fn()
    const { result } = renderHook(() => useGalleryDownloads({ queue: makeQueue(21), addToast }))

    let plan = null
    await act(async () => {
      plan = await result.current.handleDownloadPack()
    })

    expect(plan).toEqual({
      strategy: 'server-pack',
      count: 21,
      endpoint: '/.netlify/functions/download-pack',
    })
  })

  it('rejects an empty queue with a warning toast', async () => {
    const addToast = vi.fn()
    const { result } = renderHook(() => useGalleryDownloads({ queue: [], addToast }))

    let plan = null
    await act(async () => {
      plan = await result.current.handleDownloadPack()
    })

    expect(plan).toEqual({ strategy: 'none', count: 0, endpoint: null })
    expect(addToast).toHaveBeenCalledWith('Select between 1 and 50 photos to download.', 'warning')
  })

  it('builds the frozen share URL and copies it to the clipboard', () => {
    const addToast = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { result } = renderHook(() =>
      useGalleryDownloads({
        queue: makeQueue(2),
        origin: 'https://www.theporadas.com',
        addToast,
      })
    )

    let url: string | null = null
    act(() => {
      url = result.current.handleShareSelection()
    })

    expect(url).toBe('https://www.theporadas.com/gallery?share=photo-1,photo-2')
    expect(writeText).toHaveBeenCalledWith(
      'https://www.theporadas.com/gallery?share=photo-1,photo-2'
    )
    expect(addToast).toHaveBeenCalledWith('Share link copied to clipboard', 'success')
  })

  it('returns null and does not copy when nothing is selected', () => {
    const addToast = vi.fn()
    const { result } = renderHook(() =>
      useGalleryDownloads({ queue: [], origin: 'https://example.test', addToast })
    )
    expect(result.current.handleShareSelection()).toBeNull()
    expect(addToast).not.toHaveBeenCalled()
  })

  it('tracks single-photo download state', async () => {
    const { result } = renderHook(() =>
      useGalleryDownloads({ queue: makeQueue(1), addToast: vi.fn() })
    )
    expect(result.current.downloadingId).toBeNull()
    await act(async () => {
      await result.current.handleDownload('photo-1')
    })
    expect(result.current.downloadingId).toBeNull()
  })
})
