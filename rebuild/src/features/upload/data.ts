/**
 * Guest-upload data boundary (Wave 6 W6-2).
 *
 * Deterministic stubs + the typed `UploadApi` contract the page injects.
 *
 * TODO(Wave3): the Lead wires the real boundaries:
 *   requestUploadSlot   -> POST '/.netlify/functions/guest-upload-url' ({ uploadUrl, publicUrl })
 *   insertGuestUpload   -> guest_uploads insert (status 'pending'); NOTE: shared/data/guestUploads.ts
 *                          does not export an insert helper yet — it must be added there (or in a
 *                          thin app route) with this input shape.
 *   getOrCreateShareToken -> shared/data/claims.ts getOrCreateShareToken(email)  (same signature)
 *   lookupClaimIdentity -> claims identity lookup seam (ClaimModal/claims wizard is W5-2 scope)
 */
import type { ClaimIdentityLookup, UploadApi, UploadSlotRequest } from './types'

/** Deterministic stub used by the page until the real route supplies the API. */
export function createStubUploadApi(): UploadApi {
  let slotCount = 0
  let insertCount = 0
  let tokenCount = 0

  return {
    requestUploadSlot: (request: UploadSlotRequest) => {
      slotCount += 1
      const extension = request.contentType.startsWith('video/')
        ? 'mp4'
        : (request.contentType.split('/')[1] ?? 'bin')
      return Promise.resolve({
        uploadUrl: `https://r2.example.test/guest-uploads/slot-${slotCount}`,
        publicUrl: `https://media.theporadas.test/guest-uploads/${slotCount}.${extension}`,
      })
    },
    insertGuestUpload: () => {
      insertCount += 1
      return Promise.resolve({ id: `stub-guest-upload-${insertCount}` })
    },
    getOrCreateShareToken: (email: string) => {
      tokenCount += 1
      const slug = email
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      return Promise.resolve(`token-${slug || 'guest'}-${tokenCount}`)
    },
    lookupClaimIdentity: (email: string): Promise<ClaimIdentityLookup> => {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed.includes('@')) {
        return Promise.resolve({
          found: false,
          guestName: null,
          uploadCount: 0,
          claimablePhotoCount: 0,
        })
      }
      return Promise.resolve({
        found: true,
        guestName: 'Jamie Rivera',
        uploadCount: 3,
        claimablePhotoCount: 3,
      })
    },
  }
}
