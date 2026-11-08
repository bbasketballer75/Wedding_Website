import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createStubUploadApi } from './data'
import { putFileToR2 } from './uploadTransport'
import { isUploadError, resolveUploadErrorMessage, UPLOAD_ERRORS } from './uploadErrors'
import { describeSubmitLabel, describeUploadSummary, formatMediaCount } from './uploadText'
import { withRetry, isTransientError } from './retry'
import {
  buildFileFingerprint,
  clearUploadQueue,
  getFileFingerprint,
  loadUploadQueue,
  removeStoredUploadByFingerprint,
  saveUploadQueue,
  UPLOAD_QUEUE_KEY,
} from './uploadQueueStorage'
import type { UploadStorage } from './types'

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
  size = 1024,
  lastModified = 123456,
  body = 'data',
}: {
  name?: string
  type?: string
  size?: number
  lastModified?: number
  body?: string
} = {}): File {
  const file = new File([body], name, { type, lastModified })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('upload text helpers', () => {
  it('formats media counts with the frozen singular/plural rules', () => {
    expect(formatMediaCount(1, 'photo')).toBe('1 photo')
    expect(formatMediaCount(0, 'photo')).toBe('0 photos')
    expect(formatMediaCount(2, 'video')).toBe('2 videos')
  })

  it('describes upload summaries and the submit label', () => {
    expect(describeUploadSummary(0, 0)).toBe('your upload')
    expect(describeUploadSummary(1, 0)).toBe('1 photo')
    expect(describeUploadSummary(0, 2)).toBe('2 videos')
    expect(describeUploadSummary(3, 1)).toBe('3 photos and 1 video')
    expect(describeSubmitLabel(0, 0)).toBe('Choose your files first')
    expect(describeSubmitLabel(2, 1)).toBe('Submit 2 photos and 1 video')
  })
})

describe('upload error taxonomy', () => {
  it('keeps the per-cause messages distinct', () => {
    expect(resolveUploadErrorMessage(UPLOAD_ERRORS.NETWORK_TIMEOUT)).toMatch(/Connection timed out/)
    expect(resolveUploadErrorMessage(UPLOAD_ERRORS.FILE_TOO_LARGE)).toMatch(/500MB limit/)
    expect(resolveUploadErrorMessage(UPLOAD_ERRORS.UPLOAD_SLOT_UNAVAILABLE)).toMatch(
      /Upload slot unavailable/
    )
    expect(resolveUploadErrorMessage(UPLOAD_ERRORS.R2_PUT_FAILURE)).toMatch(
      /didn't make it through/
    )
    expect(resolveUploadErrorMessage(new Error('boom'))).toMatch(/Something went wrong/)
    expect(resolveUploadErrorMessage(new DOMException('aborted', 'AbortError'))).toMatch(
      /Connection timed out/
    )
  })

  it('recognises the typed error strings', () => {
    expect(isUploadError(UPLOAD_ERRORS.R2_PUT_FAILURE)).toBe(true)
    expect(isUploadError(new Error('nope'))).toBe(false)
    expect(isUploadError('random-string')).toBe(false)
  })
})

describe('fingerprints + queue persistence', () => {
  it('builds the cheap fingerprint and a sha256 content fingerprint', async () => {
    const file = makeFile({ name: 'ring.jpg', size: 42, lastModified: 7 })
    expect(getFileFingerprint(file)).toBe('ring.jpg:42:7')
    const fingerprint = await buildFileFingerprint(file)
    expect(fingerprint.startsWith('sha256:') || fingerprint.startsWith('fallback:')).toBe(true)
  })

  it('persists non-complete files and restores them', () => {
    const storage = memoryStorage()
    saveUploadQueue(
      [
        {
          id: 'a',
          file: makeFile({ name: 'a.jpg' }),
          status: 'error',
          errorMessage: 'boom',
          preview: 'data:image/png;base64,xx',
        },
        {
          id: 'b',
          file: makeFile({ name: 'done.jpg' }),
          status: 'complete',
          publicUrl: 'https://media.test/done.jpg',
        },
      ],
      storage,
      1234
    )

    const stored = loadUploadQueue(storage)
    expect(stored).toHaveLength(1)
    expect(stored[0]?.name).toBe('a.jpg')
    expect(stored[0]?.status).toBe('error')
    expect(stored[0]?.preview).toBe('data:image/png;base64,xx')
    expect(stored[0]?.createdAt).toBe(1234)
    expect(storage.getItem(UPLOAD_QUEUE_KEY)).not.toBeNull()
  })

  it('removes one fingerprint, clears all, and tolerates corrupt JSON', () => {
    const storage = memoryStorage()
    saveUploadQueue([{ id: 'a', file: makeFile({ name: 'a.jpg' }), status: 'error' }], storage, 1)
    removeStoredUploadByFingerprint(getFileFingerprint(makeFile({ name: 'a.jpg' })), storage)
    expect(loadUploadQueue(storage)).toEqual([])

    storage.setItem(UPLOAD_QUEUE_KEY, '{not json')
    expect(loadUploadQueue(storage)).toEqual([])

    saveUploadQueue([{ id: 'b', file: makeFile({ name: 'b.jpg' }), status: 'error' }], storage, 1)
    clearUploadQueue(storage)
    expect(storage.getItem(UPLOAD_QUEUE_KEY)).toBeNull()
  })
})

describe('retry helper', () => {
  it('retries transient errors up to the attempt limit with injected backoff', async () => {
    const sleep = vi.fn(() => Promise.resolve())
    const onRetry = vi.fn()
    let calls = 0
    const result = await withRetry(
      () => {
        calls += 1
        if (calls < 3) return Promise.reject(new TypeError('fetch failed'))
        return Promise.resolve('ok')
      },
      { attempts: 3, baseDelayMs: 500, sleep, onRetry }
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 500)
    expect(sleep).toHaveBeenNthCalledWith(2, 1000)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('does not retry permanent (4xx / validation) errors', async () => {
    const sleep = vi.fn(() => Promise.resolve())
    const permissionError = Object.assign(new Error('permission denied'), { status: 403 })
    expect(isTransientError(permissionError)).toBe(false)
    await expect(
      withRetry(() => Promise.reject(permissionError), { attempts: 3, sleep })
    ).rejects.toThrow('permission denied')
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries 5xx server errors', () => {
    expect(isTransientError(Object.assign(new Error('server'), { status: 503 }))).toBe(true)
  })
})

describe('putFileToR2 (presign -> XHR PUT)', () => {
  class FakeXhr {
    progressListener:
      ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null = null
    listeners = new Map<string, () => void>()
    status = 200
    timeout = 0
    open = vi.fn()
    setRequestHeader = vi.fn()
    send = vi.fn()
    upload = {
      addEventListener: (
        _event: string,
        listener: (event: { lengthComputable: boolean; loaded: number; total: number }) => void
      ) => {
        this.progressListener = listener
      },
    }
    addEventListener(event: string, listener: () => void) {
      this.listeners.set(event, listener)
    }
    emit(event: string) {
      this.listeners.get(event)?.()
    }
    emitProgress(loaded: number, total: number) {
      this.progressListener?.({ lengthComputable: true, loaded, total })
    }
  }

  it('reports progress and resolves the public URL', async () => {
    const api = createStubUploadApi()
    const xhr = new FakeXhr()
    const progress: number[] = []
    const promise = putFileToR2({
      api,
      file: makeFile(),
      onProgress: value => progress.push(value),
      createXhr: () => xhr as unknown as XMLHttpRequest,
    })

    await waitFor(() => expect(xhr.send).toHaveBeenCalled())
    xhr.emitProgress(50, 100)
    xhr.emitProgress(100, 100)
    xhr.emit('load')

    await expect(promise).resolves.toContain('https://media.theporadas.test/guest-uploads/1.')
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://r2.example.test/guest-uploads/slot-1')
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg')
    expect(progress).toEqual([50, 100])
  })

  it('maps transport failures onto the distinct error types', async () => {
    const api = createStubUploadApi()
    const slotFailureApi = {
      ...api,
      requestUploadSlot: vi.fn(() => Promise.reject(new Error('down'))),
    }
    await expect(
      putFileToR2({
        api: slotFailureApi,
        file: makeFile(),
        createXhr: () => new FakeXhr() as unknown as XMLHttpRequest,
      })
    ).rejects.toMatchObject({ type: UPLOAD_ERRORS.UPLOAD_SLOT_UNAVAILABLE })

    const xhr = new FakeXhr()
    xhr.status = 403
    const promise = putFileToR2({
      api,
      file: makeFile(),
      createXhr: () => xhr as unknown as XMLHttpRequest,
    })
    await waitFor(() => expect(xhr.send).toHaveBeenCalled())
    xhr.emit('load')
    await expect(promise).rejects.toMatchObject({ type: UPLOAD_ERRORS.R2_PUT_FAILURE })

    const errorXhr = new FakeXhr()
    const errorPromise = putFileToR2({
      api,
      file: makeFile(),
      createXhr: () => errorXhr as unknown as XMLHttpRequest,
    })
    await waitFor(() => expect(errorXhr.send).toHaveBeenCalled())
    errorXhr.emit('error')
    await expect(errorPromise).rejects.toMatchObject({ type: UPLOAD_ERRORS.NETWORK_TIMEOUT })
  })
})

describe('stub upload API', () => {
  it('returns deterministic slots, insert ids, share tokens and claim identity lookups', async () => {
    const api = createStubUploadApi()
    const slot = await api.requestUploadSlot({ contentType: 'image/jpeg', contentLength: 10 })
    expect(slot).toEqual({
      uploadUrl: 'https://r2.example.test/guest-uploads/slot-1',
      publicUrl: 'https://media.theporadas.test/guest-uploads/1.jpeg',
    })
    expect(
      await api.insertGuestUpload({
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        message: null,
        photoUrls: [],
        photoFingerprints: [],
        videoUrls: [],
        videoFingerprints: [],
      })
    ).toEqual({ id: 'stub-guest-upload-1' })
    expect(await api.getOrCreateShareToken('Jamie@Example.com')).toBe('token-jamie-example-com-1')

    expect(await api.lookupClaimIdentity('jamie@example.com')).toEqual({
      found: true,
      guestName: 'Jamie Rivera',
      uploadCount: 3,
      claimablePhotoCount: 3,
    })
    expect((await api.lookupClaimIdentity('not-an-email')).found).toBe(false)
  })
})
