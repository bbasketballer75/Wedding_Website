import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  countAlbumStats,
  createStubGuestShareApi,
  dedupePhotos,
  normalizeAlbum,
  resolveDefaultTab,
  STUB_VALID_TOKEN,
  useGuestShareAlbum,
} from './data'
import {
  createDuplicatePhotoAlbum,
  createGuestShareAlbumFixture,
  createNotesOnlyAlbum,
  createPhotosOnlyAlbum,
} from './fixtures'
import type { GuestShareApi } from './types'

function createApi(overrides: Partial<GuestShareApi> = {}): GuestShareApi {
  return { ...createStubGuestShareApi(), ...overrides }
}

describe('guest-share pure helpers', () => {
  it('dedupes photos by id, keeping the first occurrence and order', () => {
    const album = createDuplicatePhotoAlbum()
    expect(album.photos).toHaveLength(7)

    const deduped = dedupePhotos(album.photos)
    expect(deduped).toHaveLength(6)
    expect(deduped[0]?.caption).toBe('First look on the lawn')
    expect(deduped.map(photo => photo.id)).toEqual([
      'photo-1',
      'photo-2',
      'photo-3',
      'photo-4',
      'photo-5',
      'photo-6',
    ])
  })

  it('normalizes an album (dedupe photos, preserve note order)', () => {
    const normalized = normalizeAlbum(createDuplicatePhotoAlbum())
    expect(normalized.photos).toHaveLength(6)
    expect(normalized.notes.map(note => note.name)).toEqual([
      'Sarah Mitchell',
      'Mike Chen',
      'Aunt Patricia',
    ])
  })

  it('counts album stats', () => {
    expect(countAlbumStats(createGuestShareAlbumFixture())).toEqual({
      photoCount: 6,
      noteCount: 3,
    })
  })

  it('auto-switches to the guestbook tab only when notes exist without photos', () => {
    expect(resolveDefaultTab(createGuestShareAlbumFixture())).toBe('photos')
    expect(resolveDefaultTab(createPhotosOnlyAlbum())).toBe('photos')
    expect(resolveDefaultTab(createNotesOnlyAlbum())).toBe('guestbook')
  })

  it('stub API resolves the valid token fixture and returns null for any other token', async () => {
    const api = createStubGuestShareApi()
    await expect(api.loadAlbum(STUB_VALID_TOKEN)).resolves.toMatchObject({
      guestName: 'Jane Miller',
    })
    await expect(api.loadAlbum('invalid-token')).resolves.toBeNull()
  })
})

describe('useGuestShareAlbum', () => {
  it('loads a valid album, dedupes photos and derives stats', async () => {
    const api = createApi({ loadAlbum: () => Promise.resolve(createDuplicatePhotoAlbum()) })
    const { result } = renderHook(() => useGuestShareAlbum({ api, token: STUB_VALID_TOKEN }))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.guestName).toBe('Jane Miller')
    expect(result.current.photos).toHaveLength(6)
    expect(result.current.notes).toHaveLength(3)
    expect(result.current.photoCount).toBe(6)
    expect(result.current.noteCount).toBe(3)
    expect(result.current.activeTab).toBe('photos')
  })

  it('maps a null result to the invalid state (and a missing token is invalid)', async () => {
    const invalid = renderHook(() =>
      useGuestShareAlbum({ api: createApi(), token: 'invalid-token' })
    )
    await waitFor(() => expect(invalid.result.current.status).toBe('invalid'))
    expect(invalid.result.current.errorKind).toBe('invalid')
    expect(invalid.result.current.album).toBeNull()

    const missing = renderHook(() => useGuestShareAlbum({ token: undefined }))
    await waitFor(() => expect(missing.result.current.status).toBe('invalid'))
    expect(missing.result.current.errorKind).toBe('invalid')
  })

  it('maps a rejected promise to the network state and recovers on retry', async () => {
    const loadAlbum = vi
      .fn<GuestShareApi['loadAlbum']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createGuestShareAlbumFixture())
    const api = createApi({ loadAlbum })

    const { result } = renderHook(() => useGuestShareAlbum({ api, token: STUB_VALID_TOKEN }))

    await waitFor(() => expect(result.current.status).toBe('network'))
    expect(result.current.errorKind).toBe('network')

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.photos).toHaveLength(6)
  })

  it('auto-activates the guestbook tab when the album has notes but no photos', async () => {
    const api = createApi({ loadAlbum: () => Promise.resolve(createNotesOnlyAlbum()) })
    const { result } = renderHook(() => useGuestShareAlbum({ api, token: STUB_VALID_TOKEN }))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.activeTab).toBe('guestbook')
    expect(result.current.photoCount).toBe(0)
    expect(result.current.noteCount).toBe(3)

    act(() => result.current.setActiveTab('photos'))
    expect(result.current.activeTab).toBe('photos')
  })
})
