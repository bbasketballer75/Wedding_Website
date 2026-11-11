/**
 * Real public-upload adapter.
 *
 * Mirrors the frozen boundaries documented in `types.ts`:
 * - `requestUploadSlot` -> POST `<SUPABASE_URL>/functions/v1/guest-upload-url`
 *   (Supabase Edge Function on the dedicated project; the legacy Netlify
 *   function of the same contract remains for the old deploy).
 * - `insertGuestUpload` -> `shared/data/guestUploads.createGuestUpload`
 *   (client-generated id, no RETURNING, RLS-safe).
 * - `getOrCreateShareToken` -> `shared/data/claims.getOrCreateShareToken`
 *   (upload-id-gated SECURITY DEFINER RPC).
 * - `lookupClaimIdentity` is a seam for the (not yet wired) claim wizard; the
 *   token-gated claim lookup is the owner-ratified design (D-09/R19).
 *
 * Active only when `VITE_UPLOAD_MODE=live` so the parity harness, unit tests and
 * local stub flows never hit the network.
 */
import { readAppEnv } from '@/app/env'
import { getOrCreateShareToken } from '@/shared/data/claims'
import { createGuestUpload } from '@/shared/data/guestUploads'
import type {
  ClaimIdentityLookup,
  GuestUploadInsertInput,
  UploadApi,
  UploadSlot,
  UploadSlotRequest,
} from './types'

function edgeFunctionUrl(name: string): string {
  const env = readAppEnv()
  return `${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`
}

async function requestUploadSlot(request: UploadSlotRequest): Promise<UploadSlot> {
  const env = readAppEnv()
  const response = await fetch(edgeFunctionUrl('guest-upload-url'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contentType: request.contentType,
      contentLength: request.contentLength,
    }),
  })

  if (!response.ok) {
    throw new Error(`Upload URL request failed (${response.status})`)
  }

  const payload = (await response.json()) as { uploadUrl?: unknown; publicUrl?: unknown }
  if (typeof payload.uploadUrl !== 'string' || typeof payload.publicUrl !== 'string') {
    throw new Error('Upload URL response was malformed')
  }
  return { uploadUrl: payload.uploadUrl, publicUrl: payload.publicUrl }
}

async function insertGuestUpload(input: GuestUploadInsertInput): Promise<{ id: string }> {
  return createGuestUpload({
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    message: input.message,
    photoUrls: input.photoUrls,
    photoFingerprints: input.photoFingerprints,
    videoUrls: input.videoUrls,
    videoFingerprints: input.videoFingerprints,
  })
}

async function getOrCreateShareTokenForUpload(email: string, uploadId: string): Promise<string> {
  return getOrCreateShareToken(email, uploadId)
}

// Seam only: the claim wizard is not wired in the rebuild yet. The
// owner-ratified design (D-09/R19) gates this behind the share token, so a
// plain email lookup intentionally returns nothing. Fewer parameters is
// assignable to the UploadApi signature.
function lookupClaimIdentity(): Promise<ClaimIdentityLookup> {
  return Promise.resolve({ found: false, guestName: null, uploadCount: 0, claimablePhotoCount: 0 })
}

export function createSupabaseUploadApi(): UploadApi {
  return {
    requestUploadSlot,
    insertGuestUpload,
    getOrCreateShareToken: getOrCreateShareTokenForUpload,
    lookupClaimIdentity,
  }
}
