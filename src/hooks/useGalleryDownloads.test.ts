import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/utils/download', () => ({
  downloadFile: vi.fn(),
  downloadBatch: vi.fn(),
}))

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../stores/downloadStore', () => {
  const mockStore = {
    queue: [],
    setDownloading: vi.fn(),
    setProgress: vi.fn(),
    setProgressStatus: vi.fn(),
    setPanelOpen: vi.fn(),
    clearQueue: vi.fn(),
  }
  const useDownloadStore: unknown = vi.fn((selector: (s: typeof mockStore) => unknown) =>
    selector(mockStore)
  )
  ;(useDownloadStore as { getState?: () => typeof mockStore }).getState = () => mockStore
  return { useDownloadStore }
})

import { useGalleryDownloads } from './useGalleryDownloads'

describe('useGalleryDownloads', () => {
  it('initializes with null downloadingId and false isDownloadingPack', () => {
    const { result } = renderHook(() =>
      useGalleryDownloads({ photos: [], selectedPhotoIds: new Set() })
    )
    expect(result.current.downloadingId).toBe(null)
    expect(result.current.isDownloadingPack).toBe(false)
    expect(typeof result.current.handleDownload).toBe('function')
    expect(typeof result.current.handleDownloadPack).toBe('function')
    expect(typeof result.current.handleShareSelection).toBe('function')
  })
})
