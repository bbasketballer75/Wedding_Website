import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUploadQueue } from './useUploadQueue'
import { UPLOAD_ERRORS } from './uploadErrors'
import { UPLOAD_QUEUE_KEY } from './uploadQueueStorage'
import type { UploadApi, UploadStorage } from './types'

function memoryStorage(): UploadStorage {
  const store = new Map<string, string>()
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: key => {
      store.delete(key)
    },
  }
}

function makeFile({
  name = 'photo.jpg',
  type = 'image/jpeg',
  size = 2048,
  lastModified = 111,
}: { name?: string; type?: string; size?: number; lastModified?: number } = {}): File {
  const file = new File(['data'], name, { type, lastModified })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function makeApi(overrides: Partial<UploadApi> = {}): UploadApi {
  return {
    requestUploadSlot: vi.fn(() =>
      Promise.resolve({
        uploadUrl: 'https://r2.example.test/put',
        publicUrl: 'https://media.test/photo.jpg',
      })
    ),
    insertGuestUpload: vi.fn(() => Promise.resolve({ id: 'upload-1' })),
    getOrCreateShareToken: vi.fn(() => Promise.resolve('token-1')),
    lookupClaimIdentity: vi.fn(() =>
      Promise.resolve({
        found: false,
        guestName: null,
        uploadCount: 0,
        claimablePhotoCount: 0,
      })
    ),
    ...overrides,
  }
}

function baseDeps(overrides: Partial<Parameters<typeof useUploadQueue>[0]> = {}) {
  return {
    api: makeApi(),
    storage: memoryStorage(),
    compressImage: (file: File) => Promise.resolve(file),
    createPreview: () => undefined,
    putFile: vi.fn(() => Promise.resolve('https://media.test/photo.jpg')),
    now: () => 1_000,
    ...overrides,
  }
}

describe('useUploadQueue', () => {
  it('adds a file, uploads it and marks it complete', async () => {
    const putFile = vi.fn((_file: File, onProgress: (progress: number) => void) => {
      onProgress(45)
      onProgress(100)
      return Promise.resolve('https://media.test/photo.jpg')
    })
    const { result } = renderHook(() => useUploadQueue(baseDeps({ putFile })))

    act(() => {
      result.current.addFiles([makeFile()])
    })

    await waitFor(() => expect(result.current.files[0]?.status).toBe('complete'))
    expect(result.current.completedFiles).toBe(1)
    expect(result.current.completedPhotoCount).toBe(1)
    expect(result.current.completedVideoCount).toBe(0)
    expect(result.current.selectedPhotoCount).toBe(1)
    expect(result.current.aggregateProgress).toBe(100)
    expect(result.current.isUploadingAny).toBe(false)
    expect(result.current.files[0]?.publicUrl).toBe('https://media.test/photo.jpg')
  })

  it('skips files over the 500MB cap with a distinct notice', () => {
    const { result } = renderHook(() => useUploadQueue(baseDeps()))

    act(() => {
      result.current.addFiles([
        makeFile({ name: 'huge.mp4', type: 'video/mp4', size: 500 * 1024 * 1024 + 1 }),
      ])
    })
    expect(result.current.files).toHaveLength(0)
    expect(result.current.queueNotice).toMatch(/huge\.mp4 is over the 500MB limit/)
  })

  it('skips unsupported non-media files', () => {
    const { result } = renderHook(() => useUploadQueue(baseDeps()))
    act(() => {
      result.current.addFiles([makeFile({ name: 'notes.pdf', type: 'application/pdf' })])
    })
    expect(result.current.files).toHaveLength(0)
    expect(result.current.queueNotice).toMatch(/only photos and videos/)
  })

  it('dedupes duplicate fingerprints within and across additions', async () => {
    const putFile = vi.fn(() => Promise.resolve('https://media.test/photo.jpg'))
    const { result } = renderHook(() => useUploadQueue(baseDeps({ putFile })))

    act(() => {
      result.current.addFiles([makeFile(), makeFile()])
    })
    await waitFor(() => expect(result.current.files).toHaveLength(1))
    expect(result.current.queueNotice).toMatch(/duplicate was skipped/)

    act(() => {
      result.current.addFiles([makeFile()])
    })
    expect(result.current.files).toHaveLength(1)
    expect(putFile).toHaveBeenCalledTimes(1)
  })

  it('announces resume from a previous session and restores the stored preview', () => {
    const storage = memoryStorage()
    const file = makeFile({ name: 'resume.jpg', size: 5000, lastModified: 42 })
    storage.setItem(
      UPLOAD_QUEUE_KEY,
      JSON.stringify([
        {
          id: 'stored-1',
          name: 'resume.jpg',
          type: 'image/jpeg',
          size: 5000,
          fingerprint: 'resume.jpg:5000:42',
          preview: 'data:image/png;base64,RESUMED',
          status: 'error',
          createdAt: 1,
        },
      ])
    )

    const { result } = renderHook(() => useUploadQueue(baseDeps({ storage })))
    expect(result.current.storedUploads).toHaveLength(1)

    act(() => {
      result.current.addFiles([file])
    })
    expect(result.current.queueNotice).toMatch(/resumed from a previous session/)
    expect(result.current.files[0]?.preview).toBe('data:image/png;base64,RESUMED')
  })

  it('surfaces the distinct slot / R2 / timeout messages and retries', async () => {
    const putFile = vi
      .fn()
      .mockRejectedValueOnce(UPLOAD_ERRORS.UPLOAD_SLOT_UNAVAILABLE)
      .mockRejectedValueOnce(UPLOAD_ERRORS.R2_PUT_FAILURE)
      .mockRejectedValueOnce(UPLOAD_ERRORS.NETWORK_TIMEOUT)
      .mockResolvedValue('https://media.test/ok.jpg')
    const { result } = renderHook(() => useUploadQueue(baseDeps({ putFile })))

    act(() => {
      result.current.addFiles([makeFile()])
    })
    await waitFor(() => expect(result.current.files[0]?.status).toBe('error'))
    expect(result.current.files[0]?.errorMessage).toMatch(/Upload slot unavailable/)

    act(() => result.current.retryUpload(result.current.files[0]?.id ?? ''))
    await waitFor(() =>
      expect(result.current.files[0]?.errorMessage).toMatch(/didn't make it through/)
    )

    act(() => result.current.retryUpload(result.current.files[0]?.id ?? ''))
    await waitFor(() =>
      expect(result.current.files[0]?.errorMessage).toMatch(/Connection timed out/)
    )
    expect(result.current.hasErrors).toBe(true)

    act(() => result.current.retryUpload(result.current.files[0]?.id ?? ''))
    await waitFor(() => expect(result.current.files[0]?.status).toBe('complete'))
    expect(result.current.hasErrors).toBe(false)
  })

  it('persists the in-flight queue and clears it once every file is complete', async () => {
    const storage = memoryStorage()
    let resolveUpload: ((url: string) => void) | null = null
    const putFile = vi.fn(
      () =>
        new Promise<string>(resolve => {
          resolveUpload = resolve
        })
    )
    const { result } = renderHook(() => useUploadQueue(baseDeps({ storage, putFile })))

    act(() => {
      result.current.addFiles([makeFile()])
    })
    await waitFor(() => expect(storage.getItem(UPLOAD_QUEUE_KEY)).not.toBeNull())
    const persisted = JSON.parse(storage.getItem(UPLOAD_QUEUE_KEY) ?? '[]') as Array<{
      status: string
    }>
    expect(persisted[0]?.status).toBe('paused')

    await act(async () => {
      resolveUpload?.('https://media.test/done.jpg')
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.files[0]?.status).toBe('complete'))
    await waitFor(() => expect(storage.getItem(UPLOAD_QUEUE_KEY)).toBe('[]'))
  })

  it('removes files, clears the queue and can clear only persisted metadata', async () => {
    const storage = memoryStorage()
    const putFile = vi.fn(() => Promise.resolve('https://media.test/photo.jpg'))
    const { result } = renderHook(() => useUploadQueue(baseDeps({ storage, putFile })))

    act(() => {
      result.current.addFiles([makeFile({ name: 'a.jpg' }), makeFile({ name: 'b.jpg' })])
    })
    await waitFor(() => expect(result.current.files).toHaveLength(2))

    act(() => result.current.removeFile(result.current.files[0]?.id ?? ''))
    expect(result.current.files).toHaveLength(1)

    act(() => result.current.clearPersistedQueue())
    expect(result.current.files).toHaveLength(1)

    act(() => result.current.clearQueue())
    expect(result.current.files).toHaveLength(0)
    expect(result.current.storedUploads).toHaveLength(0)
  })

  it('accepts drop and picker inputs and toggles the drag state', async () => {
    const putFile = vi.fn(() => Promise.resolve('https://media.test/photo.jpg'))
    const { result } = renderHook(() => useUploadQueue(baseDeps({ putFile })))

    act(() => result.current.handleDragOver({ preventDefault: () => undefined }))
    expect(result.current.isDragging).toBe(true)
    act(() => result.current.handleDragLeave({ preventDefault: () => undefined }))
    expect(result.current.isDragging).toBe(false)

    act(() =>
      result.current.handleDrop({
        preventDefault: () => undefined,
        dataTransfer: { files: [makeFile({ name: 'drop.jpg' })] as unknown },
      })
    )
    await waitFor(() => expect(result.current.files).toHaveLength(1))

    act(() =>
      result.current.handleFileSelect({
        target: { files: [makeFile({ name: 'pick.jpg' })] as unknown, value: 'C:\\fakepath' },
      })
    )
    await waitFor(() => expect(result.current.files).toHaveLength(2))
  })
})
