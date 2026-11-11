import { describe, expect, it } from 'vitest'
import { DataError } from './errors'
import {
  GUEST_FACE_TAGGING_STATUSES,
  MEDIA_REVIEW_BATCH_STATUSES,
  MEDIA_REVIEW_CLUSTER_STATUSES,
  MEDIA_REVIEW_FACE_STATUSES,
  createMediaReviewArtifactSignedUrl,
  downloadMediaReviewArtifact,
  fetchGuestFaceTaggingBatches,
  fetchKnownPeopleNames,
  fetchMediaReviewBatches,
  fetchMediaReviewClusters,
  fetchMediaReviewFaces,
  isMediaReviewClusterStatus,
  updateManyMediaReviewFaces,
  updateMediaReviewBatchStatus,
  updateMediaReviewCluster,
  updateMediaReviewFace,
} from './mediaReview'
import type { TableRow } from './schema'
import { createMockClient } from './test-support/mock-client'

type BatchRow = TableRow<'media_review_batches'>
type ClusterRow = TableRow<'media_review_clusters'>
type FaceRow = TableRow<'media_review_faces'>
type TaggingRow = TableRow<'guest_face_tagging_batches'>

function batchRow(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    id: 'batch-1',
    batch_key: 'batch-key-1',
    label: 'Batch one',
    status: 'in_review',
    source_root: null,
    working_root: null,
    artifact_bucket: 'media-review-artifacts',
    artifact_prefix: 'fixtures/batch-01',
    artifact_paths: { manifest: 'fixtures/batch-01/manifest.json' },
    notes: null,
    cluster_count: 2,
    detection_count: 3,
    pushed_by_user_id: null,
    pushed_by_email: 'admin@test.wedding',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function clusterRow(overrides: Partial<ClusterRow> = {}): ClusterRow {
  return {
    id: 'cluster-1',
    batch_id: 'batch-1',
    cluster_id: 'cluster-key-1',
    review_status: 'pending',
    confirmed_name: null,
    merge_into_cluster_id: null,
    split_requested: false,
    split_notes: null,
    sample_thumbnail_path: null,
    member_count: 1,
    average_quality_score: 0.9,
    source_record_ids: ['record-1'],
    members: [
      { faceId: 'face-1', sourceRelativePath: 'a/b.jpg', thumbnailPath: null, x: 0.4, y: 0.5 },
      'broken',
    ],
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function faceRow(overrides: Partial<FaceRow> = {}): FaceRow {
  return {
    id: 'face-row-1',
    batch_id: 'batch-1',
    face_id: 'face-1',
    cluster_id: 'cluster-key-1',
    source_record_id: 'record-1',
    source_relative_path: 'a/b.jpg',
    photo_url: '/images/a.webp',
    thumbnail_url: '/images/a-thumb.webp',
    thumbnail_object_path: 'thumbs/a.webp',
    x: 0.4,
    y: 0.5,
    box: { x: 0.4, y: 0.5, width: 0.2, height: 0.2 },
    quality_score: 0.9,
    review_status: 'pending',
    confirmed_name: null,
    person_key: null,
    notes: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function taggingRow(overrides: Partial<TaggingRow> = {}): TaggingRow {
  return {
    id: 'tagging-1',
    batch_key: 'tagging-key-1',
    label: 'Tagging one',
    status: 'synced',
    exportable_upload_count: 4,
    exportable_photo_count: 12,
    synced_photo_count: 10,
    skipped_photo_count: 2,
    last_error: null,
    notes: null,
    metadata: {},
    created_by_user_id: null,
    created_by_email: 'admin@test.wedding',
    synced_by_user_id: null,
    synced_by_email: null,
    last_synced_at: '2026-01-03T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('media review enums', () => {
  it('exposes the frozen CHECK-constraint values', () => {
    expect([...MEDIA_REVIEW_BATCH_STATUSES]).toEqual([
      'pending',
      'in_review',
      'approved',
      'archived',
    ])
    expect([...MEDIA_REVIEW_CLUSTER_STATUSES]).toEqual([
      'pending',
      'confirmed',
      'ignored',
      'merged',
      'split_requested',
    ])
    expect([...MEDIA_REVIEW_FACE_STATUSES]).toEqual(['pending', 'confirmed', 'ignored'])
    expect([...GUEST_FACE_TAGGING_STATUSES]).toEqual(['prepared', 'synced', 'failed'])
    expect(isMediaReviewClusterStatus('split_requested')).toBe(true)
    expect(isMediaReviewClusterStatus('unknown')).toBe(false)
  })
})

describe('media review reads', () => {
  it('fetchMediaReviewBatches maps batches, jsonb artifact paths and unknown statuses', async () => {
    const { client, calls } = createMockClient({
      tables: {
        media_review_batches: {
          data: [batchRow(), batchRow({ id: 'batch-2', status: 'weird', artifact_paths: null })],
        },
      },
    })

    const batches = await fetchMediaReviewBatches(client)

    expect(batches).toHaveLength(2)
    expect(batches[0]).toMatchObject({
      id: 'batch-1',
      batchKey: 'batch-key-1',
      status: 'in_review',
      artifactBucket: 'media-review-artifacts',
      artifactPrefix: 'fixtures/batch-01',
      artifactPaths: { manifest: 'fixtures/batch-01/manifest.json' },
    })
    expect(batches[1]?.status).toBe('pending')
    expect(batches[1]?.artifactPaths).toEqual({})
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'media_review_batches',
      method: 'order',
      args: ['updated_at', { ascending: false }],
    })
  })

  it('fetchMediaReviewClusters parses cluster members and filters by batch', async () => {
    const { client, calls } = createMockClient({
      tables: { media_review_clusters: { data: [clusterRow()] } },
    })

    const clusters = await fetchMediaReviewClusters('batch-1', client)

    expect(clusters[0]).toMatchObject({ clusterId: 'cluster-key-1', memberCount: 1 })
    expect(clusters[0]?.members).toEqual([
      { faceId: 'face-1', sourceRelativePath: 'a/b.jpg', thumbnailPath: null, x: 0.4, y: 0.5 },
    ])
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'media_review_clusters',
      method: 'eq',
      args: ['batch_id', 'batch-1'],
    })
  })

  it('fetchMediaReviewFaces maps face rows', async () => {
    const { client } = createMockClient({
      tables: {
        media_review_faces: {
          data: [faceRow(), faceRow({ id: 'face-row-2', review_status: 'bogus' })],
        },
      },
    })

    const faces = await fetchMediaReviewFaces('batch-1', client)

    expect(faces[0]).toMatchObject({
      id: 'face-row-1',
      faceId: 'face-1',
      photoUrl: '/images/a.webp',
      reviewStatus: 'pending',
    })
    expect(faces[1]?.reviewStatus).toBe('pending')
  })

  it('fetchGuestFaceTaggingBatches maps tagging batches', async () => {
    const { client } = createMockClient({
      tables: { guest_face_tagging_batches: { data: [taggingRow()] } },
    })

    const [batch] = await fetchGuestFaceTaggingBatches(client)

    expect(batch).toMatchObject({
      id: 'tagging-1',
      batchKey: 'tagging-key-1',
      status: 'synced',
      exportablePhotoCount: 12,
      skippedPhotoCount: 2,
      lastSyncedAt: '2026-01-03T00:00:00.000Z',
    })
  })

  it('wraps read failures', async () => {
    const { client } = createMockClient({
      tables: { media_review_batches: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchMediaReviewBatches(client)).rejects.toMatchObject({ code: 'postgrest:42501' })
  })
})

describe('media review writes', () => {
  it('updates a batch status and rejects missing rows', async () => {
    const { client, calls } = createMockClient({
      tables: { media_review_batches: { data: batchRow({ status: 'approved' }) } },
    })

    const batch = await updateMediaReviewBatchStatus('batch-1', 'approved', client)

    expect(batch.status).toBe('approved')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'media_review_batches',
      method: 'update',
      args: [expect.objectContaining({ status: 'approved' })],
    })

    const missing = createMockClient({ tables: { media_review_batches: { data: null } } })
    await expect(
      updateMediaReviewBatchStatus('missing', 'approved', missing.client)
    ).rejects.toMatchObject({ code: 'not-found:batch' })
  })

  it('patches only the provided cluster fields', async () => {
    const { client, calls } = createMockClient({
      tables: {
        media_review_clusters: {
          data: clusterRow({ review_status: 'confirmed', confirmed_name: 'Austin' }),
        },
      },
    })

    const cluster = await updateMediaReviewCluster(
      'cluster-1',
      { reviewStatus: 'confirmed', confirmedName: 'Austin' },
      client
    )

    expect(cluster.reviewStatus).toBe('confirmed')
    const updatePayload = calls.find(call => call.method === 'update')?.args[0] as Record<
      string,
      unknown
    >
    expect(updatePayload).toMatchObject({ review_status: 'confirmed', confirmed_name: 'Austin' })
    expect(updatePayload).not.toHaveProperty('merge_into_cluster_id')
    expect(updatePayload).not.toHaveProperty('split_requested')
    expect(updatePayload).not.toHaveProperty('split_notes')

    const missing = createMockClient({ tables: { media_review_clusters: { data: null } } })
    await expect(
      updateMediaReviewCluster('missing', { reviewStatus: 'pending' }, missing.client)
    ).rejects.toMatchObject({ code: 'not-found:cluster' })
  })

  it('updates a single face and bulk-updates many', async () => {
    const single = createMockClient({
      tables: {
        media_review_faces: {
          data: [faceRow({ review_status: 'confirmed', confirmed_name: 'Jordyn' })],
        },
      },
    })

    const face = await updateMediaReviewFace(
      'face-row-1',
      { reviewStatus: 'confirmed', confirmedName: 'Jordyn' },
      single.client
    )
    expect(face).toMatchObject({ reviewStatus: 'confirmed', confirmedName: 'Jordyn' })

    const missing = createMockClient({ tables: { media_review_faces: { data: [] } } })
    await expect(
      updateMediaReviewFace('missing', { reviewStatus: 'ignored' }, missing.client)
    ).rejects.toMatchObject({ code: 'not-found:face' })

    const bulk = createMockClient({
      tables: {
        media_review_faces: {
          data: [
            faceRow({ review_status: 'ignored' }),
            faceRow({ id: 'f2', review_status: 'ignored' }),
          ],
        },
      },
    })
    const updated = await updateManyMediaReviewFaces(
      ['face-row-1', 'f2'],
      { reviewStatus: 'ignored' },
      bulk.client
    )
    expect(updated).toHaveLength(2)
    expect(bulk.calls).toContainEqual({
      surface: 'from',
      target: 'media_review_faces',
      method: 'in',
      args: ['id', ['face-row-1', 'f2']],
    })

    const empty = createMockClient({})
    await expect(
      updateManyMediaReviewFaces([], { reviewStatus: 'ignored' }, empty.client)
    ).resolves.toEqual([])
    expect(empty.calls).toHaveLength(0)
  })

  it('wraps write failures', async () => {
    const { client } = createMockClient({
      tables: { media_review_batches: { error: new Error('boom') } },
    })
    await expect(
      updateMediaReviewBatchStatus('batch-1', 'archived', client)
    ).rejects.toBeInstanceOf(DataError)
  })
})

describe('known people autocomplete', () => {
  it('unions photo face names and confirmed review names, sorted and deduped', async () => {
    const photosPage = [
      {
        faces: [
          { id: 'f1', name: 'Austin Porada', x: 1, y: 2 },
          { id: 'f2', name: 'Jordyn Porada', x: 1, y: 2 },
          { id: 'f3', name: '  Austin Porada  ', x: 1, y: 2 },
          { id: 'f4', name: '', x: 1, y: 2 },
          'not-an-object',
        ],
      },
      { faces: null },
    ]
    const { client, calls } = createMockClient({
      tables: {
        photos: { data: photosPage },
        media_review_faces: {
          data: [
            { confirmed_name: 'Christine Pringle' },
            { confirmed_name: null },
            { confirmed_name: 'Jordyn Porada' },
          ],
        },
      },
    })

    const names = await fetchKnownPeopleNames(client)

    expect(names).toEqual(['Austin Porada', 'Christine Pringle', 'Jordyn Porada'])
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'range',
      args: [0, 499],
    })
  })

  it('pages through 500-row photo pages', async () => {
    const fullPage = Array.from({ length: 500 }, (_, index) => ({
      faces: [{ id: `f${index}`, name: `Person ${index}`, x: 0, y: 0 }],
    }))
    const { client, calls } = createMockClient({
      tables: {
        photos: [
          { data: fullPage },
          { data: [{ faces: [{ id: 'last', name: 'Last Person', x: 0, y: 0 }] }] },
        ],
        media_review_faces: { data: [] },
      },
    })

    const names = await fetchKnownPeopleNames(client)

    expect(names).toHaveLength(501)
    expect(names).toContain('Last Person')
    const ranges = calls.filter(call => call.method === 'range').map(call => call.args)
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
    ])
  })

  it('wraps read failures', async () => {
    const { client } = createMockClient({
      tables: { photos: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchKnownPeopleNames(client)).rejects.toBeInstanceOf(DataError)
  })
})

describe('review artifacts (private storage)', () => {
  it('creates a signed URL with the default one-hour expiry', async () => {
    const { client, calls } = createMockClient({
      storage: { signedUrl: 'https://example.test/signed' },
    })

    await expect(
      createMediaReviewArtifactSignedUrl('media-review-artifacts', 'batch/manifest.json', client)
    ).resolves.toBe('https://example.test/signed')
    expect(calls).toContainEqual({
      surface: 'storage',
      target: 'media-review-artifacts',
      method: 'createSignedUrl',
      args: ['batch/manifest.json', 3600],
    })
  })

  it('wraps signed-url errors', async () => {
    const { client } = createMockClient({
      storage: { createSignedUrlError: new Error('not found') },
    })
    await expect(
      createMediaReviewArtifactSignedUrl('media-review-artifacts', 'missing.json', client)
    ).rejects.toBeInstanceOf(DataError)
  })

  it('downloads an artifact blob and wraps errors', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' })
    const { client } = createMockClient({ storage: { download: blob } })
    await expect(
      downloadMediaReviewArtifact('media-review-artifacts', 'batch/manifest.json', client)
    ).resolves.toBe(blob)

    const broken = createMockClient({ storage: { downloadError: new Error('boom') } })
    await expect(
      downloadMediaReviewArtifact('media-review-artifacts', 'batch/manifest.json', broken.client)
    ).rejects.toBeInstanceOf(DataError)
  })
})
