/**
 * Guest Photos feature types (Wave 6 W6-3).
 *
 * Shape mirrors the typed data layer's normalised `GuestUpload`
 * (`src/shared/data/guestUploads.ts`) so the Lead's wiring is a mechanical map:
 *
 *   id        <- GuestUpload.id
 *   guestName <- GuestUpload.guest_name
 *   message   <- GuestUpload.message
 *   photoUrls <- GuestUpload.photoUrls
 *   status    <- GuestUpload.status
 *   createdAt <- GuestUpload.created_at ?? ''
 *
 * Deliberately decoupled: this feature never imports `shared/data`.
 */

/** Upload moderation states (mirrors the DB CHECK constraint). */
export type GuestUploadStatus = 'approved' | 'pending' | 'rejected'

/** One guest upload as rendered by the contact sheet. */
export interface GuestPhotoUpload {
  id: string
  guestName: string
  message: string | null
  createdAt: string
  photoUrls: string[]
  status: GuestUploadStatus
}

/** A featured thumbnail (first `FEATURED_PHOTO_LIMIT` photos, in order). */
export interface FeaturedGuestPhoto {
  url: string
  guestName: string
}

export interface GuestPhotosStats {
  /** Count of approved uploads (frozen "Approved uploads" stat). */
  approvedUploads: number
  /** Count of photos across those uploads (frozen "Guest photos" stat). */
  guestPhotos: number
}

/**
 * Injected typed data boundary. The single method maps to
 * `fetchApprovedGuestUploads()` in `shared/data/guestUploads.ts` (the Lead's
 * wiring adapter maps the rows to `GuestPhotoUpload` — see `./data.ts`).
 */
export interface GuestPhotosApi {
  loadApprovedUploads: () => Promise<GuestPhotoUpload[]>
}
