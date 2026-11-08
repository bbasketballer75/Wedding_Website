import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  useActivityFeed,
  useApprovedGuestUploads,
  useClaimsByStatus,
  useDashboardCounts,
  useEditorialFeatures,
  useFilmGuestHighlights,
  useGalleryPhotos,
  useGuestPhotos,
  useGuestbookMessages,
  useMediaReviewBatches,
  usePendingClaims,
  usePhotoComments,
  usePhotoEngagement,
  useTopPhotos,
  useWeddingDayPhotos,
} from './hooks'
import type { TableRow } from './schema'
import { createMockClient } from './test-support/mock-client'
import { loadFixtures } from './test-support/fixtures'
import { createTestQueryWrapper } from './test-support/query-wrapper'

const fixtures = loadFixtures()

type PhotoRow = TableRow<'photos'>

function photoRow(id: string): PhotoRow {
  return {
    id,
    url: `/images/${id}.webp`,
    thumbnail: `/images/${id}.webp`,
    caption: null,
    category: null,
    location: null,
    date: null,
    likes: 3,
    photographer: null,
    is_professional: false,
    tags: [],
    faces: [],
    created_at: '2026-01-01T00:00:00.000Z',
    album: 'Engagement',
    album_sort_order: 0,
    download_url: null,
  }
}

function renderHookWithWrapper<Result>(
  callback: () => Result,
  client: ReturnType<typeof createMockClient>['client']
) {
  const wrapper = createTestQueryWrapper()
  const view = renderHook(callback, { wrapper: wrapper.Wrapper })
  return { ...view, client, queryClient: wrapper.queryClient }
}

describe('home read hooks', () => {
  it('useTopPhotos returns mapped photos and respects the limit', async () => {
    const mock = createMockClient({ tables: { photos: { data: fixtures.photos } } })
    const { result } = renderHookWithWrapper(() => useTopPhotos(6, mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(6)
    expect(result.current.data?.[0]?.id).toBe('photo-1')
    expect(mock.calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'limit',
      args: [6],
    })
  })

  it('useWeddingDayPhotos reads the fallback row', async () => {
    const row = { ...photoRow('wd-1'), album: 'Wedding Day' }
    const mock = createMockClient({ tables: { photos: { data: [row] } } })
    const { result } = renderHookWithWrapper(() => useWeddingDayPhotos(6, mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.album).toBe('Wedding Day')
  })

  it('useEditorialFeatures returns only live slots', async () => {
    const mock = createMockClient({
      tables: { site_editorial_features: { data: fixtures.editorial } },
    })
    const { result } = renderHookWithWrapper(
      () => useEditorialFeatures(undefined, mock.client),
      mock.client
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.slot).toBe('home_moment_of_the_week')
  })

  it('useGuestbookMessages returns parsed notes with replies', async () => {
    const mock = createMockClient({
      tables: { guestbook_messages: { data: fixtures.guestbook.messages } },
    })
    const { result } = renderHookWithWrapper(() => useGuestbookMessages(mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(3)
    expect(result.current.data?.[0]?.comments[0]?.author).toBe('Austin')
  })

  it('useApprovedGuestUploads and useGuestPhotos read the same approved feed', async () => {
    const mock = createMockClient({
      tables: { guest_uploads: { data: fixtures.guestUploads.approved } },
    })
    const approved = renderHookWithWrapper(() => useApprovedGuestUploads(mock.client), mock.client)
    await waitFor(() => expect(approved.result.current.isSuccess).toBe(true))
    expect(approved.result.current.data).toHaveLength(2)

    const guestPhotos = renderHookWithWrapper(() => useGuestPhotos(mock.client), mock.client)
    await waitFor(() => expect(guestPhotos.result.current.isSuccess).toBe(true))
    expect(guestPhotos.result.current.data).toHaveLength(2)
  })
})

describe('gallery read hooks', () => {
  it('useGalleryPhotos paginates with useInfiniteQuery', async () => {
    const mock = createMockClient({
      tables: {
        photos: [{ data: [photoRow('p1'), photoRow('p2')] }, { data: [photoRow('p3')] }],
      },
    })
    const { result } = renderHookWithWrapper(
      () => useGalleryPhotos({ pageSize: 2, client: mock.client }),
      mock.client
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0]).toHaveLength(2)
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('usePhotoEngagement merges like statuses and comment summaries', async () => {
    const mock = createMockClient({
      rpcs: {
        get_photo_like_statuses: { data: [{ photo_key: 'p1', likes_count: 9, liked: true }] },
        get_photo_engagement_summary_v1: {
          data: [{ photo_key: 'p1', likes_count: 9, comments_count: 2, hidden_comments_count: 0 }],
        },
      },
    })
    const { result } = renderHookWithWrapper(
      () => usePhotoEngagement(['p1'], 'session-1', mock.client),
      mock.client
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.index.get('p1')).toEqual({ likeCount: 9, liked: true, commentCount: 2 })
  })

  it('usePhotoComments is disabled without a photo key', () => {
    const mock = createMockClient({ tables: { photo_comments: { data: [] } } })
    const { result } = renderHookWithWrapper(() => usePhotoComments(null, mock.client), mock.client)

    expect(result.current.fetchStatus).toBe('idle')
    expect(mock.calls).toHaveLength(0)
  })

  it('usePhotoComments reads visible comments for the open photo', async () => {
    const mock = createMockClient({
      tables: {
        photo_comments: {
          data: [
            {
              id: 'c1',
              photo_key: 'p1',
              author: 'Guest',
              content: 'Lovely',
              created_at: '2026-01-01T00:00:00.000Z',
              session_id: null,
              is_hidden: false,
              hidden_at: null,
              hidden_by_user_id: null,
              hidden_reason: null,
            },
          ],
        },
      },
    })
    const { result } = renderHookWithWrapper(() => usePhotoComments('p1', mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

describe('film / activity / admin read hooks', () => {
  it('useFilmGuestHighlights composes the guest-video reel', async () => {
    const row = {
      ...photoRow('ignore'),
      id: 'upload-1',
      guest_name: 'Jamie',
      guest_email: 'jamie@example.com',
      message: 'A toast',
      photo_urls: [],
      video_urls: ['/video/christine.mp4'],
      status: 'approved',
      video_visibility: 'featured',
      memory_trail: 'family',
      photo_fingerprints: [],
      video_fingerprints: [],
    }
    const mock = createMockClient({ tables: { guest_uploads: { data: [row] } } })
    const { result } = renderHookWithWrapper(() => useFilmGuestHighlights(mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.videoUrl).toBe('/video/christine.mp4')
  })

  it('useActivityFeed reads the newest feed', async () => {
    const mock = createMockClient({ tables: { activity_log: { data: fixtures.activity } } })
    const { result } = renderHookWithWrapper(() => useActivityFeed(100, mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('useDashboardCounts runs the four probes', async () => {
    const mock = createMockClient({
      tables: {
        photos: { count: 1 },
        guest_uploads: [{ count: 2 }, { count: 3 }],
        guestbook_messages: { count: 4 },
      },
    })
    const { result } = renderHookWithWrapper(() => useDashboardCounts(mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      photos: 1,
      pendingUploads: 2,
      guestbookMessages: 4,
      approvedUploads: 3,
    })
  })

  it('useClaimsByStatus and usePendingClaims read their queues', async () => {
    const mock = createMockClient({ tables: { photo_claims: { data: fixtures.claims.pending } } })
    const byStatus = renderHookWithWrapper(
      () => useClaimsByStatus('pending', mock.client),
      mock.client
    )
    await waitFor(() => expect(byStatus.result.current.isSuccess).toBe(true))
    expect(byStatus.result.current.data).toHaveLength(1)

    const pending = renderHookWithWrapper(() => usePendingClaims(mock.client), mock.client)
    await waitFor(() => expect(pending.result.current.isSuccess).toBe(true))
    expect(pending.result.current.data).toHaveLength(1)
  })

  it('useMediaReviewBatches reads the review queue', async () => {
    const mock = createMockClient({
      tables: {
        media_review_batches: {
          data: [
            {
              id: 'batch-1',
              batch_key: 'key',
              label: 'Batch',
              status: 'pending',
              source_root: null,
              working_root: null,
              artifact_bucket: 'media-review-artifacts',
              artifact_prefix: 'prefix',
              artifact_paths: {},
              notes: null,
              cluster_count: 0,
              detection_count: 0,
              pushed_by_user_id: null,
              pushed_by_email: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-02T00:00:00.000Z',
            },
          ],
        },
      },
    })
    const { result } = renderHookWithWrapper(() => useMediaReviewBatches(mock.client), mock.client)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.id).toBe('batch-1')
  })
})
