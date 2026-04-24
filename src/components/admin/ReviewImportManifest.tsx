import { supabase } from '@/lib/supabase'
import {
  updateMediaReviewBatchStatus,
  type MediaReviewBatch,
  type MediaReviewFace,
} from '@/lib/supabase'
import type { ReviewImportManifestRow } from './MediaReviewPanel'

// Constants
const PHOTO_LOOKUP_CHUNK_SIZE = 40

// Types (duplicated here to avoid circular imports - in a real refactor these would be in a shared types file)
interface PhotoRowForReview {
  id: string
  url: string
  thumbnail: string
  category: string
  location: string | null
  date: string | null
  tags: string[]
  faces: Array<{
    id: string
    name: string
    x: number
    y: number
    box?: {
      left: number
      top: number
      width: number
      height: number
    } | null
  }>
}

interface PhotoFace {
  id: string
  name: string
  x: number
  y: number
  box?: {
    left: number
    top: number
    width: number
    height: number
  } | null
}

// Utility functions
function toSiteMediaPath(relativePath: string) {
  if (!relativePath) return ''
  if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith('/')) {
    return relativePath
  }
  return `/media/${relativePath.replace(/^\/+/, '')}`
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function fetchPhotosForReview(urls: string[]) {
  const photos: PhotoRowForReview[] = []

  for (const urlChunk of chunkItems(urls, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, thumbnail, category, location, date, tags, faces')
      .in('url', urlChunk)
      .returns<PhotoRowForReview[]>()

    if (error) {
      return { data: null, error }
    }

    photos.push(...(data || []))
  }

  return { data: photos, error: null }
}

async function persistPhotoUpdates(
  updates: Array<Record<string, unknown> & { id: string }>,
) {
  for (const update of updates) {
    const { id, ...fields } = update
    const { error } = await supabase
      .from('photos')
      .update(fields)
      .eq('id', id)

    if (error) {
      return { error }
    }
  }

  return { error: null }
}

/**
 * Syncs manifest metadata (category, tags, etc.) back to the published photos
 * and updates the batch status to 'in_review'.
 */
export async function handleSyncManifestMetadata(
  batch: MediaReviewBatch,
  importRows: ReviewImportManifestRow[],
  onSuccess: (message: string) => void,
  onError: (message: string) => void,
) {
  const syncingBatchId = batch.id

  const urls = importRows.map((row) => toSiteMediaPath(row.photoRowDraft.url))
  const { data: photos, error: photoError } = await fetchPhotosForReview(urls)

  if (photoError) {
    onError('Could not load the published photos for this batch.')
    return
  }

  const updates = (photos || []).flatMap((photo) => {
    const row = importRows.find((item) => toSiteMediaPath(item.photoRowDraft.url) === photo.url)
    if (!row) return []

    return [{
      id: photo.id,
      thumbnail: toSiteMediaPath(row.photoRowDraft.thumbnail),
      category: row.photoRowDraft.category,
      location: row.photoRowDraft.location,
      date: row.photoRowDraft.date,
      tags: row.photoRowDraft.tags,
    }]
  })

  if (updates.length > 0) {
    const { error: updateError } = await persistPhotoUpdates(updates)

    if (updateError) {
      onError('Could not sync the manifest metadata back into photos.')
      return
    }
  }

  await updateMediaReviewBatchStatus(syncingBatchId, 'in_review')
  onSuccess('Manifest category and tag suggestions were synced to the live photos.')
}

/**
 * Applies confirmed face tags from the review batch back to the published photos,
 * promoting face metadata and merging tags. Updates batch status to 'approved'.
 */
export async function handleApplyConfirmedFaces(
  batch: MediaReviewBatch,
  faces: MediaReviewFace[],
  importRows: ReviewImportManifestRow[],
  onSuccess: (message: string) => void,
  onError: (message: string) => void,
) {
  const syncingBatchId = batch.id

  const confirmedFaces = faces.filter(
    (face) => face.review_status === 'confirmed' && face.confirmed_name && face.source_record_id,
  )

  if (confirmedFaces.length === 0) {
    onError('There are no confirmed faces to apply yet.')
    return
  }

  const manifestBySourceRecordId = new Map(
    importRows
      .filter((row) => row.sourceRecordId)
      .map((row) => [row.sourceRecordId as string, row]),
  )

  const urls = importRows.map((row) => toSiteMediaPath(row.photoRowDraft.url))
  const { data: photos, error: photoError } = await fetchPhotosForReview(urls)

  if (photoError) {
    onError('Could not load the published photos for face-tag promotion.')
    return
  }

  const photoByUrl = new Map((photos || []).map((photo) => [photo.url, photo]))
  const batchFaceIdsByRecordId = new Map<string, Set<string>>()

  for (const face of faces) {
    if (!face.source_record_id) continue
    const current = batchFaceIdsByRecordId.get(face.source_record_id) || new Set<string>()
    current.add(face.face_id)
    batchFaceIdsByRecordId.set(face.source_record_id, current)
  }

  const confirmedFacesByRecordId = new Map<string, MediaReviewFace[]>()
  for (const face of confirmedFaces) {
    const current = confirmedFacesByRecordId.get(face.source_record_id as string) || []
    current.push(face)
    confirmedFacesByRecordId.set(face.source_record_id as string, current)
  }

  const pendingUpdates = new Map<string, PhotoRowForReview & { tags: string[]; faces: PhotoFace[] }>()

  for (const [sourceRecordId, recordFaces] of confirmedFacesByRecordId.entries()) {
    const manifestRow = manifestBySourceRecordId.get(sourceRecordId)
    if (!manifestRow) continue

    const url = toSiteMediaPath(manifestRow.photoRowDraft.url)
    const currentPhoto = pendingUpdates.get(url) || photoByUrl.get(url)
    if (!currentPhoto) continue

    const existingFaces = Array.isArray(currentPhoto.faces) ? currentPhoto.faces : []
    const batchFaceIds = batchFaceIdsByRecordId.get(sourceRecordId) || new Set<string>()
    const baseFaces = existingFaces.filter((face) => !batchFaceIds.has(String(face.id)))
    const nextFaces = recordFaces.map((face) => ({
      id: face.face_id,
      name: face.confirmed_name || 'Unknown',
      x: face.x,
      y: face.y,
      box: face.box
        ? {
            left: Number(face.box.left ?? 0),
            top: Number(face.box.top ?? 0),
            width: Number(face.box.width ?? 0),
            height: Number(face.box.height ?? 0),
          }
        : null,
    }))
    const mergedTags = Array.from(
      new Set([
        ...(Array.isArray(currentPhoto.tags) ? currentPhoto.tags : []),
        ...manifestRow.photoRowDraft.tags,
        ...recordFaces.map((face) => (face.confirmed_name || '').toLowerCase()).filter(Boolean),
      ]),
    )

    pendingUpdates.set(url, {
      ...currentPhoto,
      tags: mergedTags,
      faces: [...baseFaces, ...nextFaces],
    })
  }

  const updates = [...pendingUpdates.values()].map((photo) => ({
    id: photo.id,
    tags: photo.tags,
    faces: photo.faces,
  }))

  if (updates.length > 0) {
    const { error: updateError } = await persistPhotoUpdates(updates)

    if (updateError) {
      onError('Could not apply the confirmed face tags to the live photos.')
      return
    }
  }

  await updateMediaReviewBatchStatus(syncingBatchId, 'approved')
  onSuccess(`Applied confirmed face tags from ${confirmedFaces.length} face${confirmedFaces.length === 1 ? '' : 's'}.`)
}
