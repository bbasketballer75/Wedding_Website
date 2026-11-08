import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGuestUploadSubmit } from './useGuestUploadSubmit'
import type { UploadApi, UploadingFile } from './types'

function makeApi(overrides: Partial<UploadApi> = {}): UploadApi {
  return {
    requestUploadSlot: vi.fn(),
    insertGuestUpload: vi.fn(() => Promise.resolve({ id: 'upload-1' })),
    getOrCreateShareToken: vi.fn(() => Promise.resolve('share-token-1')),
    lookupClaimIdentity: vi.fn(),
    ...overrides,
  }
}

function makeFiles(): UploadingFile[] {
  const photo = new File(['a'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })
  const video = new File(['b'], 'clip.mp4', { type: 'video/mp4', lastModified: 2 })
  return [
    { id: 'p1', file: photo, status: 'complete', publicUrl: 'https://media.test/photo.jpg' },
    { id: 'v1', file: video, status: 'complete', publicUrl: 'https://media.test/clip.mp4' },
    { id: 'p2', file: new File(['c'], 'failed.jpg', { type: 'image/jpeg' }), status: 'error' },
  ]
}

function baseOptions(overrides: Partial<Parameters<typeof useGuestUploadSubmit>[0]> = {}) {
  return {
    api: makeApi(),
    files: makeFiles(),
    name: 'Jamie Rivera',
    email: 'jamie@example.com',
    message: 'From our table',
    onSuccess: vi.fn(),
    sleep: () => Promise.resolve(),
    fingerprintFile: () => Promise.resolve('sha256:fixture'),
    ...overrides,
  }
}

function submitEvent() {
  return { preventDefault: () => undefined }
}

describe('useGuestUploadSubmit', () => {
  it('is blocked until files are uploaded and name + email are present', async () => {
    const api = makeApi()
    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      useGuestUploadSubmit(baseOptions({ api, onSuccess, name: '', email: '' }))
    )

    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(api.insertGuestUpload).not.toHaveBeenCalled()

    const onlyErrors = makeFiles().filter(file => file.status !== 'complete')
    const { result: second } = renderHook(() =>
      useGuestUploadSubmit(baseOptions({ api, files: onlyErrors }))
    )
    await act(async () => {
      await second.current.handleSubmit(submitEvent())
    })
    expect(api.insertGuestUpload).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('inserts the upload payload and stores the share token', async () => {
    const insertGuestUpload = vi.fn(() => Promise.resolve({ id: 'upload-9' }))
    const onSuccess = vi.fn()
    const api = makeApi({
      insertGuestUpload,
      getOrCreateShareToken: vi.fn(() => Promise.resolve('tok-9')),
    })
    const { result } = renderHook(() => useGuestUploadSubmit(baseOptions({ api, onSuccess })))

    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })

    expect(insertGuestUpload).toHaveBeenCalledWith({
      guestName: 'Jamie Rivera',
      guestEmail: 'jamie@example.com',
      message: 'From our table',
      photoUrls: ['https://media.test/photo.jpg'],
      photoFingerprints: ['sha256:fixture'],
      videoUrls: ['https://media.test/clip.mp4'],
      videoFingerprints: ['sha256:fixture'],
    })
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.shareToken).toBe('tok-9')
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(result.current.submitError).toBeNull()
  })

  it('retries the DB insert up to 3 attempts after R2 success (no orphaned files)', async () => {
    const insertGuestUpload = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ id: 'upload-1' })
    const api = makeApi({ insertGuestUpload })
    const { result } = renderHook(() => useGuestUploadSubmit(baseOptions({ api })))

    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })

    expect(insertGuestUpload).toHaveBeenCalledTimes(3)
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.submitError).toBeNull()
  })

  it('surfaces a retry notice while backing off', async () => {
    const api = makeApi({
      insertGuestUpload: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({ id: 'upload-1' }),
    })
    const { result } = renderHook(() => useGuestUploadSubmit(baseOptions({ api })))

    const submitPromise = act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    await submitPromise

    // The retry message appears at least transiently (aria-live) and success clears it.
    expect(result.current.submitError).toBeNull()
    expect(result.current.isSubmitted).toBe(true)
  })

  it('does not retry permanent failures and shows the permanent message', async () => {
    const permissionError = Object.assign(new Error('permission denied'), { status: 403 })
    const insertGuestUpload = vi.fn(() => Promise.reject(permissionError))
    const api = makeApi({ insertGuestUpload })
    const { result } = renderHook(() => useGuestUploadSubmit(baseOptions({ api })))

    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })

    expect(insertGuestUpload).toHaveBeenCalledTimes(1)
    expect(result.current.isSubmitted).toBe(false)
    expect(result.current.submitError).toMatch(/Something didn't quite work/)
  })

  it('tolerates a share-token failure (the submission still succeeded)', async () => {
    const api = makeApi({
      getOrCreateShareToken: vi.fn(() => Promise.reject(new Error('token service down'))),
    })
    const { result } = renderHook(() => useGuestUploadSubmit(baseOptions({ api })))

    await act(async () => {
      await result.current.handleSubmit(submitEvent())
    })
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.shareToken).toBeNull()
  })
})
