/**
 * Photo/face claims + permanent guest-share tokens.
 *
 * Frozen surface: `src/lib/supabase/claims.ts` (read queues, claim submission,
 * admin approve/reject, `/guest/:token` aggregation) and
 * `src/pages/GuestShare.tsx` / the claim wizard.
 *
 * Normalisation: nested PostgREST rows are parsed defensively into view models so
 * the UI never touches raw PostgREST shapes. Claim status/type strings are
 * narrowed to unions (the DB CHECK enforces them server-side).
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { callCutoverRpc } from './cutover-rpc'
import { DataError, toDataError, unwrapResult } from './errors'
import { parseGuestbookMessage, type GuestbookMessage } from './guestbook'
import type { GuestUpload } from './guestUploads'
import { mapGuestUploadRow } from './guestUploads'
import { recordModerationAudit, type ModerationAuditActor } from './moderation'
import { fetchPhotosByUrls, parsePhotoRecord, type Photo } from './photos'
import type { Json, TableRow } from './schema'
import { isJsonObject, toJsonObject, toUnknownArray } from './schema'

export type GuestIdentityRow = TableRow<'guest_identities'>
export type PhotoClaimRow = TableRow<'photo_claims'>
export type GuestShareTokenRow = TableRow<'guest_share_tokens'>

/** Claim lifecycle (mirrors the DB CHECK constraint). */
export const PHOTO_CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const
export type PhotoClaimStatus = (typeof PHOTO_CLAIM_STATUSES)[number]

/** Claim kind (mirrors the DB CHECK constraint). */
export const PHOTO_CLAIM_TYPES = ['upload', 'face'] as const
export type PhotoClaimType = (typeof PHOTO_CLAIM_TYPES)[number]

export function isPhotoClaimStatus(value: string | null | undefined): value is PhotoClaimStatus {
  return typeof value === 'string' && (PHOTO_CLAIM_STATUSES as readonly string[]).includes(value)
}

export function isPhotoClaimType(value: string | null | undefined): value is PhotoClaimType {
  return typeof value === 'string' && (PHOTO_CLAIM_TYPES as readonly string[]).includes(value)
}

/** The guest identity attached to a claim. */
export interface ClaimGuestIdentity {
  id: string
  displayName: string
  email: string
}

/** The claimed photo (may be absent for face-only claims with a deleted photo). */
export interface ClaimPhoto {
  id: string
  url: string
  thumbnail: string
  caption: string | null
}

/** Normalised claim row with its related identity/photo. */
export interface PhotoClaim {
  id: string
  status: PhotoClaimStatus
  claimType: PhotoClaimType
  faceId: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  identity: ClaimGuestIdentity | null
  photo: ClaimPhoto | null
}

/** One claim the guest wants to submit. */
export interface ClaimSubmission {
  photoId: string
  faceId?: string | null
  claimType: PhotoClaimType
}

/** Aggregated `/guest/:token` showcase payload. */
export interface GuestContributions {
  guestName: string
  uploads: GuestUpload[]
  guestbook: GuestbookMessage[]
  claimedPhotos: Photo[]
}

const CLAIMS_READ_ERROR = 'Claims are taking a moment. Please try again.'
const CLAIMS_WRITE_ERROR = 'That claim change could not be saved. Please try again.'
const SHARE_TOKEN_ERROR = 'This album link could not be resolved. Please try again.'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseClaimIdentity(raw: unknown): ClaimGuestIdentity | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  if (!id) return null

  return {
    id,
    displayName: asString(record.display_name) ?? 'Guest',
    email: asString(record.email) ?? '',
  }
}

function parseClaimPhoto(raw: unknown): ClaimPhoto | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const url = asString(record.url)
  if (!id || url === null) return null

  return {
    id,
    url,
    thumbnail: asString(record.thumbnail) ?? url,
    caption: asString(record.caption),
  }
}

/**
 * Parse one claim row (tolerates the admin fixture's legacy `claim_type:
 * 'photo'` spelling and nullable relations).
 */
export function parsePhotoClaim(raw: unknown): PhotoClaim | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const status = asString(record.status)
  if (!id || !isPhotoClaimStatus(status)) return null

  const claimTypeRaw = asString(record.claim_type)
  const claimType: PhotoClaimType =
    claimTypeRaw === 'face' ? 'face' : isPhotoClaimType(claimTypeRaw) ? claimTypeRaw : 'upload'

  return {
    id,
    status,
    claimType,
    faceId: asString(record.face_id),
    rejectionReason: asString(record.rejection_reason),
    createdAt: asString(record.created_at) ?? '',
    updatedAt: asString(record.updated_at) ?? '',
    identity: parseClaimIdentity(record.guest_identities),
    photo: parseClaimPhoto(record.photos),
  }
}

/** Parse a list, dropping malformed claims. */
export function parsePhotoClaims(raw: readonly unknown[]): PhotoClaim[] {
  const claims: PhotoClaim[] = []
  for (const entry of raw) {
    const claim = parsePhotoClaim(entry)
    if (claim) claims.push(claim)
  }
  return claims
}

const CLAIM_RELATIONS_SELECT = '*, guest_identities(*), photos(*)'

/** Verified guest identities (admin claim assignment / people view). */
export async function fetchVerifiedIdentities(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestIdentityRow[]> {
  const rows = unwrapResult(
    await client
      .from('guest_identities')
      .select('*')
      .eq('is_verified', true)
      .order('display_name', { ascending: true }),
    CLAIMS_READ_ERROR
  )
  return rows ?? []
}

/** Claims with one status, newest first, with identity + photo embedded. */
export async function fetchClaimsByStatus(
  status: PhotoClaimStatus,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoClaim[]> {
  const { data, error } = await client
    .from('photo_claims')
    .select(CLAIM_RELATIONS_SELECT)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) throw toDataError(error, CLAIMS_READ_ERROR)
  return parsePhotoClaims(data ?? [])
}

/** Pending claims (admin moderation queue). */
export async function fetchPendingClaims(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoClaim[]> {
  return fetchClaimsByStatus('pending', client)
}

/** Approved claims (admin archive). */
export async function fetchApprovedClaims(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoClaim[]> {
  return fetchClaimsByStatus('approved', client)
}

/** Rejected claims (admin archive). */
export async function fetchRejectedClaims(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoClaim[]> {
  return fetchClaimsByStatus('rejected', client)
}

interface FindOrCreateIdentityInput {
  email: string
  displayName: string
  sessionId?: string | null
}

/**
 * Find a guest identity by email or create it.
 *
 * After the D-02 cutover migrations the public table SELECT on
 * `guest_identities` is revoked, so this goes through the SECURITY DEFINER
 * `resolve_guest_identity(email, display_name, session_id)` RPC, which keeps the
 * frozen "update unverified, else find-or-create" behaviour (including the
 * unique-email race) without exposing the table to anon.
 */
export async function findOrCreateGuestIdentity(
  input: FindOrCreateIdentityInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestIdentityRow> {
  const { data, error } = await callCutoverRpc<Record<string, unknown> | null>(
    client,
    'resolve_guest_identity',
    {
      p_email: input.email,
      p_display_name: input.displayName,
      p_session_id: input.sessionId ?? null,
    }
  )

  if (error || !data) throw toDataError(error, CLAIMS_WRITE_ERROR)

  return {
    id: asString(data.id) ?? '',
    email: asString(data.email) ?? input.email,
    display_name: asString(data.display_name) ?? input.displayName,
    session_id: asString(data.session_id),
    is_verified: data.is_verified === true,
    created_at: asString(data.created_at) ?? '',
  }
}

/** Submit one or more photo/face claims for a guest (find-or-create identity first). */
export async function submitPhotoClaims(
  input: {
    email: string
    displayName: string
    claims: readonly ClaimSubmission[]
    sessionId?: string | null
  },
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoClaimRow[]> {
  if (input.claims.length === 0) return []

  const identity = await findOrCreateGuestIdentity(
    { email: input.email, displayName: input.displayName, sessionId: input.sessionId },
    client
  )

  const rows = unwrapResult(
    await client
      .from('photo_claims')
      .insert(
        input.claims.map(claim => ({
          guest_identity_id: identity.id,
          photo_id: claim.photoId,
          face_id: claim.faceId ?? null,
          claim_type: claim.claimType,
          status: 'pending' as const,
        }))
      )
      .select('*'),
    CLAIMS_WRITE_ERROR
  )

  return rows ?? []
}

async function updateClaimStatus(
  claimId: string,
  patch: { status: PhotoClaimStatus; rejection_reason?: string | null },
  client: TypedSupabaseClient
): Promise<void> {
  const { error } = await client
    .from('photo_claims')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', claimId)

  if (error) throw toDataError(error, CLAIMS_WRITE_ERROR)
}

/** Approve a claim: verify identity, sync face name, audit (frozen transition). */
export async function approvePhotoClaim(
  claimId: string,
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  const { data: claim, error } = await client
    .from('photo_claims')
    .select(CLAIM_RELATIONS_SELECT)
    .eq('id', claimId)
    .maybeSingle()

  if (error) throw toDataError(error, CLAIMS_READ_ERROR)
  const parsed = claim ? parsePhotoClaim(claim) : null
  if (!parsed) {
    throw new DataError({
      message: CLAIMS_WRITE_ERROR,
      code: 'not-found:claim',
      cause: { claimId },
    })
  }

  await updateClaimStatus(claimId, { status: 'approved' }, client)

  if (parsed.identity) {
    const { error: identityError } = await client
      .from('guest_identities')
      .update({ is_verified: true })
      .eq('id', parsed.identity.id)
    if (identityError) throw toDataError(identityError, CLAIMS_WRITE_ERROR)
  }

  if (parsed.claimType === 'face' && parsed.faceId) {
    const { error: faceError } = await client
      .from('media_review_faces')
      .update({
        confirmed_name: parsed.identity?.displayName ?? null,
        review_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.faceId)
    if (faceError) throw toDataError(faceError, CLAIMS_WRITE_ERROR)
  }

  await recordModerationAudit(
    {
      entityType: 'photo_claim',
      entityId: claimId,
      action: 'claim_approved',
      fromStatus: parsed.status,
      toStatus: 'approved',
      summary: parsed.identity
        ? `Approved ${parsed.claimType} claim for ${parsed.identity.displayName} (${parsed.identity.email})`
        : `Approved ${parsed.claimType} claim`,
      actor,
    },
    client
  )
}

/** Reject a claim with an optional reason + audit (frozen transition). */
export async function rejectPhotoClaim(
  claimId: string,
  reason?: string,
  actor?: ModerationAuditActor | null,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  const { data: claim, error } = await client
    .from('photo_claims')
    .select(CLAIM_RELATIONS_SELECT)
    .eq('id', claimId)
    .maybeSingle()

  if (error) throw toDataError(error, CLAIMS_READ_ERROR)
  const parsed = claim ? parsePhotoClaim(claim) : null
  if (!parsed) {
    throw new DataError({
      message: CLAIMS_WRITE_ERROR,
      code: 'not-found:claim',
      cause: { claimId },
    })
  }

  await updateClaimStatus(claimId, { status: 'rejected', rejection_reason: reason ?? null }, client)

  await recordModerationAudit(
    {
      entityType: 'photo_claim',
      entityId: claimId,
      action: 'claim_rejected',
      fromStatus: parsed.status,
      toStatus: 'rejected',
      summary: reason
        ? `Rejected ${parsed.claimType} claim for ${parsed.identity?.displayName ?? 'a guest'}: ${reason}`
        : `Rejected ${parsed.claimType} claim`,
      metadata: reason ? { rejection_reason: reason } : {},
      actor,
    },
    client
  )
}

/**
 * Photos a guest could claim: the gallery photos matching their approved upload
 * URLs (claim wizard).
 */
export async function fetchPotentialPhotosToClaimByEmail(
  email: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const { data, error } = await client
    .from('guest_uploads')
    .select('photo_urls')
    .eq('guest_email', email)
    .eq('status', 'approved')

  if (error) throw toDataError(error, CLAIMS_READ_ERROR)

  const urls = (data ?? []).flatMap(upload => upload.photo_urls ?? [])
  if (urls.length === 0) return []

  return fetchPhotosByUrls(urls, client)
}

/**
 * Guest's permanent share token: existing token or a freshly generated one.
 *
 * The public table read/write on `guest_share_tokens` is revoked by the D-02
 * migrations; the SECURITY DEFINER `get_or_create_share_token(email, upload_id)`
 * RPC only returns a token for the owner of a known (unguessable) upload row, so
 * knowing an email is not enough to enumerate share links.
 */
export async function getOrCreateShareToken(
  email: string,
  uploadId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<string> {
  const { data, error } = await callCutoverRpc<string | null>(client, 'get_or_create_share_token', {
    p_email: email.trim().toLowerCase(),
    p_upload_id: uploadId,
  })

  if (error || typeof data !== 'string' || data.length === 0) {
    throw toDataError(error ?? new Error('token could not be created'), SHARE_TOKEN_ERROR)
  }
  return data
}

/**
 * Pure aggregation helper (exported for fixture tests): accepts the raw DB
 * responses and produces the normalised contributions object, or `null` when the
 * token row is absent. Display-name resolution mirrors the frozen page:
 * identity → first guestbook name → first upload guest name → "Special Guest".
 */
export function resolveGuestContributions(input: {
  tokenRow: unknown
  uploads: readonly unknown[]
  guestbookRows: readonly unknown[]
  identityRow: unknown
}): GuestContributions | null {
  if (!isJsonObject(input.tokenRow as Json | null)) return null

  const uploads: GuestUpload[] = []
  for (const raw of input.uploads) {
    if (!isJsonObject(raw as Json | null)) continue
    uploads.push(mapGuestUploadRow({ ...EMPTY_GUEST_UPLOAD, ...(raw as object) }))
  }

  const guestbook: GuestbookMessage[] = []
  for (const raw of input.guestbookRows) {
    const message = parseGuestbookMessage(raw)
    if (message) guestbook.push(message)
  }

  const claimedPhotos: Photo[] = []
  const identity = toJsonObject(input.identityRow)
  const claims = toUnknownArray(identity?.photo_claims)
  if (claims) {
    for (const rawClaim of claims) {
      const claim = toJsonObject(rawClaim)
      if (!claim || claim.status !== 'approved') continue
      const photo = parsePhotoRecord(claim.photos)
      if (photo) claimedPhotos.push(photo)
    }
  }

  // Frozen precedence: identity display name, then the uploading guest's name on
  // the approved upload (the album owner), then a guestbook author, then a
  // generic label. Preferring the guestbook author first showed the wrong album
  // owner on /guest/:token when other guests wrote notes under the same email.
  let guestName = ''
  const displayName = identity?.display_name
  if (typeof displayName === 'string') guestName = displayName
  if (!guestName && uploads.length > 0) guestName = uploads[0]?.guest_name ?? ''
  if (!guestName && guestbook.length > 0) guestName = guestbook[0]?.name ?? ''
  if (!guestName) guestName = 'Special Guest'

  return { guestName, uploads, guestbook, claimedPhotos }
}

// Minimal upload row used to normalise partial fixture rows; values are replaced
// by the spread of the raw object.
const EMPTY_GUEST_UPLOAD: Parameters<typeof mapGuestUploadRow>[0] = {
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

/**
 * Fetch a guest's showcase by token. Returns `null` for an unknown token so the
 * page can render its friendly "link unresolved" state.
 *
 * The whole aggregate comes from one SECURITY DEFINER RPC after the D-02
 * migrations revoke public table reads on `guest_share_tokens` and
 * `guest_identities`. Keeping the payload shape close to the old multi-query
 * result means `resolveGuestContributions` (and its fixture tests) still own the
 * normalisation.
 */
export async function fetchGuestContributionsByToken(
  token: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestContributions | null> {
  const { data, error } = await callCutoverRpc<Record<string, unknown> | null>(
    client,
    'get_guest_contributions',
    { p_token: token }
  )

  if (error) throw toDataError(error, SHARE_TOKEN_ERROR)
  if (!data) return null

  const tokenRow = toJsonObject(data.token)
  const identityRow = toJsonObject(data.identity)
  const uploads = toUnknownArray(data.uploads as Json | undefined) ?? []
  const guestbookRows = toUnknownArray(data.guestbook as Json | undefined) ?? []

  const resolved = resolveGuestContributions({ tokenRow, uploads, guestbookRows, identityRow })
  if (!resolved) return null

  // Prefer the identity name when the aggregate row exposes one.
  const displayName = identityRow?.display_name
  if (typeof displayName === 'string' && displayName.length > 0) {
    return { ...resolved, guestName: displayName }
  }

  return resolved
}
