import { describe, expect, it } from 'vitest'
import { DataError, isDataError } from './errors'
import {
  GUEST_UPLOAD_STATUSES,
  GUEST_VIDEO_VISIBILITIES,
  approveGuestUpload,
  bulkApproveGuestUploads,
  bulkRejectGuestUploads,
  fetchApprovedGuestUploads,
  fetchApprovedGuestVideoUploads,
  fetchFilmGuestHighlights,
  fetchGuestUploadStatusByEmail,
  fetchGuestUploadsByStatus,
  fetchPendingGuestUploads,
  isGuestUploadStatus,
  isGuestVideoVisibility,
  mapFilmHighlights,
  mapGuestUploadRow,
  mapGuestUploadRows,
  publishGuestUploadPhotosToAlbum,
  rejectGuestUpload,
  selectFilmHighlights,
  type GuestUpload,
} from './guestUploads'
import type { TableRow } from './schema'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

const fixtures = loadFixtures()
const approved = fixtures.guestUploads.approved
const pending = fixtures.guestUploads.pending

type GuestUploadRow = TableRow<'guest_uploads'>

function makeRow(overrides: Partial<GuestUploadRow> = {}): GuestUploadRow {
  return {
    id: 'upload-x',
    guest_name: 'Guest',
    guest_email: 'guest@example.com',
    message: null,
    photo_urls: [],
    video_urls: [],
    status: 'approved',
    created_at: '2026-01-01T00:00:00.000Z',
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

function makeUpload(overrides: Partial<GuestUpload> = {}): GuestUpload {
  return { ...mapGuestUploadRow(makeRow()), ...overrides }
}

describe('guest upload mapping (contracts/fixtures/guestUploads.json)', () => {
  it('normalises approved rows (nullable arrays, defaults)', () => {
    const uploads = mapGuestUploadRows(approved as unknown as GuestUploadRow[])

    expect(uploads).toHaveLength(2)
    expect(uploads[0]?.id).toBe('upload-approved-1')
    expect(uploads[0]?.status).toBe('approved')
    expect(uploads[0]?.photoUrls).toHaveLength(3)
    expect(uploads[0]?.videoUrls).toEqual([])
    expect(uploads[0]?.videoVisibility).toBe('archive_only')
    expect(uploads[0]?.photoFingerprints).toEqual([])
  })

  it('narrows status/visibility and rejects unknown values safely', () => {
    expect(GUEST_UPLOAD_STATUSES).toEqual(['pending', 'approved', 'rejected'])
    expect(GUEST_VIDEO_VISIBILITIES).toEqual(['archive_only', 'guest_highlights', 'featured'])
    expect(isGuestUploadStatus('approved')).toBe(true)
    expect(isGuestUploadStatus('deleted')).toBe(false)
    expect(isGuestVideoVisibility('featured')).toBe(true)
    expect(isGuestVideoVisibility(null)).toBe(false)

    const mapped = mapGuestUploadRow(
      makeRow({ status: 'weird', video_visibility: 'weird', photo_urls: null })
    )
    expect(mapped.status).toBe('pending')
    expect(mapped.videoVisibility).toBe('archive_only')
    expect(mapped.photoUrls).toEqual([])
  })
})

describe('film highlights (frozen Film.tsx filter/sort)', () => {
  it('keeps videos with non-archive visibility, prefers guest highlights, caps at limit', () => {
    const archiveOnly = makeUpload({
      id: 'a',
      videoUrls: ['/video/archive.mp4'],
      videoVisibility: 'archive_only',
    })
    const noVideo = makeUpload({ id: 'b', videoUrls: [], videoVisibility: 'featured' })
    const highlight = makeUpload({
      id: 'c',
      videoUrls: ['/video/highlight.mp4'],
      videoVisibility: 'guest_highlights',
    })
    const featured = makeUpload({
      id: 'd',
      videoUrls: ['/video/featured.mp4'],
      videoVisibility: 'featured',
    })
    const second = makeUpload({
      id: 'e',
      videoUrls: ['/video/second.mp4'],
      videoVisibility: 'guest_highlights',
    })

    const selected = selectFilmHighlights([archiveOnly, noVideo, highlight, featured, second], 3)

    expect(selected.map(upload => upload.id)).toEqual(['c', 'd', 'e'])
  })

  it('maps to the reel view model with frozen copy defaults', () => {
    const withMessage = makeUpload({
      id: 'with-message',
      guest_name: 'Jamie',
      message: '  The best day  ',
      videoUrls: ['/video/a.mp4'],
      videoVisibility: 'guest_highlights',
      memory_trail: 'ceremony',
    })
    const withoutMessage = makeUpload({
      id: 'without-message',
      guest_name: 'Morgan',
      message: null,
      videoUrls: ['/video/b.mp4'],
      videoVisibility: 'featured',
    })

    const [first, second] = mapFilmHighlights([withMessage, withoutMessage])

    expect(first).toMatchObject({
      id: 'with-message-0',
      uploadId: 'with-message',
      guestName: 'Jamie',
      title: 'The best day',
      description: 'The best day',
      videoUrl: '/video/a.mp4',
      badge: 'From your phones',
      memoryTrail: 'ceremony',
    })
    expect(second?.title).toBe('A moment from Morgan')
    expect(second?.description).toContain('A little handheld piece of the day')
    expect(second?.memoryTrail).toBeNull()
  })

  it('rejects a mapped highlight without a video url', () => {
    expect(() => mapFilmHighlights([makeUpload({ videoUrls: [] })])).toThrowError(DataError)
  })
})

describe('guest upload reads', () => {
  it('fetchApprovedGuestUploads filters by status and orders newest first', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_uploads: { data: approved } },
    })

    const uploads = await fetchApprovedGuestUploads(client)

    expect(uploads).toHaveLength(2)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'eq',
      args: ['status', 'approved'],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('pending/by-status reads work and wrap errors', async () => {
    const { client } = createMockClient({ tables: { guest_uploads: { data: pending } } })
    await expect(fetchPendingGuestUploads(client)).resolves.toHaveLength(3)
    await expect(fetchGuestUploadsByStatus('rejected', client)).resolves.toBeDefined()

    const failing = createMockClient({
      tables: { guest_uploads: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchApprovedGuestUploads(failing.client)).rejects.toMatchObject({
      code: 'postgrest:42501',
    })
  })

  it('fetchApprovedGuestVideoUploads limits the query then drops photo-only uploads', async () => {
    const rows = [approved[0], pending[2]]
    const { client, calls } = createMockClient({ tables: { guest_uploads: { data: rows } } })

    const videos = await fetchApprovedGuestVideoUploads(12, client)

    expect(videos).toHaveLength(1)
    expect(videos[0]?.id).toBe('upload-pending-3')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'limit',
      args: [12],
    })
  })

  it('fetchFilmGuestHighlights composes the whole film pipeline', async () => {
    const rows = [
      makeRow({
        id: 'video-1',
        message: 'A toast',
        video_urls: ['/video/christine.mp4'],
        video_visibility: 'featured',
        memory_trail: 'family',
      }),
      makeRow({ id: 'photo-only', photo_urls: ['/images/a.webp'] }),
    ]
    const { client } = createMockClient({ tables: { guest_uploads: { data: rows } } })

    const highlights = await fetchFilmGuestHighlights(client)

    expect(highlights).toHaveLength(1)
    expect(highlights[0]?.videoUrl).toBe('/video/christine.mp4')
    expect(highlights[0]?.title).toBe('A toast')
  })

  it('fetchGuestUploadStatusByEmail returns the newest upload or null', async () => {
    const { client } = createMockClient({
      tables: {
        guest_uploads: {
          data: {
            id: 'upload-status',
            status: 'rejected',
            rejection_reason: 'out of focus',
            created_at: null,
            photo_urls: null,
            video_urls: null,
            photo_fingerprints: null,
            video_fingerprints: null,
            guest_name: 'Guest',
            guest_email: 'guest@example.com',
            message: null,
          },
        },
      },
    })

    const status = await fetchGuestUploadStatusByEmail('guest@example.com', client)
    expect(status?.status).toBe('rejected')
    expect(status?.rejection_reason).toBe('out of focus')
    expect(status?.photoUrls).toEqual([])

    const empty = createMockClient({ tables: { guest_uploads: { data: null } } })
    await expect(
      fetchGuestUploadStatusByEmail('none@example.com', empty.client)
    ).resolves.toBeNull()

    const broken = createMockClient({ tables: { guest_uploads: { error: new Error('boom') } } })
    await expect(fetchGuestUploadStatusByEmail('x@example.com', broken.client)).resolves.toBeNull()
  })
})

describe('guest upload moderation transitions', () => {
  it('approveGuestUpload updates status and writes an audit entry', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_uploads: [{ data: { status: 'pending' } }, { data: [] }],
        moderation_audit_log: { data: [makeRow({ id: 'ignored' })] },
      },
    })

    await approveGuestUpload('upload-1', { userId: 'admin-1', email: 'admin@test.wedding' }, client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'update',
      args: [{ status: 'approved' }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'insert',
      args: [
        {
          entity_type: 'guest_upload',
          entity_id: 'upload-1',
          action: 'upload_approved_published',
          summary: 'Guest upload approved',
          metadata: {},
          from_status: 'pending',
          to_status: 'approved',
          actor_user_id: 'admin-1',
          actor_email: 'admin@test.wedding',
        },
      ],
    })
  })

  it('rejectGuestUpload writes the reason and audit metadata', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_uploads: [{ data: { status: 'pending' } }, { data: [] }],
        moderation_audit_log: { data: [makeRow()] },
      },
    })

    await rejectGuestUpload('upload-2', 'duplicate', null, client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_uploads',
      method: 'update',
      args: [{ status: 'rejected', rejection_reason: 'duplicate' }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'insert',
      args: [
        expect.objectContaining({
          action: 'upload_rejected',
          summary: 'Guest upload rejected: duplicate',
          metadata: { rejection_reason: 'duplicate' },
        }),
      ],
    })
  })

  it('bulk transitions audit every id and short-circuit empty input', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_uploads: { data: [] },
        moderation_audit_log: { data: [makeRow()] },
      },
    })

    await bulkApproveGuestUploads([], null, client)
    expect(calls).toHaveLength(0)

    await bulkApproveGuestUploads(['u1', 'u2'], null, client)
    await bulkRejectGuestUploads(['u3'], 'spam', null, client)

    const auditInserts = calls.filter(
      call => call.target === 'moderation_audit_log' && call.method === 'insert'
    )
    expect(auditInserts).toHaveLength(3)
    expect(auditInserts[0]?.args[0]).toMatchObject({
      entity_id: 'u1',
      action: 'upload_approved_published',
    })
    expect(auditInserts[2]?.args[0]).toMatchObject({
      entity_id: 'u3',
      action: 'upload_bulk_rejected',
      from_status: 'pending',
    })
  })

  it('wraps update failures before auditing', async () => {
    const { client } = createMockClient({
      tables: { guest_uploads: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(approveGuestUpload('upload-1', null, client)).rejects.toMatchObject({
      code: 'postgrest:42501',
    })
  })
})

describe('publish guest uploads to an album', () => {
  it('inserts one photo row per url and audits each upload', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_uploads: {
          data: [
            { id: 'u1', guest_name: 'Jamie', photo_urls: ['/images/a.webp', '/images/b.webp'] },
            { id: 'u2', guest_name: null, photo_urls: [] },
          ],
        },
        photos: { data: [{ id: 'photo-new-1' }, { id: 'photo-new-2' }] },
        moderation_audit_log: { data: [makeRow()] },
      },
    })

    const result = await publishGuestUploadPhotosToAlbum(
      ['u1', 'u2'],
      'Guest Uploads',
      null,
      client
    )

    expect(result).toEqual({ published: 2 })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'insert',
      args: [
        [
          {
            url: '/images/a.webp',
            thumbnail: '/images/a.webp',
            album: 'Guest Uploads',
            category: 'Guest Uploads',
            is_professional: false,
            caption: 'Photo by Jamie',
          },
          {
            url: '/images/b.webp',
            thumbnail: '/images/b.webp',
            album: 'Guest Uploads',
            category: 'Guest Uploads',
            is_professional: false,
            caption: 'Photo by Jamie',
          },
        ],
      ],
    })

    const audits = calls.filter(
      call => call.target === 'moderation_audit_log' && call.method === 'insert'
    )
    expect(audits).toHaveLength(2)
    expect(audits[1]?.args[0]).toMatchObject({
      entity_id: 'u2',
      metadata: { album: 'Guest Uploads' },
    })
  })

  it('short-circuits empty ids and validates the album', async () => {
    const { client, calls } = createMockClient({})

    await expect(publishGuestUploadPhotosToAlbum([], 'Engagement', null, client)).resolves.toEqual({
      published: 0,
    })
    expect(calls).toHaveLength(0)

    try {
      await publishGuestUploadPhotosToAlbum(['u1'], 'Not An Album' as never, null, client)
      throw new Error('expected rejection')
    } catch (error) {
      expect(isDataError(error)).toBe(true)
      if (isDataError(error)) expect(error.code).toBe('validation:album')
    }
  })

  it('returns zero when the uploads carry no photo urls', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_uploads: { data: [{ id: 'u1', guest_name: 'G', photo_urls: null }] } },
    })

    await expect(
      publishGuestUploadPhotosToAlbum(['u1'], 'Engagement', null, client)
    ).resolves.toEqual({
      published: 0,
    })
    expect(calls.some(call => call.target === 'photos')).toBe(false)
  })
})
