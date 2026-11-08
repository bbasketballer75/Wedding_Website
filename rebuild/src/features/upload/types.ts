/**
 * Guest-upload feature types.
 *
 * The injected `UploadApi` in `./data.ts` mirrors the frozen boundaries
 * (`netlify/functions/guest-upload-url.ts` + `shared/data/guestUploads.ts` +
 * `shared/data/claims.ts`), so the Lead can wire the real functions without any
 * component change:
 *   requestUploadSlot -> POST /.netlify/functions/guest-upload-url → { uploadUrl, publicUrl }
 *   insertGuestUpload -> guest_uploads insert (status 'pending')
 *   getOrCreateShareToken -> shared/data/claims.ts getOrCreateShareToken(email)
 *   lookupClaimIdentity -> claims identity lookup seam (ClaimModal is W5-2 scope)
 */

export type UploadStatus = 'uploading' | 'complete' | 'error'

export interface UploadingFile {
  id: string
  file: File
  status: UploadStatus
  preview?: string
  publicUrl?: string
  errorMessage?: string
  /** XHR upload progress 0-100 while `status === 'uploading'`. */
  progress?: number
}

export interface StoredUploadMetadata {
  id: string
  name: string
  type: string
  size: number
  fingerprint: string
  /** Base64 data URL preview (images) restored across sessions. */
  preview: string
  status: 'uploading' | 'paused' | 'error'
  progress?: number
  createdAt: number
}

export interface UploadSlot {
  uploadUrl: string
  publicUrl: string
}

export interface UploadSlotRequest {
  contentType: string
  contentLength: number
}

export interface GuestUploadInsertInput {
  guestName: string
  guestEmail: string
  message: string | null
  photoUrls: string[]
  photoFingerprints: string[]
  videoUrls: string[]
  videoFingerprints: string[]
}

export interface GuestUploadInsertResult {
  id: string
}

export interface ClaimIdentityLookup {
  found: boolean
  guestName: string | null
  uploadCount: number
  claimablePhotoCount: number
}

/** The typed boundary the page injects; the Lead swaps this for real modules. */
export interface UploadApi {
  requestUploadSlot: (request: UploadSlotRequest) => Promise<UploadSlot>
  insertGuestUpload: (input: GuestUploadInsertInput) => Promise<GuestUploadInsertResult>
  getOrCreateShareToken: (email: string) => Promise<string>
  lookupClaimIdentity: (email: string) => Promise<ClaimIdentityLookup>
}

/** `localStorage`-shaped seam so tests inject an in-memory queue store. */
export interface UploadStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}
