/**
 * Guest uploads — public submission (`/upload`) + admin moderation.
 *
 * Every state transition (approve / reject / bulk / publish) calls
 * `recordModerationAudit` so the admin audit log stays in sync.
 */
import { supabase } from './client'
import { recordModerationAudit } from './moderation'
import type { GuestUpload, ModerationAuditActor, PhotoAlbum } from './types'

export async function fetchApprovedGuestUploads(): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchPendingGuestUploads(): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchGuestUploadsByStatus(
  status: 'pending' | 'approved' | 'rejected'
): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function approveGuestUpload(
  uploadId: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: existing } = await supabase
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .single()

  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'approved' })
    .eq('id', uploadId)

  if (error) throw error

  await recordModerationAudit({
    entityType: 'guest_upload',
    entityId: uploadId,
    action: 'upload_approved_published',
    fromStatus: existing?.status ?? null,
    toStatus: 'approved',
    summary: `Guest upload approved`,
    actor,
  })
}

export async function rejectGuestUpload(
  uploadId: string,
  reason?: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: existing } = await supabase
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .single()

  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .eq('id', uploadId)

  if (error) throw error

  await recordModerationAudit({
    entityType: 'guest_upload',
    entityId: uploadId,
    action: 'upload_rejected',
    fromStatus: existing?.status ?? null,
    toStatus: 'rejected',
    summary: reason ? `Guest upload rejected: ${reason}` : `Guest upload rejected`,
    metadata: reason ? { rejection_reason: reason } : {},
    actor,
  })
}

export async function bulkApproveGuestUploads(
  uploadIds: string[],
  actor?: ModerationAuditActor
): Promise<void> {
  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'approved' })
    .in('id', uploadIds)

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_approved_published',
      fromStatus: 'pending',
      toStatus: 'approved',
      summary: `Guest upload bulk approved`,
      actor,
    })
  }
}

export async function bulkRejectGuestUploads(
  uploadIds: string[],
  reason?: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .in('id', uploadIds)

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_bulk_rejected',
      fromStatus: 'pending',
      toStatus: 'rejected',
      summary: reason ? `Guest upload bulk rejected: ${reason}` : `Guest upload bulk rejected`,
      metadata: reason ? { rejection_reason: reason } : {},
      actor,
    })
  }
}

/**
 * Publish selected guest upload photos to the main photos gallery under an
 * album. Each photo_url in the selected uploads is inserted as a new photos
 * row so it appears in the live gallery alongside professional photos.
 */
export async function publishGuestUploadPhotosToAlbum(
  uploadIds: string[],
  album: PhotoAlbum,
  actor?: ModerationAuditActor
): Promise<{ published: number }> {
  if (uploadIds.length === 0) return { published: 0 }

  const { data: uploads, error: fetchError } = await supabase
    .from('guest_uploads')
    .select('id, guest_name, photo_urls')
    .in('id', uploadIds)

  if (fetchError) throw fetchError

  const photoRows = (uploads ?? []).flatMap(
    (upload: { id: string; guest_name: string; photo_urls: string[] }) =>
      upload.photo_urls.map(url => ({
        url,
        thumbnail: url,
        album,
        category: album,
        is_professional: false,
        caption: upload.guest_name ? `Photo by ${upload.guest_name}` : null,
      }))
  )

  if (photoRows.length === 0) return { published: 0 }

  const { data, error } = await supabase.from('photos').insert(photoRows).select('id')

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_approved_published',
      fromStatus: 'approved',
      toStatus: 'approved',
      summary: `Guest upload photos published to ${album} album`,
      metadata: { album },
      actor,
    })
  }

  return { published: data?.length ?? 0 }
}

/** Fetch rejection reason for the guest upload status page. */
export async function fetchGuestUploadStatus(email: string): Promise<GuestUpload | null> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select(
      'id, status, rejection_reason, created_at, photo_urls, photo_fingerprints, video_urls, video_fingerprints, guest_name, guest_email, message'
    )
    .eq('guest_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}