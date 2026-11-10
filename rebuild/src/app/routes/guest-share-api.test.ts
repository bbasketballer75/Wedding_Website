import { describe, expect, it } from 'vitest'
import { createMockClient } from '@/shared/data/test-support/mock-client'
import {
  createGuestShareApi,
  guestShareApi,
  loadGuestShareAlbum,
  mapSharedNote,
  mapSharedPhoto,
  mergeSharedPhotos,
} from './guest-share-api'
import type { Photo } from '@/shared/data/photos'
import type { GuestbookMessage } from '@/shared/data/guestbook'

function photoRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'photo-a',
    url: '/images/guest/a.webp',
    thumbnail: '/images/guest/a-thumb.webp',
    caption: 'A caption',
    album: null,
    category: null,
    location: null,
    date: null,
    likes: 4,
    faces: null,
    tags: [],
    is_professional: null,
    album_sort_order: 0,
    download_url: null,
    created_at: '2025-05-12T18:00:00.000Z',
    ...overrides,
  }
}

function uploadRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'upload-1',
    guest_name: 'Jamie Rivera',
    guest_email: 'jamie@example.com',
    message: null,
    photo_urls: ['/images/guest/a.webp'],
    video_urls: [],
    status: 'approved',
    created_at: '2025-05-12T18:00:00.000Z',
    video_visibility: 'archive_only',
    memory_trail: null,
    editorial_title: null,
    editorial_summary: null,
    featured_rank: null,
    photo_fingerprints: [],
    video_fingerprints: [],
    rejection_reason: null,
    ...overrides,
  }
}

function guestbookRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'message-1',
    name: 'Sarah Mitchell',
    content: 'A beautiful evening',
    created_at: '2025-05-12T19:30:00.000Z',
    reactions: {},
    media_url: null,
    comments: [],
    ...overrides,
  }
}

function fullAlbumClient() {
  return createMockClient({
    tables: {
      guest_share_tokens: { data: { guest_email: 'jamie@example.com' } },
      guest_uploads: {
        data: [uploadRow(), uploadRow({ id: 'upload-2', photo_urls: ['/images/guest/b.webp'] })],
      },
      photos: {
        data: [
          photoRow(),
          photoRow({
            id: 'photo-b',
            url: '/images/guest/b.webp',
            thumbnail: '/images/guest/b-thumb.webp',
            caption: 'B caption',
            likes: 9,
          }),
        ],
      },
      guestbook_messages: { data: [guestbookRow()] },
      guest_identities: {
        data: {
          id: 'identity-1',
          display_name: 'Jane Miller',
          photo_claims: [
            // Duplicate of an uploaded photo: dedupe must drop it.
            { status: 'approved', photos: photoRow() },
            {
              status: 'approved',
              photos: photoRow({
                id: 'photo-c',
                url: '/images/guest/c.webp',
                thumbnail: '/images/guest/c-thumb.webp',
                caption: 'Claimed photo',
                likes: 2,
              }),
            },
            { status: 'pending', photos: photoRow({ id: 'photo-pending' }) },
          ],
        },
      },
    },
  })
}

describe('mapSharedPhoto / mapSharedNote', () => {
  it('maps the normalised Photo to the feature photo view model', () => {
    const mapped = mapSharedPhoto({
      ...photoRow(),
      url: '/a.webp',
      thumbnail: '',
      caption: null,
    } as unknown as Photo)
    expect(mapped).toEqual({
      id: 'photo-a',
      url: '/a.webp',
      thumbnail: '/a.webp',
      caption: null,
      likes: 4,
    })
  })

  it('maps guestbook rows to the frozen note card model', () => {
    const message = {
      id: 'm-1',
      name: 'Sarah',
      content: 'Lovely',
      createdAt: '2025-05-12T19:30:00.000Z',
    } as GuestbookMessage
    expect(mapSharedNote(message)).toEqual({
      id: 'm-1',
      name: 'Sarah',
      content: 'Lovely',
      createdAt: '2025-05-12T19:30:00.000Z',
    })
  })
})

describe('mergeSharedPhotos', () => {
  it('merges uploads first, appends claimed photos and dedupes by id', () => {
    const merged = mergeSharedPhotos(
      [photoRow() as unknown as Photo],
      [
        photoRow() as unknown as Photo,
        photoRow({ id: 'photo-c', url: '/c.webp' }) as unknown as Photo,
      ]
    )
    expect(merged.map(photo => photo.id)).toEqual(['photo-a', 'photo-c'])
  })
})

describe('loadGuestShareAlbum', () => {
  it('returns null for an unknown token (invalid link state)', async () => {
    const { client } = createMockClient({ tables: { guest_share_tokens: { data: null } } })
    await expect(loadGuestShareAlbum('missing-token', client)).resolves.toBeNull()
  })

  it('rejects on a transport error (network state)', async () => {
    const { client } = createMockClient({
      tables: { guest_share_tokens: { error: new Error('boom') } },
    })
    await expect(loadGuestShareAlbum('some-token', client)).rejects.toBeTruthy()
  })

  it('builds the frozen album: guest name, upload-then-claimed photos, notes', async () => {
    const { client, calls } = fullAlbumClient()
    const album = await loadGuestShareAlbum('valid-token', client)

    expect(album?.guestName).toBe('Jane Miller')
    expect(album?.photos).toEqual([
      {
        id: 'photo-a',
        url: '/images/guest/a.webp',
        thumbnail: '/images/guest/a-thumb.webp',
        caption: 'A caption',
        likes: 4,
      },
      {
        id: 'photo-b',
        url: '/images/guest/b.webp',
        thumbnail: '/images/guest/b-thumb.webp',
        caption: 'B caption',
        likes: 9,
      },
      {
        id: 'photo-c',
        url: '/images/guest/c.webp',
        thumbnail: '/images/guest/c-thumb.webp',
        caption: 'Claimed photo',
        likes: 2,
      },
    ])
    expect(album?.notes).toEqual([
      {
        id: 'message-1',
        name: 'Sarah Mitchell',
        content: 'A beautiful evening',
        createdAt: '2025-05-12T19:30:00.000Z',
      },
    ])

    // Frozen read path: token lookup, approved uploads by email, guestbook by
    // email, and a photo-row hydration for the upload urls.
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'eq',
      args: ['status', 'approved'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guestbook_messages',
      method: 'eq',
      args: ['email', 'jamie@example.com'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'in',
      args: ['url', ['/images/guest/a.webp', '/images/guest/b.webp']],
    })
  })

  it('falls back to the first guestbook name, then first upload name, then Special Guest', async () => {
    const guestbookFallback = createMockClient({
      tables: {
        guest_share_tokens: { data: { guest_email: 'guest@example.com' } },
        guest_uploads: { data: [] },
        guest_identities: { data: null },
        guestbook_messages: { data: [guestbookRow()] },
      },
    })
    expect((await loadGuestShareAlbum('t', guestbookFallback.client))?.guestName).toBe(
      'Sarah Mitchell'
    )

    const uploadFallback = createMockClient({
      tables: {
        guest_share_tokens: { data: { guest_email: 'guest@example.com' } },
        guest_uploads: { data: [uploadRow()] },
        guest_identities: { data: null },
        guestbook_messages: { data: [] },
      },
    })
    expect((await loadGuestShareAlbum('t', uploadFallback.client))?.guestName).toBe('Jamie Rivera')

    const empty = createMockClient({
      tables: {
        guest_share_tokens: { data: { guest_email: 'guest@example.com' } },
        guest_uploads: { data: [] },
        guest_identities: { data: null },
        guestbook_messages: { data: [] },
      },
    })
    expect((await loadGuestShareAlbum('t', empty.client))?.guestName).toBe('Special Guest')
  })

  it('does not query photo rows when no upload has photo urls', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_share_tokens: { data: { guest_email: 'notes-only@example.com' } },
        guest_uploads: { data: [uploadRow({ photo_urls: [] })] },
        guest_identities: { data: null },
        guestbook_messages: { data: [guestbookRow()] },
      },
    })
    const album = await loadGuestShareAlbum('t', client)
    expect(album?.photos).toEqual([])
    expect(calls.some(call => call.target === 'photos')).toBe(false)
  })
})

describe('createGuestShareApi', () => {
  it('exposes the typed loadAlbum seam over the frozen load path', async () => {
    const { client } = fullAlbumClient()
    const api = createGuestShareApi(client)
    const album = await api.loadAlbum('valid-token')
    expect(album?.guestName).toBe('Jane Miller')
    expect(album?.photos).toHaveLength(3)
  })

  it('exposes the default router-facing adapter', () => {
    expect(typeof guestShareApi.loadAlbum).toBe('function')
  })
})
