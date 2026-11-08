import { describe, expect, it } from 'vitest'
import { DataError, isDataError } from './errors'
import {
  GALLERY_PAGE_SIZE,
  PHOTO_ALBUMS,
  fetchAlbumPhotos,
  fetchAllPhotos,
  fetchNextAlbumSortOrder,
  fetchPhotoAlbumCounts,
  fetchPhotoComments,
  fetchPhotoEngagementSummary,
  fetchPhotoLikeStatuses,
  fetchPhotoPage,
  fetchPhotosByUrls,
  fetchPhotosWithFaces,
  fetchRecentPhotoComments,
  fetchTopPhotos,
  fetchWeddingDayPhotos,
  addPhotoComment,
  deleteGalleryPhotos,
  deletePhotoComment,
  hidePhotoComment,
  indexPhotoEngagement,
  isPhotoAlbum,
  mapPhotoRow,
  mapPhotoRows,
  mergePhotos,
  parsePhotoFaces,
  parsePhotoRecord,
  saveAlbumOrganization,
  togglePhotoLike,
  type Photo,
} from './photos'
import type { TableRow } from './schema'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

type PhotoRow = TableRow<'photos'>

const fixtures = loadFixtures()
const photoRows = fixtures.photos as unknown as PhotoRow[]

function makeRow(overrides: Partial<PhotoRow> = {}): PhotoRow {
  return {
    id: 'photo-x',
    url: '/images/x.webp',
    thumbnail: '/images/x.webp',
    caption: null,
    category: null,
    location: null,
    date: null,
    likes: 0,
    photographer: null,
    is_professional: false,
    tags: [],
    faces: [],
    created_at: '2026-01-01T00:00:00.000Z',
    album: null,
    album_sort_order: 0,
    download_url: null,
    ...overrides,
  }
}

describe('photo mapping (contracts/fixtures/photos.json)', () => {
  it('maps every fixture row to a normalised Photo', () => {
    const photos = mapPhotoRows(photoRows)

    expect(photos).toHaveLength(6)
    expect(photos[0]?.id).toBe('photo-1')
    expect(photos[0]?.album).toBe('Engagement')
    expect(photos[1]?.album).toBe('Wedding Day')
    expect(photos[0]?.isProfessional).toBe(true)
    expect(photos[0]?.tags).toEqual(['first look', 'lawn', 'portrait'])
    expect(photos[0]?.faces).toHaveLength(2)
    expect(photos[0]?.faces[0]?.name).toBe('Austin Porada')
    expect(photos[0]?.faces[0]?.box?.width).toBe(18)
    expect(photos[0]?.likes).toBe(24)
    // Missing in the fixture but required by the row type: mapper fills defaults.
    expect(photos[0]?.album_sort_order).toBe(0)
    expect(photos[0]?.date).toBe('2025-05-10T14:00:00.000Z')
  })

  it('only accepts the four product albums', () => {
    expect(PHOTO_ALBUMS).toEqual(['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads'])
    expect(isPhotoAlbum('Bach+ette')).toBe(true)
    expect(isPhotoAlbum('Bach ette')).toBe(false)
    expect(isPhotoAlbum(null)).toBe(false)

    const mapped = mapPhotoRow(makeRow({ album: 'Bach ette' }))
    expect(mapped.album).toBeNull()
  })

  it('parses malformed face JSON defensively', () => {
    expect(parsePhotoFaces(null)).toEqual([])
    expect(parsePhotoFaces([])).toEqual([])
    expect(
      parsePhotoFaces([
        { id: 'f1', name: 'Austin', x: 10, y: 20, box: { left: 1, top: 2, width: 3, height: 4 } },
        { id: 'missing-name' },
        'not-an-object',
        { id: 'f2', name: 'Jordyn', x: 'bad', y: null, box: { width: 5 } },
      ])
    ).toEqual([
      { id: 'f1', name: 'Austin', x: 10, y: 20, box: { left: 1, top: 2, width: 3, height: 4 } },
      { id: 'f2', name: 'Jordyn', x: 0, y: 0, box: { left: 0, top: 0, width: 5, height: 0 } },
    ])
  })

  it('parsePhotoRecord tolerates partial nested photo payloads', () => {
    const photo = parsePhotoRecord({
      id: 'photo-nested',
      url: '/images/nested.webp',
      caption: 'Nested',
      likes: 7,
      tags: ['a', 'b'],
      faces: [{ id: 'f1', name: 'Austin', x: 1, y: 2 }],
    })

    expect(photo?.id).toBe('photo-nested')
    expect(photo?.thumbnail).toBe('/images/nested.webp')
    expect(photo?.likes).toBe(7)
    expect(photo?.faces).toHaveLength(1)
    expect(parsePhotoRecord({ id: 'no-url' })).toBeNull()
    expect(parsePhotoRecord(null)).toBeNull()
  })

  it('mergePhotos dedupes curated vs live by id, url and thumbnail; live fields win', () => {
    const curated = mapPhotoRow(
      makeRow({
        id: 'photo-1',
        url: '/images/shared.webp',
        thumbnail: '/images/thumb.webp',
        likes: 1,
      })
    )
    const liveById = mapPhotoRow(
      makeRow({
        id: 'photo-1',
        url: '/images/live.webp',
        thumbnail: '/images/live-thumb.webp',
        likes: 9,
      })
    )

    const byId = mergePhotos([curated], [liveById])
    expect(byId).toHaveLength(1)
    expect(byId[0]?.id).toBe('photo-1')
    expect(byId[0]?.likes).toBe(9)
    expect(byId[0]?.url).toBe('/images/live.webp')

    const byUrl = mergePhotos(
      [curated],
      [mapPhotoRow(makeRow({ id: 'photo-other', url: '/images/shared.webp' }))]
    )
    expect(byUrl).toHaveLength(1)

    const byThumbnail = mergePhotos(
      [curated],
      [
        mapPhotoRow(
          makeRow({ id: 'photo-third', url: '/images/other.webp', thumbnail: '/images/thumb.webp' })
        ),
      ]
    )
    expect(byThumbnail).toHaveLength(1)

    const unique = mapPhotoRow(makeRow({ id: 'photo-unique' }))
    expect(mergePhotos([curated], [unique])).toHaveLength(2)
  })

  it('indexPhotoEngagement combines like status with comment summary', () => {
    const index = indexPhotoEngagement(
      [
        { photo_key: 'p1', likes_count: 5, liked: true },
        { photo_key: 'p2', likes_count: 0, liked: false },
      ],
      [
        { photo_key: 'p1', likes_count: 99, comments_count: 3, hidden_comments_count: 1 },
        { photo_key: 'p2', likes_count: 4, comments_count: 1, hidden_comments_count: 0 },
      ]
    )

    expect(index.get('p1')).toEqual({ likeCount: 5, liked: true, commentCount: 3 })
    expect(index.get('p2')).toEqual({ likeCount: 0, liked: false, commentCount: 1 })

    const withoutSummary = indexPhotoEngagement(
      [{ photo_key: 'p3', likes_count: 2, liked: false }],
      []
    )
    expect(withoutSummary.get('p3')).toEqual({ likeCount: 2, liked: false, commentCount: 0 })
  })
})

describe('photo reads', () => {
  it('fetchPhotoPage maps one range page', async () => {
    const { client, calls } = createMockClient({ tables: { photos: { data: photoRows } } })

    const photos = await fetchPhotoPage({ page: 2, pageSize: 100 }, client)

    expect(photos).toHaveLength(6)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'range',
      args: [200, 299],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('fetchAllPhotos loops until a short page', async () => {
    const fullPage = Array.from({ length: GALLERY_PAGE_SIZE }, (_, index) =>
      makeRow({ id: `photo-${index}` })
    )
    const { client } = createMockClient({
      tables: { photos: [{ data: fullPage }, { data: [makeRow({ id: 'last' })] }] },
    })

    const photos = await fetchAllPhotos(client)

    expect(photos).toHaveLength(GALLERY_PAGE_SIZE + 1)
    expect(photos[GALLERY_PAGE_SIZE]?.id).toBe('last')
  })

  it('fetchPhotosByUrls short-circuits zero urls and filters by url', async () => {
    const { client, calls } = createMockClient({ tables: { photos: { data: [photoRows[0]] } } })

    expect(await fetchPhotosByUrls([], client)).toEqual([])
    expect(calls).toHaveLength(0)

    const photos = await fetchPhotosByUrls(['/images/engagement/PoradaProposal-29.webp'], client)
    expect(photos).toHaveLength(1)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'in',
      args: ['url', ['/images/engagement/PoradaProposal-29.webp']],
    })
  })

  it('fetchWeddingDayPhotos normalises the narrow select', async () => {
    const partial = {
      id: 'photo-wd',
      url: '/images/wedding-day.webp',
      thumbnail: '/images/wedding-day.webp',
      album: 'Wedding Day',
      caption: 'Vows',
      faces: [],
      created_at: null,
    }
    const { client, calls } = createMockClient({ tables: { photos: { data: [partial] } } })

    const photos = await fetchWeddingDayPhotos(3, client)

    expect(photos).toHaveLength(1)
    expect(photos[0]?.album).toBe('Wedding Day')
    expect(photos[0]?.tags).toEqual([])
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'eq',
      args: ['album', 'Wedding Day'],
    })
    expect(calls).toContainEqual({ surface: 'from', target: 'photos', method: 'limit', args: [3] })
  })

  it('fetchPhotosWithFaces uses the JSON column filters', async () => {
    const { client, calls } = createMockClient({ tables: { photos: { data: [photoRows[0]] } } })

    const photos = await fetchPhotosWithFaces(client)

    expect(photos).toHaveLength(1)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'not',
      args: ['faces', 'is', null],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'neq',
      args: ['faces', '[]'],
    })
  })

  it('fetchTopPhotos orders by likes', async () => {
    const { client, calls } = createMockClient({ tables: { photos: { data: photoRows } } })

    const photos = await fetchTopPhotos(6, client)

    expect(photos).toHaveLength(6)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'order',
      args: ['likes', { ascending: false }],
    })
  })

  it('normalises PostgREST read failures to DataError', async () => {
    const { client } = createMockClient({
      tables: {
        photos: { error: { message: 'permission denied for table photos', code: '42501' } },
      },
    })

    await expect(fetchTopPhotos(3, client)).rejects.toMatchObject({
      name: 'DataError',
      code: 'postgrest:42501',
      message: 'The gallery is taking a moment. Please try again.',
    })
  })
})

describe('photo engagement', () => {
  it('fetchPhotoLikeStatuses passes the session and keys; empty keys skip the RPC', async () => {
    const statuses = [{ photo_key: 'p1', likes_count: 4, liked: true }]
    const { client, calls } = createMockClient({
      rpcs: { get_photo_like_statuses: { data: statuses } },
    })

    expect(await fetchPhotoLikeStatuses([], 'session-1', client)).toEqual([])
    expect(calls).toHaveLength(0)

    const result = await fetchPhotoLikeStatuses(['p1'], 'session-1', client)
    expect(result).toEqual(statuses)
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'get_photo_like_statuses',
      method: 'rpc',
      args: [{ p_photo_keys: ['p1'], p_session_id: 'session-1' }],
    })
  })

  it('fetchPhotoEngagementSummary short-circuits and wraps errors', async () => {
    const empty = createMockClient({})
    expect(await fetchPhotoEngagementSummary([], empty.client)).toEqual([])

    const failing = createMockClient({
      rpcs: { get_photo_engagement_summary_v1: { error: new Error('boom') } },
    })
    await expect(fetchPhotoEngagementSummary(['p1'], failing.client)).rejects.toBeInstanceOf(
      DataError
    )
  })

  it('togglePhotoLike normalises the v2 result columns', async () => {
    const { client } = createMockClient({
      rpcs: {
        toggle_photo_like_v2: {
          data: [{ result_photo_key: 'p1', result_likes_count: 12, result_liked: true }],
        },
      },
    })

    await expect(togglePhotoLike('p1', 'session-1', client)).resolves.toEqual({
      photoKey: 'p1',
      likesCount: 12,
      liked: true,
    })
  })

  it('togglePhotoLike rejects empty RPC payloads with a diagnostic DataError', async () => {
    const { client } = createMockClient({ rpcs: { toggle_photo_like_v2: { data: [] } } })

    try {
      await togglePhotoLike('p1', 'session-1', client)
      throw new Error('expected rejection')
    } catch (error) {
      expect(isDataError(error)).toBe(true)
      if (isDataError(error)) expect(error.code).toBe('rpc:empty-result')
    }
  })
})

describe('photo comments', () => {
  it('reads only visible comments oldest-first', async () => {
    const { client, calls } = createMockClient({ tables: { photo_comments: { data: [] } } })

    await fetchPhotoComments('p1', client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photo_comments',
      method: 'eq',
      args: ['is_hidden', false],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photo_comments',
      method: 'order',
      args: ['created_at', { ascending: true }],
    })
  })

  it('adds, lists, hides and deletes comments through the RPCs', async () => {
    const created = {
      id: 'comment-1',
      photo_key: 'p1',
      author: 'Guest',
      content: 'Lovely',
      created_at: '2026-01-01T00:00:00.000Z',
      is_hidden: false,
    }
    const { client, calls } = createMockClient({
      rpcs: {
        create_photo_comment_v1: { data: [created] },
        get_recent_photo_comments_v1: {
          data: [{ ...created, album: null, caption: null, thumbnail: null, url: null }],
        },
        hide_photo_comment_v1: { data: [{ id: 'comment-1', photo_key: 'p1', is_hidden: true }] },
        delete_photo_comment_v1: { data: [{ deleted_id: 'comment-1', photo_key: 'p1' }] },
      },
    })

    await expect(
      addPhotoComment({ photoKey: 'p1', content: 'Lovely', sessionId: 's1' }, client)
    ).resolves.toEqual(created)
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'create_photo_comment_v1',
      method: 'rpc',
      args: [{ p_photo_key: 'p1', p_author: 'Guest', p_content: 'Lovely', p_session_id: 's1' }],
    })

    await expect(fetchRecentPhotoComments(5, client)).resolves.toHaveLength(1)
    await expect(hidePhotoComment('comment-1', true, 'spam', client)).resolves.toMatchObject({
      is_hidden: true,
    })
    await expect(deletePhotoComment('comment-1', client)).resolves.toMatchObject({
      deleted_id: 'comment-1',
    })
  })

  it('rejects hide/delete empty results', async () => {
    const { client } = createMockClient({
      rpcs: { hide_photo_comment_v1: { data: [] }, delete_photo_comment_v1: { data: [] } },
    })

    await expect(hidePhotoComment('c', true, undefined, client)).rejects.toBeInstanceOf(DataError)
    await expect(deletePhotoComment('c', client)).rejects.toBeInstanceOf(DataError)
  })
})

describe('albums', () => {
  it('fetchAlbumPhotos preserves the organiser ordering', async () => {
    const { client, calls } = createMockClient({ tables: { photos: { data: [] } } })

    await fetchAlbumPhotos('Engagement', client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'order',
      args: ['album_sort_order', { ascending: true }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('fetchPhotoAlbumCounts returns exact counts per album (0 defaults)', async () => {
    const { client } = createMockClient({
      tables: {
        photos: [{ count: 11 }, { count: 2 }, { count: null }, { count: 5 }],
      },
    })

    await expect(fetchPhotoAlbumCounts(client)).resolves.toEqual({
      Engagement: 11,
      'Bach+ette': 2,
      'Wedding Day': 0,
      'Guest Uploads': 5,
    })
  })

  it('fetchPhotoAlbumCounts wraps a count error', async () => {
    const { client } = createMockClient({
      tables: { photos: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchPhotoAlbumCounts(client)).rejects.toMatchObject({ code: 'postgrest:42501' })
  })

  it('fetchNextAlbumSortOrder reads the max order and adds one', async () => {
    const { client } = createMockClient({
      tables: { photos: { data: { album_sort_order: 4 } } },
    })
    await expect(fetchNextAlbumSortOrder('Engagement', client)).resolves.toBe(5)

    const empty = createMockClient({ tables: { photos: { data: null } } })
    await expect(fetchNextAlbumSortOrder('Engagement', empty.client)).resolves.toBe(1)

    const failing = createMockClient({
      tables: { photos: { error: new Error('boom') } },
    })
    await expect(fetchNextAlbumSortOrder('Engagement', failing.client)).rejects.toBeInstanceOf(
      DataError
    )
  })

  it('saveAlbumOrganization maps moves and delete ids onto the RPC args', async () => {
    const result = {
      saved_album: 'Wedding Day',
      current_album_count: 5,
      moved_count: 1,
      deleted_count: 0,
    }
    const { client, calls } = createMockClient({
      rpcs: { save_album_organization_v2: { data: [result] } },
    })

    await expect(
      saveAlbumOrganization(
        {
          album: 'Wedding Day',
          orderedPhotoIds: ['p1', 'p2'],
          moves: [{ photoId: 'p1', targetAlbum: 'Guest Uploads' }],
          deletePhotoIds: ['p3'],
        },
        client
      )
    ).resolves.toEqual(result)

    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'save_album_organization_v2',
      method: 'rpc',
      args: [
        {
          p_album: 'Wedding Day',
          p_ordered_photo_ids: ['p1', 'p2'],
          p_moves: [{ photoId: 'p1', targetAlbum: 'Guest Uploads' }],
          p_delete_photo_ids: ['p3'],
        },
      ],
    })
  })

  it('saveAlbumOrganization / deleteGalleryPhotos reject empty results', async () => {
    const emptySave = createMockClient({ rpcs: { save_album_organization_v2: { data: [] } } })
    await expect(
      saveAlbumOrganization(
        { album: 'Engagement', orderedPhotoIds: [], moves: [] },
        emptySave.client
      )
    ).rejects.toBeInstanceOf(DataError)

    const emptyDelete = createMockClient({ rpcs: { delete_gallery_photos_v1: { data: [] } } })
    await expect(deleteGalleryPhotos({ photoIds: [] }, emptyDelete.client)).rejects.toBeInstanceOf(
      DataError
    )
  })

  it('deleteGalleryPhotos returns the deleted payload', async () => {
    const payload = {
      deleted_count: 1,
      deleted_photo_keys: ['photo-1'],
      deleted_photo_urls: ['/images/x.webp'],
    }
    const { client, calls } = createMockClient({
      rpcs: { delete_gallery_photos_v1: { data: [payload] } },
    })

    await expect(
      deleteGalleryPhotos({ photoIds: ['photo-1'], photoUrls: ['/images/x.webp'] }, client)
    ).resolves.toEqual(payload)
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'delete_gallery_photos_v1',
      method: 'rpc',
      args: [{ p_photo_ids: ['photo-1'], p_photo_urls: ['/images/x.webp'] }],
    })
  })
})

describe('Photo type contract', () => {
  it('exposes normalised fields the UI consumes', () => {
    const photo: Photo = mapPhotoRow(photoRows[0] as PhotoRow)
    expect(typeof photo.likes).toBe('number')
    expect(photo.isProfessional).toBe(true)
    expect(Array.isArray(photo.faces)).toBe(true)
    expect(Array.isArray(photo.tags)).toBe(true)
  })
})
