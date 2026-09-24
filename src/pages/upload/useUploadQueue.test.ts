import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUploadQueue } from './useUploadQueue'
import { loadUploadQueue, saveUploadQueue, clearUploadQueue } from './uploadQueueStorage'

// Mock the pure-storage module so tests don't touch localStorage directly
vi.mock('./uploadQueueStorage', async importOriginal => {
  const actual = await importOriginal<typeof import('./uploadQueueStorage')>()
  return {
    ...actual,
    loadUploadQueue: vi.fn(() => []),
    saveUploadQueue: vi.fn(),
    clearUploadQueue: vi.fn(),
    removeStoredUploadByFingerprint: vi.fn(),
  }
})

vi.mock('@/utils/imageCompressor', () => ({
  compressImage: vi.fn(async (f: File) => f),
}))

function makeFile(name: string, type = 'image/jpeg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1700000000000 })
}

describe('useUploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with an empty queue and no notice', () => {
    const { result } = renderHook(() => useUploadQueue())
    expect(result.current.files).toEqual([])
    expect(result.current.queueNotice).toBeNull()
    expect(result.current.totalFiles).toBe(0)
    expect(result.current.completedFiles).toBe(0)
  })

  it('addFiles skips non-image/video files and sets a notice', () => {
    const { result } = renderHook(() => useUploadQueue())
    const badFile = makeFile('notes.txt', 'text/plain')

    act(() => {
      result.current.addFiles([badFile])
    })

    expect(result.current.files).toHaveLength(0)
    expect(result.current.queueNotice).toMatch(/only photos and videos/i)
  })

  it('addFiles skips duplicates already in the queue and sets a notice', () => {
    const { result } = renderHook(() => useUploadQueue())
    const file = makeFile('photo.jpg')

    act(() => {
      result.current.addFiles([file])
    })
    // Add the exact same file again — should be deduped
    act(() => {
      result.current.addFiles([file])
    })

    // The first add uploads (uploadFileToR2 fires fetch); the second is skipped
    expect(result.current.queueNotice).toMatch(/already in the queue/i)
  })

  it('addFiles skips files over the 500MB limit', () => {
    const { result } = renderHook(() => useUploadQueue())
    const bigFile = makeFile('huge.mp4', 'video/mp4', 501 * 1024 * 1024)

    act(() => {
      result.current.addFiles([bigFile])
    })

    expect(result.current.files).toHaveLength(0)
    expect(result.current.queueNotice).toMatch(/500MB limit/i)
  })

  it('removeFile removes a file from the queue by id', () => {
    const { result } = renderHook(() => useUploadQueue())
    const file = makeFile('photo.jpg')

    act(() => {
      result.current.addFiles([file])
    })
    const added = result.current.files[0]
    expect(added).toBeDefined()

    act(() => {
      result.current.removeFile(added.id)
    })
    expect(result.current.files.find(f => f.id === added.id)).toBeUndefined()
  })

  it('clearQueue delegates to clearUploadQueue', () => {
    const { result } = renderHook(() => useUploadQueue())
    act(() => {
      result.current.clearQueue()
    })
    expect(clearUploadQueue).toHaveBeenCalled()
  })

  it('clearQueueNotice resets the notice to null', () => {
    const { result } = renderHook(() => useUploadQueue())
    act(() => {
      result.current.addFiles([makeFile('notes.txt', 'text/plain')])
    })
    expect(result.current.queueNotice).not.toBeNull()

    act(() => {
      result.current.clearQueueNotice()
    })
    expect(result.current.queueNotice).toBeNull()
  })

  it('persists the queue via saveUploadQueue when files are added', async () => {
    vi.mocked(loadUploadQueue).mockReturnValue([])
    // Prevent actual upload network call by mocking fetch to hang the upload
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useUploadQueue())
    act(() => {
      result.current.addFiles([makeFile('photo.jpg')])
    })

    // saveUploadQueue is called by the persist effect when files.length > 0
    expect(saveUploadQueue).toHaveBeenCalled()
  })
})
