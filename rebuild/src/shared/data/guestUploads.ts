/**
 * Guest uploads — public reads, status page, film highlights, publishing to the
 * gallery and the admin moderation transitions.
 *
 * Frozen surface: `src/lib/supabase/guestUploads.ts`, `src/pages/Film.tsx`
 * (approved guest video reel), `src/pages/GuestPhotos.tsx` (approved feed) and
 * `src/pages/upload/*` (status by email).
 *
 * Every moderation transition writes a `moderation_audit_log` entry with the
 * acting admin (mirrors the frozen module); caller decides whether a failed audit
 * write should abort, here it is awaited so tests/telemetry see it.
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { DataError, toDataError, unwrapResult } from './errors'
import { recordModerationAudit, type ModerationAuditActor } from './moderation'
import type { TableInsert, TableRow } from './schema'
import { isPhotoAlbum, type PhotoAlbum } from './photos'

export type GuestUploadRow = TableRow<'guest_uploads'>

/** Moderation states (mirrors the DB CHECK constraint). */
export const GUEST_UPLOAD_STATUSES = ['pending', 'approved', 'rejected'] as const
export type GuestUploadStatus = (typeof GUEST_UPLOAD_STATUSES)[number]

/** Whether/how a guest video may appear in the film page. */
export const GUEST_VIDEO_VISIBILITIES = ['archive_only', 'guest_highlights', 'featured'] as const
export type GuestVideoVisibility = (typeof GUEST_VIDEO_VISIBILITIES)[number]

export function isGuestUploadStatus(value: string | null | undefined): value is GuestUploadStatus {
  return typeof value === 'string' && (GUEST_UPLOAD_STATUSES as readonly string[]).includes(value)
}

export function isGuestVideoVisibility(
  value: string | null | undefined
): value is GuestVideoVisibility {
  return (
    typeof value === 'string' && (GUEST_VIDEO_VISIBILITIES as readonly string[]).includes(value)
  )
}

/**
 * Normalised guest upload. Reuses every generated row column, replacing only the
 * nullable string-array columns and the two text state columns with the shapes
 * the UI consumes.
 */
export interface GuestUpload extends Omit<
  GuestUploadRow,
  | 'status'
  | 'video_visibility'
  | 'photo_urls'
  | 'video_urls'
  | 'photo_fingerprints'
  | 'video_fingerprints'
> {
  status: GuestUploadStatus
  videoVisibility: GuestVideoVisibility
  photoUrls: string[]
  videoUrls: string[]
  photoFingerprints: string[]
  videoFingerprints: string[]
}

/** One guest video as rendered by the film page's highlights reel. */
export interface FilmHighlight {
  id: string
  uploadId: string
  guestName: string
  title: string
  description: string
  videoUrl: string
  createdAt: string
  badge: string
  memoryTrail: string | null
}

const GUEST_UPLOAD_READ_ERROR = 'Guest memories are taking a moment. Please try again.'
const GUEST_UPLOAD_WRITE_ERROR = 'That guest upload change could not be saved. Please try again.'

function readStringArray(value: readonly string[] | null | undefined): string[] {
  if (!value) return []
  return [...value]
}

/** Map a generated row to the normalised view model. */
export function mapGuestUploadRow(row: GuestUploadRow): GuestUpload {
  return {
    ...row,
    status: isGuestUploadStatus(row.status) ? row.status : 'pending',
    videoVisibility: isGuestVideoVisibility(row.video_visibility)
      ? row.video_visibility
      : 'archive_only',
    photoUrls: readStringArray(row.photo_urls),
    videoUrls: readStringArray(row.video_urls),
    photoFingerprints: readStringArray(row.photo_fingerprints),
    videoFingerprints: readStringArray(row.video_fingerprints),
  }
}

/** Map a list of rows. */
export function mapGuestUploadRows(rows: readonly GuestUploadRow[]): GuestUpload[] {
  return rows.map(mapGuestUploadRow)
}

/**
 * Film page guest-video filter (frozen `Film.tsx` logic):
 * keep uploads with a video whose visibility is not `archive_only`, prefer
 * `guest_highlights`/`featured`, keep the newest order, cap at `limit`.
 */
export function selectFilmHighlights(uploads: readonly GuestUpload[], limit = 6): GuestUpload[] {
  const visibilityScore = (upload: GuestUpload): number =>
    upload.videoVisibility === 'guest_highlights' || upload.videoVisibility === 'featured' ? 1 : 0

  return uploads
    .filter(upload => upload.videoUrls.length > 0)
    .filter(upload => upload.videoVisibility !== 'archive_only')
    .sort((left, right) => visibilityScore(right) - visibilityScore(left))
    .slice(0, limit)
}

/** Map filtered uploads to the film reel's view model (frozen copy defaults). */
export function mapFilmHighlights(uploads: readonly GuestUpload[]): FilmHighlight[] {
  return uploads.map((upload, index) => {
    const videoUrl = upload.videoUrls[0]
    if (!videoUrl) {
      throw new DataError({
        message: GUEST_UPLOAD_READ_ERROR,
        code: 'data:missing-video',
        cause: { uploadId: upload.id },
      })
    }

    const trimmedMessage = upload.message?.trim() ?? ''

    return {
      id: `${upload.id}-${index}`,
      uploadId: upload.id,
      guestName: upload.guest_name,
      title: trimmedMessage || `A moment from ${upload.guest_name}`,
      description:
        trimmedMessage ||
        'A little handheld piece of the day, straight from the room and exactly how it felt to be there.',
      videoUrl,
      createdAt: upload.created_at ?? '',
      badge: 'From your phones',
      memoryTrail: upload.memory_trail,
    }
  })
}

async function fetchUploads(
  status: GuestUploadStatus | null,
  client: TypedSupabaseClient,
  limit?: number
): Promise<GuestUpload[]> {
  let query = client.from('guest_uploads').select('*')
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false })
  if (limit !== undefined) query = query.limit(limit)

  const rows = unwrapResult(await query, GUEST_UPLOAD_READ_ERROR)
  return mapGuestUploadRows(rows ?? [])
}

/** Approved uploads (public feeds: home reel, /guest-photos, film). */
export async function fetchApprovedGuestUploads(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestUpload[]> {
  return fetchUploads('approved', client)
}

/** Pending uploads (admin queue). */
export async function fetchPendingGuestUploads(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestUpload[]> {
  return fetchUploads('pending', client)
}

/** Uploads by explicit status (admin tabs). */
export async function fetchGuestUploadsByStatus(
  status: GuestUploadStatus,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestUpload[]> {
  return fetchUploads(status, client)
}

/** Approved uploads that carry a video, newest first, before film filtering. */
export async function fetchApprovedGuestVideoUploads(
  limit = 12,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestUpload[]> {
  const uploads = await fetchUploads('approved', client, limit)
  return uploads.filter(upload => upload.videoUrls.length > 0)
}

/** Film page: filtered + mapped guest highlights (max 6). */
export async function fetchFilmGuestHighlights(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<FilmHighlight[]> {
  const uploads = await fetchApprovedGuestVideoUploads(12, client)
  return mapFilmHighlights(selectFilmHighlights(uploads, 6))
}

/**
 * Status page: newest upload for a guest email, or `null` when none/denied.
 * The frozen app returns `null` on any error here so the page can show a neutral
 * "nothing yet" state; we keep that behaviour explicit.
 */
export async function fetchGuestUploadStatusByEmail(
  email: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestUpload | null> {
  const { data, error } = await client
    .from('guest_uploads')
    .select(
      'id, status, rejection_reason, created_at, photo_urls, photo_fingerprints, video_urls, video_fingerprints, guest_name, guest_email, message'
    )
    .eq('guest_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return mapGuestUploadRow({ ...emptyGuestUploadRow(), ...data })
}

function emptyGuestUploadRow(): GuestUploadRow {
  return {
    id: '',
    guest_name: '',
    guest_email: '',
    message: null,
    photo_urls: null,
    video_urls: null,
    status: 'pending',
    created_at: null,
    video_visibility: 'archive_only',
    memory_trail: null,
    editorial_title: null,
    editorial_summary: null,
    featured_rank: null,
    photo_fingerprints: [],
    video_fingerprints: [],
    rejection_reason: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Moderation transitions (admin)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchUploadStatus(
  uploadId: string,
  client: TypedSupabaseClient
): Promise<string | null> {
  const { data, error } = await client
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .maybeSingle()

  if (error) return null
  return data?.status ?? null
}

/** Approve one upload (pending/rejected → approved) and audit the transition. */
export async function approveGuestUpload(
  uploadId: string,
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  const fromStatus = await fetchUploadStatus(uploadId, client)

  const { error } = await client
    .from('guest_uploads')
    .update({ status: 'approved' })
    .eq('id', uploadId)
  if (error) throw toDataError(error, GUEST_UPLOAD_WRITE_ERROR)

  await recordModerationAudit(
    {
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_approved_published',
      fromStatus,
      toStatus: 'approved',
      summary: 'Guest upload approved',
      actor,
    },
    client
  )
}

/** Reject one upload with an optional reason and audit the transition. */
export async function rejectGuestUpload(
  uploadId: string,
  reason?: string,
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  const fromStatus = await fetchUploadStatus(uploadId, client)

  const { error } = await client
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .eq('id', uploadId)
  if (error) throw toDataError(error, GUEST_UPLOAD_WRITE_ERROR)

  await recordModerationAudit(
    {
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_rejected',
      fromStatus,
      toStatus: 'rejected',
      summary: reason ? `Guest upload rejected: ${reason}` : 'Guest upload rejected',
      metadata: reason ? { rejection_reason: reason } : {},
      actor,
    },
    client
  )
}

/** Bulk approve (admin queue) — audits each upload. */
export async function bulkApproveGuestUploads(
  uploadIds: readonly string[],
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  if (uploadIds.length === 0) return

  const { error } = await client
    .from('guest_uploads')
    .update({ status: 'approved' })
    .in('id', [...uploadIds])
  if (error) throw toDataError(error, GUEST_UPLOAD_WRITE_ERROR)

  for (const uploadId of uploadIds) {
    await recordModerationAudit(
      {
        entityType: 'guest_upload',
        entityId: uploadId,
        action: 'upload_approved_published',
        fromStatus: 'pending',
        toStatus: 'approved',
        summary: 'Guest upload bulk approved',
        actor,
      },
      client
    )
  }
}

/** Bulk reject (admin queue) — audits each upload. */
export async function bulkRejectGuestUploads(
  uploadIds: readonly string[],
  reason?: string,
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  if (uploadIds.length === 0) return

  const { error } = await client
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .in('id', [...uploadIds])
  if (error) throw toDataError(error, GUEST_UPLOAD_WRITE_ERROR)

  for (const uploadId of uploadIds) {
    await recordModerationAudit(
      {
        entityType: 'guest_upload',
        entityId: uploadId,
        action: 'upload_bulk_rejected',
        fromStatus: 'pending',
        toStatus: 'rejected',
        summary: reason ? `Guest upload bulk rejected: ${reason}` : 'Guest upload bulk rejected',
        metadata: reason ? { rejection_reason: reason } : {},
        actor,
      },
      client
    )
  }
}

/**
 * Publish approved upload photos into the gallery: each `photo_urls` entry
 * becomes a `photos` row in the target album (frozen behaviour; no link back to
 * the upload is stored in the baseline schema).
 */
export async function publishGuestUploadPhotosToAlbum(
  uploadIds: readonly string[],
  album: PhotoAlbum,
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<{ published: number }> {
  if (uploadIds.length === 0) return { published: 0 }
  if (!isPhotoAlbum(album)) {
    throw new DataError({
      message: GUEST_UPLOAD_WRITE_ERROR,
      code: 'validation:album',
      cause: { album },
    })
  }

  const uploads = unwrapResult(
    await client
      .from('guest_uploads')
      .select('id, guest_name, photo_urls')
      .in('id', [...uploadIds]),
    GUEST_UPLOAD_READ_ERROR
  )

  const photoRows: TableInsert<'photos'>[] = []
  for (const upload of uploads ?? []) {
    const urls = readStringArray(upload.photo_urls)
    for (const url of urls) {
      photoRows.push({
        url,
        thumbnail: url,
        album,
        category: album,
        is_professional: false,
        caption: upload.guest_name ? `Photo by ${upload.guest_name}` : null,
      })
    }
  }

  if (photoRows.length === 0) return { published: 0 }

  const inserted = unwrapResult(
    await client.from('photos').insert(photoRows).select('id'),
    GUEST_UPLOAD_WRITE_ERROR
  )

  for (const uploadId of uploadIds) {
    await recordModerationAudit(
      {
        entityType: 'guest_upload',
        entityId: uploadId,
        action: 'upload_approved_published',
        fromStatus: 'approved',
        toStatus: 'approved',
        summary: `Guest upload photos published to ${album} album`,
        metadata: { album },
        actor,
      },
      client
    )
  }

  return { published: (inserted ?? []).length }
}

/**
 * Create a guest upload row from the public Upload page.
 *
 * The cutover RLS bundle enables RLS on `guest_uploads`; PostgREST's
 * `Prefer: return=representation` (RETURNING) needs a SELECT policy the anon
 * uploader does not have, so the row id is generated client-side and the insert
 * is performed WITHOUT `.select()`. The id is then used as the ownership proof
 * for `get_or_create_share_token(p_email, p_upload_id)`.
 */
export async function createGuestUpload(
  input: {
    guestName: string
    guestEmail: string
    message: string | null
    photoUrls: readonly string[]
    photoFingerprints: readonly string[]
    videoUrls: readonly string[]
    videoFingerprints: readonly string[]
  },
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  const { error } = await client.from('guest_uploads').insert({
    id,
    guest_name: input.guestName,
    guest_email: input.guestEmail,
    message: input.message,
    photo_urls: [...input.photoUrls],
    video_urls: [...input.videoUrls],
    photo_fingerprints: [...input.photoFingerprints],
    video_fingerprints: [...input.videoFingerprints],
    status: 'pending',
  })

  if (error) throw toDataError(error, GUEST_UPLOAD_WRITE_ERROR ?? 'Upload could not be saved.')
  return { id }
}
