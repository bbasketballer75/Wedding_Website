/**
 * Media-review pipeline (face detection batches to clusters to faces) and the
 * guest face-tagging batches. Admin-only in the database (RLS `is_admin()`).
 *
 * Frozen surface: `src/lib/supabase/mediaReview.ts` and the admin
 * `/admin/review` panel, plus the private Storage bucket `media-review-artifacts`
 * (signed URLs).
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { DataError, toDataError, unwrapResult } from './errors'
import type { Json, TableRow } from './schema'
import { isJsonObject } from './schema'

export type MediaReviewBatchRow = TableRow<'media_review_batches'>
export type MediaReviewClusterRow = TableRow<'media_review_clusters'>
export type MediaReviewFaceRow = TableRow<'media_review_faces'>
export type GuestFaceTaggingBatchRow = TableRow<'guest_face_tagging_batches'>

/** Batch lifecycle (mirrors the DB CHECK constraint). */
export const MEDIA_REVIEW_BATCH_STATUSES = ['pending', 'in_review', 'approved', 'archived'] as const
export type MediaReviewBatchStatus = (typeof MEDIA_REVIEW_BATCH_STATUSES)[number]

/** Cluster review states (mirrors the DB CHECK constraint). */
export const MEDIA_REVIEW_CLUSTER_STATUSES = [
  'pending',
  'confirmed',
  'ignored',
  'merged',
  'split_requested',
] as const
export type MediaReviewClusterStatus = (typeof MEDIA_REVIEW_CLUSTER_STATUSES)[number]

/** Face review states (mirrors the DB CHECK constraint). */
export const MEDIA_REVIEW_FACE_STATUSES = ['pending', 'confirmed', 'ignored'] as const
export type MediaReviewFaceStatus = (typeof MEDIA_REVIEW_FACE_STATUSES)[number]

/** Guest tagging batch states (mirrors the DB CHECK constraint). */
export const GUEST_FACE_TAGGING_STATUSES = ['prepared', 'synced', 'failed'] as const
export type GuestFaceTaggingBatchStatus = (typeof GUEST_FACE_TAGGING_STATUSES)[number]

export function isMediaReviewClusterStatus(
  value: string | null | undefined
): value is MediaReviewClusterStatus {
  return (
    typeof value === 'string' &&
    (MEDIA_REVIEW_CLUSTER_STATUSES as readonly string[]).includes(value)
  )
}

/** One cluster member as stored in `media_review_clusters.members` jsonb. */
export interface MediaReviewClusterMember {
  faceId: string | null
  sourceRelativePath: string | null
  thumbnailPath: string | null
  x: number
  y: number
}

/** Normalised batch view model. */
export interface MediaReviewBatch {
  id: string
  batchKey: string
  label: string
  status: MediaReviewBatchStatus
  artifactBucket: string
  artifactPrefix: string
  artifactPaths: Record<string, Json>
  clusterCount: number
  detectionCount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Normalised cluster view model (members parsed from jsonb). */
export interface MediaReviewCluster {
  id: string
  batchId: string
  clusterId: string
  reviewStatus: MediaReviewClusterStatus
  confirmedName: string | null
  mergeIntoClusterId: string | null
  splitRequested: boolean
  sampleThumbnailPath: string | null
  memberCount: number
  members: MediaReviewClusterMember[]
  createdAt: string
  updatedAt: string
}

/** Normalised face view model. */
export interface MediaReviewFace {
  id: string
  batchId: string
  faceId: string
  clusterId: string | null
  photoUrl: string | null
  thumbnailUrl: string | null
  x: number
  y: number
  reviewStatus: MediaReviewFaceStatus
  confirmedName: string | null
  personKey: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Normalised guest face-tagging batch. */
export interface GuestFaceTaggingBatch {
  id: string
  batchKey: string
  label: string
  status: GuestFaceTaggingBatchStatus
  exportableUploadCount: number
  exportablePhotoCount: number
  syncedPhotoCount: number
  skippedPhotoCount: number
  lastError: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Patch accepted by the cluster editor. */
export interface UpdateMediaReviewClusterInput {
  reviewStatus?: MediaReviewClusterStatus
  confirmedName?: string | null
  mergeIntoClusterId?: string | null
  splitRequested?: boolean
  splitNotes?: string | null
}

/** Patch accepted by the face editor. */
export interface UpdateMediaReviewFaceInput {
  reviewStatus?: MediaReviewFaceStatus
  confirmedName?: string | null
  personKey?: string | null
  notes?: string | null
}

const REVIEW_READ_ERROR = 'The review queue is taking a moment. Please try again.'
const REVIEW_WRITE_ERROR = 'That review change could not be saved. Please try again.'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNumber(value: Json | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseClusterMembers(value: Json | null | undefined): MediaReviewClusterMember[] {
  if (!Array.isArray(value)) return []

  const members: MediaReviewClusterMember[] = []
  for (const entry of value) {
    if (!isJsonObject(entry)) continue
    members.push({
      faceId: asString(entry.faceId),
      sourceRelativePath: asString(entry.sourceRelativePath),
      thumbnailPath: asString(entry.thumbnailPath),
      x: readNumber(entry.x, 0),
      y: readNumber(entry.y, 0),
    })
  }
  return members
}

function parseArtifactPaths(value: Json | null | undefined): Record<string, Json> {
  if (!isJsonObject(value)) return {}

  const paths: Record<string, Json> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) paths[key] = entry
  }
  return paths
}

function mapBatchRow(row: MediaReviewBatchRow): MediaReviewBatch {
  const status = row.status
  return {
    id: row.id,
    batchKey: row.batch_key,
    label: row.label,
    status: (MEDIA_REVIEW_BATCH_STATUSES as readonly string[]).includes(status)
      ? (status as MediaReviewBatchStatus)
      : 'pending',
    artifactBucket: row.artifact_bucket,
    artifactPrefix: row.artifact_prefix,
    artifactPaths: parseArtifactPaths(row.artifact_paths),
    clusterCount: row.cluster_count,
    detectionCount: row.detection_count,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapClusterRow(row: MediaReviewClusterRow): MediaReviewCluster {
  return {
    id: row.id,
    batchId: row.batch_id,
    clusterId: row.cluster_id,
    reviewStatus: isMediaReviewClusterStatus(row.review_status) ? row.review_status : 'pending',
    confirmedName: row.confirmed_name,
    mergeIntoClusterId: row.merge_into_cluster_id,
    splitRequested: row.split_requested,
    sampleThumbnailPath: row.sample_thumbnail_path,
    memberCount: row.member_count,
    members: parseClusterMembers(row.members),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapFaceRow(row: MediaReviewFaceRow): MediaReviewFace {
  const status = row.review_status
  return {
    id: row.id,
    batchId: row.batch_id,
    faceId: row.face_id,
    clusterId: row.cluster_id,
    photoUrl: row.photo_url,
    thumbnailUrl: row.thumbnail_url,
    x: Number(row.x),
    y: Number(row.y),
    reviewStatus: (MEDIA_REVIEW_FACE_STATUSES as readonly string[]).includes(status)
      ? (status as MediaReviewFaceStatus)
      : 'pending',
    confirmedName: row.confirmed_name,
    personKey: row.person_key,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTaggingBatchRow(row: GuestFaceTaggingBatchRow): GuestFaceTaggingBatch {
  const status = row.status
  return {
    id: row.id,
    batchKey: row.batch_key,
    label: row.label,
    status: (GUEST_FACE_TAGGING_STATUSES as readonly string[]).includes(status)
      ? (status as GuestFaceTaggingBatchStatus)
      : 'prepared',
    exportableUploadCount: row.exportable_upload_count,
    exportablePhotoCount: row.exportable_photo_count,
    syncedPhotoCount: row.synced_photo_count,
    skippedPhotoCount: row.skipped_photo_count,
    lastError: row.last_error,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** All review batches, newest update first. */
export async function fetchMediaReviewBatches(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewBatch[]> {
  const rows = unwrapResult(
    await client.from('media_review_batches').select('*').order('updated_at', { ascending: false }),
    REVIEW_READ_ERROR
  )
  return (rows ?? []).map(mapBatchRow)
}

/** Clusters for one batch, newest update first. */
export async function fetchMediaReviewClusters(
  batchId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewCluster[]> {
  const rows = unwrapResult(
    await client
      .from('media_review_clusters')
      .select('*')
      .eq('batch_id', batchId)
      .order('updated_at', { ascending: false }),
    REVIEW_READ_ERROR
  )
  return (rows ?? []).map(mapClusterRow)
}

/** Faces for one batch, newest update first. */
export async function fetchMediaReviewFaces(
  batchId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewFace[]> {
  const rows = unwrapResult(
    await client
      .from('media_review_faces')
      .select('*')
      .eq('batch_id', batchId)
      .order('updated_at', { ascending: false }),
    REVIEW_READ_ERROR
  )
  return (rows ?? []).map(mapFaceRow)
}

/** Guest face-tagging batches (export/sync pipeline), newest update first. */
export async function fetchGuestFaceTaggingBatches(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestFaceTaggingBatch[]> {
  const rows = unwrapResult(
    await client
      .from('guest_face_tagging_batches')
      .select('*')
      .order('updated_at', { ascending: false }),
    REVIEW_READ_ERROR
  )
  return (rows ?? []).map(mapTaggingBatchRow)
}

/** Advance a batch's lifecycle status. */
export async function updateMediaReviewBatchStatus(
  batchId: string,
  status: MediaReviewBatchStatus,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewBatch> {
  const row = unwrapResult(
    await client
      .from('media_review_batches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', batchId)
      .select('*')
      .maybeSingle(),
    REVIEW_WRITE_ERROR
  )

  if (!row) {
    throw new DataError({
      message: REVIEW_WRITE_ERROR,
      code: 'not-found:batch',
      cause: { batchId },
    })
  }
  return mapBatchRow(row)
}

/** Patch a cluster (confirm / ignore / merge / split request). */
export async function updateMediaReviewCluster(
  clusterId: string,
  input: UpdateMediaReviewClusterInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewCluster> {
  const row = unwrapResult(
    await client
      .from('media_review_clusters')
      .update({
        ...(input.reviewStatus !== undefined ? { review_status: input.reviewStatus } : {}),
        ...(input.confirmedName !== undefined ? { confirmed_name: input.confirmedName } : {}),
        ...(input.mergeIntoClusterId !== undefined
          ? { merge_into_cluster_id: input.mergeIntoClusterId }
          : {}),
        ...(input.splitRequested !== undefined ? { split_requested: input.splitRequested } : {}),
        ...(input.splitNotes !== undefined ? { split_notes: input.splitNotes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', clusterId)
      .select('*')
      .maybeSingle(),
    REVIEW_WRITE_ERROR
  )

  if (!row) {
    throw new DataError({
      message: REVIEW_WRITE_ERROR,
      code: 'not-found:cluster',
      cause: { clusterId },
    })
  }
  return mapClusterRow(row)
}

/** Patch one face (confirm name / ignore). */
export async function updateMediaReviewFace(
  faceId: string,
  input: UpdateMediaReviewFaceInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewFace> {
  const rows = unwrapResult(
    await client
      .from('media_review_faces')
      .update({
        ...(input.reviewStatus !== undefined ? { review_status: input.reviewStatus } : {}),
        ...(input.confirmedName !== undefined ? { confirmed_name: input.confirmedName } : {}),
        ...(input.personKey !== undefined ? { person_key: input.personKey } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', faceId)
      .select('*'),
    REVIEW_WRITE_ERROR
  )

  const row = (rows ?? [])[0]
  if (!row) {
    throw new DataError({
      message: REVIEW_WRITE_ERROR,
      code: 'not-found:face',
      cause: { faceId },
    })
  }
  return mapFaceRow(row)
}

/** Patch many faces with the same fields (bulk confirm in the review panel). */
export async function updateManyMediaReviewFaces(
  faceIds: readonly string[],
  input: UpdateMediaReviewFaceInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<MediaReviewFace[]> {
  if (faceIds.length === 0) return []

  const rows = unwrapResult(
    await client
      .from('media_review_faces')
      .update({
        ...(input.reviewStatus !== undefined ? { review_status: input.reviewStatus } : {}),
        ...(input.confirmedName !== undefined ? { confirmed_name: input.confirmedName } : {}),
        ...(input.personKey !== undefined ? { person_key: input.personKey } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .in('id', [...faceIds])
      .select('*'),
    REVIEW_WRITE_ERROR
  )

  return (rows ?? []).map(mapFaceRow)
}

/**
 * Known people names for the review autocomplete: union of every
 * `photos.faces[].name` (paged by 500) and `media_review_faces.confirmed_name`,
 * sorted alphabetically. Frozen behaviour: a paging/read error aborts the union.
 */
export async function fetchKnownPeopleNames(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<string[]> {
  const names = new Set<string>()
  const pageSize = 500
  let from = 0

  while (true) {
    const rows = unwrapResult(
      await client
        .from('photos')
        .select('faces')
        .range(from, from + pageSize - 1),
      REVIEW_READ_ERROR
    )
    const pageRows = rows ?? []

    for (const row of pageRows) {
      if (!Array.isArray(row.faces)) continue
      for (const face of row.faces) {
        if (!isJsonObject(face)) continue
        const name = asString(face.name)
        const trimmed = name?.trim()
        if (trimmed) names.add(trimmed)
      }
    }

    if (pageRows.length < pageSize) break
    from += pageSize
  }

  const { data: confirmations, error } = await client
    .from('media_review_faces')
    .select('confirmed_name')
    .not('confirmed_name', 'is', null)

  if (error) throw toDataError(error, REVIEW_READ_ERROR)

  for (const row of confirmations ?? []) {
    const trimmed = row.confirmed_name?.trim()
    if (trimmed) names.add(trimmed)
  }

  return [...names].sort((left, right) => left.localeCompare(right))
}

/**
 * Signed URL for one private review artifact (bucket `media-review-artifacts`).
 * Default expiry: 1 hour (frozen behaviour).
 */
export async function createMediaReviewArtifactSignedUrl(
  bucket: string,
  objectPath: string,
  client: TypedSupabaseClient = getSupabaseClient(),
  expiresInSeconds = 60 * 60
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds)
  if (error) throw toDataError(error, REVIEW_READ_ERROR)
  return data.signedUrl
}

/** Download one private review artifact as a Blob. */
export async function downloadMediaReviewArtifact(
  bucket: string,
  objectPath: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Blob> {
  const { data, error } = await client.storage.from(bucket).download(objectPath)
  if (error) throw toDataError(error, REVIEW_READ_ERROR)
  return data
}
