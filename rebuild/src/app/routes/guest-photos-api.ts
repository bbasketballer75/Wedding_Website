/**
 * App-layer adapter between `shared/data/guestUploads.ts` and the Guest Photos
 * feature's typed `GuestPhotosApi` seam (Wave 9 W9-3).
 *
 * Mirrors the frozen `src/pages/GuestPhotos.tsx` data contract exactly:
 * approved uploads only, upload order preserved, `photo_urls` normalised by the
 * typed data layer, `created_at ?? ''` for the frozen date formatter.
 *
 * The page already does its own defensive approved-only filter + photo mapping;
 * this adapter keeps the same normalisation so the seam is 1:1 with the oracle.
 */
import type { GuestPhotoUpload, GuestPhotosApi, GuestUploadStatus } from '@/features/guest-photos'
import type { TypedSupabaseClient } from '@/shared/data/client'
import { fetchApprovedGuestUploads, type GuestUpload } from '@/shared/data/guestUploads'

function normalizeStatus(upload: GuestUpload): GuestUploadStatus {
  return upload.status === 'approved' || upload.status === 'rejected' ? upload.status : 'pending'
}

/** `GuestUpload` (camelCase typed data layer) -> `GuestPhotoUpload` (feature seam). */
export function mapGuestUpload(upload: GuestUpload): GuestPhotoUpload {
  return {
    id: upload.id,
    guestName: upload.guest_name,
    message: upload.message ?? null,
    createdAt: upload.created_at ?? '',
    photoUrls: [...upload.photoUrls],
    status: normalizeStatus(upload),
  }
}

/** Frozen contact-sheet filter (defensive: the read already filters by status). */
export function selectApprovedUploads(uploads: readonly GuestPhotoUpload[]): GuestPhotoUpload[] {
  return uploads.filter(upload => upload.status === 'approved')
}

export function createGuestPhotosApi(client?: TypedSupabaseClient): GuestPhotosApi {
  return {
    loadApprovedUploads: async () => {
      const uploads =
        client === undefined
          ? await fetchApprovedGuestUploads()
          : await fetchApprovedGuestUploads(client)
      return selectApprovedUploads(uploads.map(mapGuestUpload))
    },
  }
}

/** Default wiring used by the router; tests inject the structural mock client. */
export const guestPhotosApi: GuestPhotosApi = createGuestPhotosApi()
