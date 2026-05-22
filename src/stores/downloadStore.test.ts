import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDownloadStore } from './downloadStore'

// Mock toast utility from uiStore
const mockAddToast = vi.fn()
vi.mock('./uiStore', () => {
  return {
    useUIStore: {
      getState: () => ({
        addToast: mockAddToast,
      }),
    },
  }
})

describe('useDownloadStore Zustand store', () => {
  beforeEach(() => {
    // Reset state before each test
    useDownloadStore.getState().clearQueue()
    useDownloadStore.getState().setPanelOpen(false)
    useDownloadStore.getState().setDownloading(false)
    useDownloadStore.getState().setProgress(0)
    useDownloadStore.getState().setProgressStatus('')
    vi.clearAllMocks()
  })

  it('initializes with an empty queue and correct defaults', () => {
    const state = useDownloadStore.getState()
    expect(state.queue).toEqual([])
    expect(state.isPanelOpen).toBe(false)
    expect(state.isDownloading).toBe(false)
    expect(state.progress).toBe(0)
    expect(state.progressStatus).toBe('')
  })

  it('adds items to the queue correctly', () => {
    const photo = {
      id: 'photo-1',
      url: 'https://example.com/1.jpg',
      thumbnail: 'https://example.com/1-thumb.jpg',
      caption: 'Test Photo 1',
    }

    const success = useDownloadStore.getState().addToQueue(photo)
    expect(success).toBe(true)
    expect(useDownloadStore.getState().queue).toEqual([photo])
  })

  it('prevents adding duplicate items to the queue', () => {
    const photo = {
      id: 'photo-1',
      url: 'https://example.com/1.jpg',
      thumbnail: 'https://example.com/1-thumb.jpg',
      caption: 'Test Photo 1',
    }

    const firstSuccess = useDownloadStore.getState().addToQueue(photo)
    const secondSuccess = useDownloadStore.getState().addToQueue(photo)

    expect(firstSuccess).toBe(true)
    expect(secondSuccess).toBe(false)
    expect(useDownloadStore.getState().queue).toHaveLength(1)
  })

  it('enforces a hard cap of 50 items and triggers a toast warning', () => {
    const store = useDownloadStore.getState()

    // Add 50 items
    for (let i = 1; i <= 50; i++) {
      store.addToQueue({
        id: `photo-${i}`,
        url: `https://example.com/${i}.jpg`,
        thumbnail: `https://example.com/${i}-thumb.jpg`,
      })
    }

    expect(useDownloadStore.getState().queue).toHaveLength(50)

    // Attempt to add 51st item
    const success = store.addToQueue({
      id: 'photo-51',
      url: 'https://example.com/51.jpg',
      thumbnail: 'https://example.com/51-thumb.jpg',
    })

    expect(success).toBe(false)
    expect(useDownloadStore.getState().queue).toHaveLength(50)

    // Verify UI store toast was triggered
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        title: 'Limit Exceeded',
      })
    )
  })

  it('removes items from the queue correctly', () => {
    const store = useDownloadStore.getState()
    const p1 = { id: 'p1', url: '1.jpg', thumbnail: '1t.jpg' }
    const p2 = { id: 'p2', url: '2.jpg', thumbnail: '2t.jpg' }

    store.addToQueue(p1)
    store.addToQueue(p2)

    store.removeFromQueue('p1')
    expect(useDownloadStore.getState().queue).toEqual([p2])
  })

  it('toggles and controls panels and status values', () => {
    const store = useDownloadStore.getState()

    store.setPanelOpen(true)
    expect(useDownloadStore.getState().isPanelOpen).toBe(true)

    store.togglePanel()
    expect(useDownloadStore.getState().isPanelOpen).toBe(false)

    store.setDownloading(true)
    expect(useDownloadStore.getState().isDownloading).toBe(true)

    store.setProgress(45)
    expect(useDownloadStore.getState().progress).toBe(45)

    store.setProgressStatus('Downloading...')
    expect(useDownloadStore.getState().progressStatus).toBe('Downloading...')
  })
})
