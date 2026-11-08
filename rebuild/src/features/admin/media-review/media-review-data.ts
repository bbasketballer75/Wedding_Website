/**
 * Data seams for the admin people-review surface (`/admin/review`).
 *
 * Mirrors the frozen `src/components/admin/MediaReviewPanel.tsx` +
 * `src/stores/mediaReviewStore.ts` read/write surface, reduced to the five
 * operations the rebuilt review page actually needs: batches, clusters, faces,
 * cluster patches (rename/merge) and face patches (confirm/unconfirm).
 *
 * Default bindings point at the typed Wave-3 data layer
 * (`@/shared/data/mediaReview`), which already mirrors `media_review_*` RLS
 * writes. Tests inject `PEOPLE_REVIEW_FIXTURES`.
 *
 * TODO(Wave3/Lead): W7-1 owns `features/admin/data.ts`. If the shared admin API
 * grows equivalent reads/writes, re-export from there and delete these bindings;
 * the payload shapes (`UpdateMediaReviewClusterInput` /
 * `UpdateMediaReviewFaceInput`) must stay identical because they mirror the
 * DB columns that drive public face names (`media_review_faces.confirmed_name`).
 */
import {
  fetchMediaReviewBatches,
  fetchMediaReviewClusters,
  fetchMediaReviewFaces,
  updateManyMediaReviewFaces,
  updateMediaReviewBatchStatus,
  updateMediaReviewCluster,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
  type MediaReviewCluster,
  type MediaReviewFace,
  type UpdateMediaReviewClusterInput,
  type UpdateMediaReviewFaceInput,
} from '@/shared/data/mediaReview'

export type {
  MediaReviewBatch,
  MediaReviewBatchStatus,
  MediaReviewCluster,
  MediaReviewFace,
  UpdateMediaReviewClusterInput,
  UpdateMediaReviewFaceInput,
}

export interface PeopleReviewData {
  readonly fetchBatches: () => Promise<MediaReviewBatch[]>
  readonly updateBatchStatus: (
    batchId: string,
    status: MediaReviewBatchStatus
  ) => Promise<MediaReviewBatch>
  readonly fetchClusters: (batchId: string) => Promise<MediaReviewCluster[]>
  readonly fetchFaces: (batchId: string) => Promise<MediaReviewFace[]>
  readonly updateCluster: (
    clusterId: string,
    input: UpdateMediaReviewClusterInput
  ) => Promise<MediaReviewCluster>
  readonly updateFaces: (
    faceIds: readonly string[],
    input: UpdateMediaReviewFaceInput
  ) => Promise<MediaReviewFace[]>
}

/** Default bindings against the typed Wave-3 data layer. */
export const peopleReviewData: PeopleReviewData = {
  fetchBatches: () => fetchMediaReviewBatches(),
  updateBatchStatus: (batchId, status) => updateMediaReviewBatchStatus(batchId, status),
  fetchClusters: batchId => fetchMediaReviewClusters(batchId),
  fetchFaces: batchId => fetchMediaReviewFaces(batchId),
  updateCluster: (clusterId, input) => updateMediaReviewCluster(clusterId, input),
  updateFaces: (faceIds, input) => updateManyMediaReviewFaces(faceIds, input),
}

/**
 * Frozen cluster display rule: confirmed name wins, then the cluster label
 * (`cluster_id` is the pipeline's own label), then a stable short id.
 */
export function clusterDisplayName(cluster: MediaReviewCluster): string {
  const confirmed = cluster.confirmedName?.trim()
  if (confirmed) return confirmed
  const label = cluster.clusterId?.trim()
  if (label) return label
  return `Cluster ${cluster.id.slice(0, 8)}`
}

/** Frozen face label: confirmed name, then the parent cluster, then the face id. */
export function faceDisplayName(face: MediaReviewFace): string {
  return (
    face.confirmedName?.trim() ||
    face.clusterId?.trim() ||
    face.faceId ||
    `Face ${face.id.slice(0, 8)}`
  )
}

/** Merge payload: the source cluster points at the target and leaves the queue. */
export function buildClusterMergePatch(targetClusterId: string): UpdateMediaReviewClusterInput {
  return { mergeIntoClusterId: targetClusterId, reviewStatus: 'merged' }
}

/** Rename payload: an empty name unsets the confirmation. */
export function buildClusterRenamePatch(name: string): UpdateMediaReviewClusterInput {
  const trimmed = name.trim()
  return trimmed
    ? { confirmedName: trimmed, reviewStatus: 'confirmed' }
    : { confirmedName: null, reviewStatus: 'pending' }
}

/** Face confirm payload: name + confirmed status (drives the public display name). */
export function buildFaceConfirmPatch(confirmedName: string): UpdateMediaReviewFaceInput {
  const trimmed = confirmedName.trim()
  return {
    reviewStatus: 'confirmed',
    confirmedName: trimmed ? trimmed : null,
    personKey: trimmed
      ? trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : null,
  }
}

/** Face unconfirm payload: back to the pending queue. */
export function buildFaceUnconfirmPatch(): UpdateMediaReviewFaceInput {
  return { reviewStatus: 'pending', confirmedName: null, personKey: null }
}

const BATCH_1: MediaReviewBatch = {
  id: 'batch-1',
  batchKey: 'guest-batch-2025-05',
  label: 'Guest uploads · May 2025',
  status: 'in_review',
  artifactBucket: 'media-review-artifacts',
  artifactPrefix: 'guest-batch-2025-05',
  artifactPaths: {},
  clusterCount: 2,
  detectionCount: 5,
  notes: null,
  createdAt: '2025-05-12T09:00:00.000Z',
  updatedAt: '2025-05-13T09:00:00.000Z',
}

const BATCH_2: MediaReviewBatch = {
  id: 'batch-2',
  batchKey: 'wedding-day-review',
  label: 'Wedding day favourites',
  status: 'pending',
  artifactBucket: 'media-review-artifacts',
  artifactPrefix: 'wedding-day-review',
  artifactPaths: {},
  clusterCount: 1,
  detectionCount: 2,
  notes: null,
  createdAt: '2025-05-14T09:00:00.000Z',
  updatedAt: '2025-05-14T10:00:00.000Z',
}

function fixtureCluster(
  id: string,
  batchId: string,
  clusterId: string,
  confirmedName: string | null,
  memberCount: number,
  status: MediaReviewCluster['reviewStatus'] = 'pending'
): MediaReviewCluster {
  return {
    id,
    batchId,
    clusterId,
    reviewStatus: status,
    confirmedName,
    mergeIntoClusterId: null,
    splitRequested: false,
    sampleThumbnailPath: null,
    memberCount,
    members: [],
    createdAt: '2025-05-13T09:00:00.000Z',
    updatedAt: '2025-05-13T09:00:00.000Z',
  }
}

function fixtureFace(
  id: string,
  batchId: string,
  clusterId: string,
  faceId: string,
  status: MediaReviewFace['reviewStatus'],
  confirmedName: string | null = null
): MediaReviewFace {
  return {
    id,
    batchId,
    faceId,
    clusterId,
    photoUrl: null,
    thumbnailUrl: null,
    x: 40,
    y: 30,
    reviewStatus: status,
    confirmedName,
    personKey: null,
    notes: null,
    createdAt: '2025-05-13T09:00:00.000Z',
    updatedAt: '2025-05-13T09:00:00.000Z',
  }
}

export const FIXTURE_BATCHES: readonly MediaReviewBatch[] = [BATCH_1, BATCH_2]

export const FIXTURE_CLUSTERS: Record<string, readonly MediaReviewCluster[]> = {
  'batch-1': [
    fixtureCluster('cluster-rec-1', 'batch-1', 'Aunt Patricia', 'Aunt Patricia', 3, 'confirmed'),
    fixtureCluster('cluster-rec-2', 'batch-1', 'Table 7 guest', null, 2),
  ],
  'batch-2': [fixtureCluster('cluster-rec-3', 'batch-2', 'Bridesmaid (unresolved)', null, 2)],
}

export const FIXTURE_FACES: Record<string, readonly MediaReviewFace[]> = {
  'batch-1': [
    fixtureFace('face-1', 'batch-1', 'Aunt Patricia', 'face-a', 'confirmed', 'Aunt Patricia'),
    fixtureFace('face-2', 'batch-1', 'Aunt Patricia', 'face-b', 'pending'),
    fixtureFace('face-3', 'batch-1', 'Aunt Patricia', 'face-c', 'pending'),
    fixtureFace('face-4', 'batch-1', 'Table 7 guest', 'face-d', 'pending'),
    fixtureFace('face-5', 'batch-1', 'Table 7 guest', 'face-e', 'ignored'),
  ],
  'batch-2': [
    fixtureFace('face-6', 'batch-2', 'Bridesmaid (unresolved)', 'face-f', 'pending'),
    fixtureFace('face-7', 'batch-2', 'Bridesmaid (unresolved)', 'face-g', 'pending'),
  ],
}

/** Deterministic seam used by the review tests and any future stories. */
export const PEOPLE_REVIEW_FIXTURES: PeopleReviewData = {
  fetchBatches: () => Promise.resolve([...FIXTURE_BATCHES]),
  updateBatchStatus: (batchId, status) => {
    const batch = FIXTURE_BATCHES.find(candidate => candidate.id === batchId)
    if (!batch) return Promise.reject(new Error(`Unknown batch ${batchId}`))
    return Promise.resolve({ ...batch, status })
  },
  fetchClusters: batchId => Promise.resolve([...(FIXTURE_CLUSTERS[batchId] ?? [])]),
  fetchFaces: batchId => Promise.resolve([...(FIXTURE_FACES[batchId] ?? [])]),
  updateCluster: (clusterId, input) => {
    for (const clusters of Object.values(FIXTURE_CLUSTERS)) {
      const cluster = clusters.find(candidate => candidate.id === clusterId)
      if (cluster) {
        return Promise.resolve({
          ...cluster,
          ...(input.confirmedName !== undefined ? { confirmedName: input.confirmedName } : {}),
          ...(input.reviewStatus !== undefined ? { reviewStatus: input.reviewStatus } : {}),
          ...(input.mergeIntoClusterId !== undefined
            ? { mergeIntoClusterId: input.mergeIntoClusterId }
            : {}),
        })
      }
    }
    return Promise.reject(new Error(`Unknown cluster ${clusterId}`))
  },
  updateFaces: (faceIds, input) => {
    const allFaces = Object.values(FIXTURE_FACES).flat()
    const updated: MediaReviewFace[] = []
    for (const faceId of faceIds) {
      const face = allFaces.find(candidate => candidate.id === faceId)
      if (!face) continue
      updated.push({
        ...face,
        ...(input.reviewStatus !== undefined ? { reviewStatus: input.reviewStatus } : {}),
        ...(input.confirmedName !== undefined ? { confirmedName: input.confirmedName } : {}),
        ...(input.personKey !== undefined ? { personKey: input.personKey } : {}),
      })
    }
    return Promise.resolve(updated)
  },
}
