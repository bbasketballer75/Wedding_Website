/**
 * Media review pipeline — face detection + clustering admin tooling.
 *
 * Tables touched:
 *  - media_review_batches
 *  - media_review_clusters
 *  - media_review_faces
 *  - guest_face_tagging_batches
 *  - storage.objects (for `media-review-artifacts` bucket signed URLs)
 */
import { supabase } from './client'
import type {
  GuestFaceTaggingBatch,
  MediaReviewBatch,
  MediaReviewBatchStatus,
  MediaReviewCluster,
  MediaReviewFace,
  PhotoFace,
  UpdateMediaReviewClusterInput,
  UpdateMediaReviewFaceInput,
} from './types'

export async function fetchMediaReviewBatches() {
  return await supabase
    .from('media_review_batches')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<MediaReviewBatch[]>()
}

/** Paginates through every photos.faces + media_review_faces.confirmed_name
 *  to produce a unique sorted list of known people — used by the admin face
 *  review autocomplete. */
export async function fetchKnownPeopleNames() {
  const names = new Set<string>()
  const pageSize = 500
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('photos')
      .select('faces')
      .range(from, to)
      .returns<Array<{ faces: PhotoFace[] | null }>>()

    if (error) {
      return { data: null, error }
    }

    const rows = data || []
    rows.forEach(row => {
      ;(row.faces || []).forEach(face => {
        const name = face.name?.trim()
        if (name) names.add(name)
      })
    })

    if (rows.length < pageSize) {
      break
    }

    from += pageSize
  }

  const { data: reviewFaces, error: reviewError } = await supabase
    .from('media_review_faces')
    .select('confirmed_name')
    .not('confirmed_name', 'is', null)
    .returns<Array<{ confirmed_name: string | null }>>()

  if (reviewError) {
    return { data: null, error: reviewError }
  }

  ;(reviewFaces || []).forEach(row => {
    const name = row.confirmed_name?.trim()
    if (name) names.add(name)
  })

  return {
    data: [...names].sort((left, right) => left.localeCompare(right)),
    error: null,
  }
}

export async function fetchGuestFaceTaggingBatches() {
  return await supabase
    .from('guest_face_tagging_batches')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<GuestFaceTaggingBatch[]>()
}

export async function fetchMediaReviewClusters(batchId: string) {
  return await supabase
    .from('media_review_clusters')
    .select('*')
    .eq('batch_id', batchId)
    .order('updated_at', { ascending: false })
    .returns<MediaReviewCluster[]>()
}

export async function fetchMediaReviewFaces(batchId: string) {
  return await supabase
    .from('media_review_faces')
    .select('*')
    .eq('batch_id', batchId)
    .order('updated_at', { ascending: false })
    .returns<MediaReviewFace[]>()
}

export async function updateMediaReviewBatchStatus(
  batchId: string,
  status: MediaReviewBatchStatus
) {
  return await supabase
    .from('media_review_batches')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .select('*')
    .single<MediaReviewBatch>()
}

export async function updateMediaReviewCluster(
  clusterId: string,
  input: UpdateMediaReviewClusterInput
) {
  return await supabase
    .from('media_review_clusters')
    .update({
      review_status: input.reviewStatus,
      confirmed_name: input.confirmedName,
      merge_into_cluster_id: input.mergeIntoClusterId,
      split_requested: input.splitRequested,
      split_notes: input.splitNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clusterId)
    .select('*')
    .single<MediaReviewCluster>()
}

export async function updateMediaReviewFace(faceId: string, input: UpdateMediaReviewFaceInput) {
  return await supabase
    .from('media_review_faces')
    .update({
      review_status: input.reviewStatus,
      confirmed_name: input.confirmedName,
      person_key: input.personKey,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', faceId)
    .select('*')
    .single<MediaReviewFace>()
}

export async function updateManyMediaReviewFaces(
  faceIds: string[],
  input: UpdateMediaReviewFaceInput
) {
  return await supabase
    .from('media_review_faces')
    .update({
      review_status: input.reviewStatus,
      confirmed_name: input.confirmedName,
      person_key: input.personKey,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .in('id', faceIds)
    .select('*')
    .returns<MediaReviewFace[]>()
}

export async function createMediaReviewArtifactSignedUrl(
  bucket: string,
  objectPath: string,
  expiresInSeconds = 60 * 60
) {
  return await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresInSeconds)
}

export async function downloadMediaReviewArtifact(bucket: string, objectPath: string) {
  return await supabase.storage.from(bucket).download(objectPath)
}