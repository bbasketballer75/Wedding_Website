/**
 * Photo claiming + share tokens.
 *
 * Powers the `/guest/:token` showcase page (one URL per guest, aggregating
 * their approved uploads, guestbook messages, and claimed photos) plus the
 * claim wizard and the admin claim moderation queue.
 *
 * Cross-module deps:
 *  - `./moderation` for recordModerationAudit (admin approve/reject)
 *  - `./photos` for fetchPhotosByUrls (used by fetchPotentialPhotosToClaimByEmail)
 */
import { supabase } from './client'
import { recordModerationAudit } from './moderation'
import { fetchPhotosByUrls } from './photos'
import type { GuestIdentity, ModerationAuditActor, Photo, PhotoClaim } from './types'

// ──────────────────────────────────────────────────────────────────────────
// Read APIs (public + admin)
// ──────────────────────────────────────────────────────────────────────────

/** Fetch all guest identities that have been verified. */
export async function fetchVerifiedIdentities(): Promise<GuestIdentity[]> {
  const { data, error } = await supabase
    .from('guest_identities')
    .select('*')
    .eq('is_verified', true)
    .order('display_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Fetch all pending claims in the moderation queue (Admin only). */
export async function fetchPendingClaims(): Promise<PhotoClaim[]> {
  const { data, error } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*), photos(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PhotoClaim[]
}

export async function fetchApprovedClaims(): Promise<PhotoClaim[]> {
  const { data, error } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*), photos(*)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PhotoClaim[]
}

export async function fetchRejectedClaims(): Promise<PhotoClaim[]> {
  const { data, error } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*), photos(*)')
    .eq('status', 'rejected')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PhotoClaim[]
}

// ──────────────────────────────────────────────────────────────────────────
// Write APIs (public + admin)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Submits one or more photo/face claims for a guest.
 * Finds or creates the guest_identities record first.
 */
export async function submitClaims(
  email: string,
  displayName: string,
  claims: Array<{ photoId: string; faceId?: string | null; claimType: 'upload' | 'face' }>,
  sessionId?: string | null
): Promise<any[]> {
  if (claims.length === 0) return []

  // 1. Find or create guest identity
  const { data: existingIdentity } = await supabase
    .from('guest_identities')
    .select('id, is_verified')
    .eq('email', email)
    .maybeSingle()

  let identityId: string
  if (existingIdentity) {
    identityId = existingIdentity.id
    if (!existingIdentity.is_verified) {
      await supabase
        .from('guest_identities')
        .update({ display_name: displayName, session_id: sessionId ?? null })
        .eq('id', identityId)
    }
  } else {
    const { data: newIdentity, error: insertError } = await supabase
      .from('guest_identities')
      .insert({
        email,
        display_name: displayName,
        session_id: sessionId ?? null,
        is_verified: false,
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    identityId = newIdentity.id
  }

  // 2. Submit claims bulk
  const claimInserts = claims.map(c => ({
    guest_identity_id: identityId,
    photo_id: c.photoId,
    face_id: c.faceId ?? null,
    claim_type: c.claimType,
    status: 'pending',
  }))

  const { data, error } = await supabase.from('photo_claims').insert(claimInserts).select('*')

  if (error) throw error
  return data ?? []
}

/** Wrapper to submit a single photo upload claim. */
export async function submitPhotoClaim(
  email: string,
  displayName: string,
  photoId: string,
  sessionId?: string | null
): Promise<any> {
  const claims = [{ photoId, claimType: 'upload' as const }]
  const results = await submitClaims(email, displayName, claims, sessionId)
  return results[0]
}

/** Wrapper to submit a single face cluster claim. */
export async function submitFaceClaim(
  email: string,
  displayName: string,
  photoId: string,
  faceId: string,
  sessionId?: string | null
): Promise<any> {
  const claims = [{ photoId, faceId, claimType: 'face' as const }]
  const results = await submitClaims(email, displayName, claims, sessionId)
  return results[0]
}

/** Approve a guest's photo or face claim (Admin only). */
export async function approvePhotoClaim(
  claimId: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: claim, error: fetchError } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*)')
    .eq('id', claimId)
    .single()

  if (fetchError || !claim) throw new Error('Claim not found')

  const identity = claim.guest_identities

  // 1. Update claim status
  const { error: updateClaimError } = await supabase
    .from('photo_claims')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', claimId)

  if (updateClaimError) throw updateClaimError

  // 2. Mark identity as verified
  const { error: updateIdentityError } = await supabase
    .from('guest_identities')
    .update({ is_verified: true })
    .eq('id', claim.guest_identity_id)

  if (updateIdentityError) throw updateIdentityError

  // 3. If it's a face claim, sync with media_review_faces
  if (claim.claim_type === 'face' && claim.face_id) {
    const { error: syncError } = await supabase
      .from('media_review_faces')
      .update({
        confirmed_name: identity.display_name,
        review_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim.face_id)
    if (syncError) console.error('Error syncing face cluster name:', syncError)
  }

  // 4. Log moderation audit
  await recordModerationAudit({
    entityType: 'photo_claim',
    entityId: claimId,
    action: 'claim_approved',
    fromStatus: 'pending',
    toStatus: 'approved',
    summary: `Approved ${claim.claim_type} claim for ${identity.display_name} (${identity.email})`,
    actor,
  })
}

/** Reject a guest's photo or face claim with an optional reason (Admin only). */
export async function rejectPhotoClaim(
  claimId: string,
  reason?: string,
  actor?: ModerationAuditActor
): Promise<void> {
  const { data: claim, error: fetchError } = await supabase
    .from('photo_claims')
    .select('*, guest_identities(*)')
    .eq('id', claimId)
    .single()

  if (fetchError || !claim) throw new Error('Claim not found')

  const identity = claim.guest_identities

  // 1. Update claim status
  const { error: updateClaimError } = await supabase
    .from('photo_claims')
    .update({
      status: 'rejected',
      rejection_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)

  if (updateClaimError) throw updateClaimError

  // 2. Log moderation audit
  await recordModerationAudit({
    entityType: 'photo_claim',
    entityId: claimId,
    action: 'claim_rejected',
    fromStatus: 'pending',
    toStatus: 'rejected',
    summary: reason
      ? `Rejected ${claim.claim_type} claim for ${identity.display_name} (${identity.email}): ${reason}`
      : `Rejected ${claim.claim_type} claim for ${identity.display_name} (${identity.email})`,
    metadata: reason ? { rejection_reason: reason } : {},
    actor,
  })
}

/** Fetch all approved uploads' photos by guest email — used by claim wizard. */
export async function fetchPotentialPhotosToClaimByEmail(email: string): Promise<Photo[]> {
  const { data: uploads, error } = await supabase
    .from('guest_uploads')
    .select('photo_urls')
    .eq('guest_email', email)
    .eq('status', 'approved')

  if (error) throw error
  if (!uploads || uploads.length === 0) return []

  const allUrls = uploads.flatMap(u => u.photo_urls || [])
  if (allUrls.length === 0) return []

  return await fetchPhotosByUrls(allUrls)
}

// ──────────────────────────────────────────────────────────────────────────
// Share tokens (family-share showcase)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Get or create a persistent guest sharing token for a given email.
 * Race-condition safe: if two callers race on insert, the loser retries.
 */
export async function getOrCreateShareToken(email: string): Promise<string> {
  const formattedEmail = email.trim().toLowerCase()

  // 1. Try to fetch existing token
  const { data } = await supabase
    .from('guest_share_tokens')
    .select('token')
    .eq('guest_email', formattedEmail)
    .maybeSingle()

  if (data?.token) {
    return data.token
  }

  // 2. Generate a new unique token if not found
  const newToken = crypto.randomUUID()
  const { data: inserted, error: insertError } = await supabase
    .from('guest_share_tokens')
    .insert({
      guest_email: formattedEmail,
      token: newToken,
    })
    .select('token')
    .single()

  if (insertError) {
    // Handle race conditions where another call inserted first
    const { data: retryData } = await supabase
      .from('guest_share_tokens')
      .select('token')
      .eq('guest_email', formattedEmail)
      .maybeSingle()

    if (retryData?.token) {
      return retryData.token
    }
    throw insertError
  }

  return inserted.token
}

/**
 * Fetch all guest contributions (uploads, guestbook, claimed photos) by their unique share token.
 */
export async function fetchGuestContributionsByToken(token: string): Promise<{
  guestName: string
  uploads: any[]
  guestbook: any[]
  claimedPhotos: any[]
} | null> {
  // 1. Fetch token and associated email
  const { data: tokenData, error: tokenError } = await supabase
    .from('guest_share_tokens')
    .select('guest_email')
    .eq('token', token)
    .maybeSingle()

  if (tokenError || !tokenData) {
    return null
  }

  const email = tokenData.guest_email

  // 2. Parallel queries for efficiency
  const [uploadsRes, guestbookRes, claimedRes, identityRes] = await Promise.all([
    // Fetch approved guest uploads matching the email
    supabase
      .from('guest_uploads')
      .select('*')
      .eq('guest_email', email)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),

    // Fetch guestbook messages matching the email
    supabase
      .from('guestbook_messages')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false }),

    // Fetch approved claimed photos by guest identity email
    supabase
      .from('guest_identities')
      .select('id, photo_claims(*, photos(*))')
      .eq('email', email)
      .eq('is_verified', true)
      .maybeSingle(),

    // Fetch any identity record to get verified name
    supabase.from('guest_identities').select('display_name').eq('email', email).maybeSingle(),
  ])

  const uploads = uploadsRes.data ?? []
  const guestbook = guestbookRes.data ?? []

  // Resolve claimed photos
  const claimedPhotos: any[] = []
  if (claimedRes.data?.photo_claims) {
    const claims = claimedRes.data.photo_claims as any[]
    claims.forEach(claim => {
      if (claim.status === 'approved' && claim.photos) {
        claimedPhotos.push(claim.photos)
      }
    })
  }

  // Resolve display name
  let guestName = identityRes.data?.display_name || ''
  if (!guestName && guestbook.length > 0) {
    guestName = guestbook[0].name
  }
  if (!guestName && uploads.length > 0) {
    guestName = uploads[0].guest_name
  }
  if (!guestName) {
    guestName = 'Special Guest'
  }

  return {
    guestName,
    uploads,
    guestbook,
    claimedPhotos,
  }
}