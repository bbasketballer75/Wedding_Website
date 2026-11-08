/**
 * Admin data + auth boundary (Wave 7 W7-1).
 *
 * This module is the ONLY place the admin UI talks to data or auth. It ships a
 * typed, deterministic in-memory implementation for Wave 7 so the shell, pages,
 * tests and parity captures are stable before the shared data layer is bound.
 *
 * TODO(Wave3): the Lead replaces `createInMemoryAdminApi()` with adapters over
 * `shared/data`:
 *   fetchDashboardCounts  -> `fetchDashboardCounts()` + W7-2 review/tagging counts
 *   fetchUploads          -> `fetchGuestUploadsByStatus(status)`
 *   moderateUpload        -> `approveGuestUpload` / `rejectGuestUpload` (both audit internally)
 *   bulkModerate          -> `bulkApproveGuestUploads` / `bulkRejectGuestUploads`
 *   publishToAlbum        -> `publishGuestUploadPhotosToAlbum(ids, album, actor)`
 *   fetchGuestbookMessages-> admin read of `guestbook_messages` (email-bearing raw rows)
 *   deleteGuestbookMessages -> `deleteGuestbookMessages(ids)` + audit per message
 *   fetchClaims           -> `fetchClaimsByStatus(status)`
 *   moderateClaim         -> `approvePhotoClaim` / `rejectPhotoClaim` (both audit internally)
 *   fetchAuditLog         -> `fetchModerationAuditTimeline({ limit: 500 })`
 *   logAudit              -> `recordModerationAudit(input)`
 * When those are wired, `AdminApi.logAudit` is the audit sink that
 * `onAudit` observes; page components never call it separately, so a real data
 * layer that audits inside its mutations will not double-log.
 */
import type { Json } from '@/shared/data/schema'
import type { GuestUpload } from '@/shared/data/guestUploads'
import type { PhotoClaim } from '@/shared/data/claims'
import type {
  DashboardCounts,
  ModerationAuditAction,
  ModerationAuditActor,
  ModerationAuditEntry,
  ModerationEntityType,
} from '@/shared/data/moderation'
import type { PhotoAlbum } from '@/shared/data/photos'
import { ADMIN_AUDIT_SEED, ADMIN_FIXED_NOW, ADMIN_FIXTURES } from './fixtures'

// ─── Routing model ──────────────────────────────────────────────────────────

export const ADMIN_SECTIONS = [
  'dashboard',
  'photos',
  'albums',
  'review',
  'claims',
  'guestbook',
  'featured',
  'audit',
  'analytics',
  'settings',
] as const

export type AdminSection = (typeof ADMIN_SECTIONS)[number]

/** Sections owned by W7-1 (this task). The rest are W7-2 seams. */
export const W7_1_SECTIONS: readonly AdminSection[] = [
  'dashboard',
  'photos',
  'claims',
  'guestbook',
  'audit',
]

// ─── Auth seam ──────────────────────────────────────────────────────────────

/** Authenticated admin user as the admin UI consumes it. */
export interface AdminUser {
  id: string
  email: string | null
  /** Display name from user metadata; falls back to the email local-part. */
  name: string
  /**
   * Role from **app_metadata** only (server-set, not user-spoofable). Null when
   * the session has no app metadata.
   */
  role: string | null
}

export interface AdminAuthSnapshot {
  user: AdminUser | null
  isLoading: boolean
  isAuthenticated: boolean
  /** True only when `app_metadata.role === 'admin'`. */
  isAdmin: boolean
}

export interface AdminSignInResult {
  success: boolean
  /** Human-readable failure copy (frozen store wording). */
  error?: string
}

/**
 * External-store auth client the admin feature renders from.
 *
 * The default `createInMemoryAuthClient()` is the Wave-7 stub. For the real app,
 * `createSnapshotAuthClient()` wraps a snapshot produced by `shared/data`'s
 * `useAuth()` hook: the host component re-renders on auth changes and passes a
 * fresh snapshot; `signIn`/`signOut` delegate to the shared data functions.
 */
export interface AdminAuthClient {
  getSnapshot: () => AdminAuthSnapshot
  subscribe: (listener: () => void) => () => void
  signIn: (email: string, password: string) => Promise<AdminSignInResult>
  signOut: () => Promise<void>
}

export interface StubAuthCredentials {
  email: string
  password: string
  user: AdminUser
}

/** Allowlist for `isAdmin` — app_metadata only, never user_metadata. */
export function isAdminRoleMetadata(appMetadata: unknown): boolean {
  if (typeof appMetadata !== 'object' || appMetadata === null) {
    return false
  }
  return (appMetadata as Record<string, unknown>).role === 'admin'
}

export function createSnapshotAuthClient(
  snapshot: AdminAuthSnapshot,
  actions: Pick<AdminAuthClient, 'signIn' | 'signOut'>
): AdminAuthClient {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    signIn: actions.signIn,
    signOut: actions.signOut,
  }
}

export function createInMemoryAuthClient(options: {
  credentials?: readonly StubAuthCredentials[]
  initialUser?: AdminUser | null
}): AdminAuthClient {
  const credentials = options.credentials ?? ADMIN_FIXTURES.credentials
  const listeners = new Set<() => void>()
  let user: AdminUser | null = options.initialUser ?? null

  const buildSnapshot = (): AdminAuthSnapshot => ({
    user,
    isLoading: false,
    isAuthenticated: user !== null,
    isAdmin: isAdminRoleMetadata({ role: user?.role }),
  })

  // A stable snapshot object is required by useSyncExternalStore: returning a
  // fresh object on every call makes React believe the store changed forever.
  let snapshot: AdminAuthSnapshot = buildSnapshot()

  const notify = () => {
    snapshot = buildSnapshot()
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    signIn: (email, password) => {
      const match = credentials.find(entry => entry.email === email.trim())
      if (!match || match.password !== password) {
        return Promise.resolve({ success: false, error: 'Invalid email or password' })
      }
      user = match.user
      notify()
      return Promise.resolve({ success: true })
    },
    signOut: () => {
      user = null
      notify()
      return Promise.resolve()
    },
  }
}

// ─── Admin data view models ─────────────────────────────────────────────────

/** Upload row shown in the moderation queue (shared `GuestUpload` shape). */
export type AdminUpload = GuestUpload

/** Admin guestbook row: the public message shape plus the guest email. */
export interface AdminGuestbookMessage {
  id: string
  name: string
  email: string
  content: string
  createdAt: string
  mediaUrl: string | null
  reactions: Record<string, number>
  comments: ReadonlyArray<{ id: string; author: string; content: string; createdAt: string }>
}

/** Claim row shown in the claims queue (shared normalised claim shape). */
export type AdminClaim = PhotoClaim

export type AdminUploadStatus = 'pending' | 'approved' | 'rejected'

/** Dashboard counters: shared counts + the W7-2 review/tagging signals. */
export interface AdminDashboardCounts extends DashboardCounts {
  peopleReviewBatchesInFlight: number
  lastGuestTaggingSyncLabel: string
}

export type AdminAuditEntry = ModerationAuditEntry
export type AdminAuditActor = ModerationAuditActor

export interface LogAuditInput {
  entityType: ModerationEntityType
  entityId: string
  action: ModerationAuditAction
  actor: AdminAuditActor
  summary: string
  fromStatus?: string | null
  toStatus?: string | null
  metadata?: Json
}

export interface ModerateUploadInput {
  id: string
  action: 'approve' | 'reject'
  /** Required for reject; optional frozen reason field for approve ignored. */
  reason?: string
  actor: AdminAuditActor
}

export interface BulkModerateInput {
  ids: readonly string[]
  action: 'approve' | 'reject'
  reason?: string
  actor: AdminAuditActor
}

export interface PublishToAlbumInput {
  ids: readonly string[]
  album: PhotoAlbum
  actor: AdminAuditActor
}

export interface DeleteGuestbookInput {
  ids: readonly string[]
  actor: AdminAuditActor
}

export interface ModerateClaimInput {
  id: string
  decision: 'approve' | 'reject'
  /** Required when rejecting (frozen UI requires a reason). */
  reason?: string
  actor: AdminAuditActor
}

/** The injected admin data API. */
export interface AdminApi {
  fetchDashboardCounts: () => Promise<AdminDashboardCounts>
  fetchUploads: (status: AdminUploadStatus) => Promise<AdminUpload[]>
  moderateUpload: (input: ModerateUploadInput) => Promise<AdminUpload>
  bulkModerate: (input: BulkModerateInput) => Promise<AdminUpload[]>
  publishToAlbum: (input: PublishToAlbumInput) => Promise<{ published: number }>
  fetchGuestbookMessages: () => Promise<AdminGuestbookMessage[]>
  deleteGuestbookMessages: (input: DeleteGuestbookInput) => Promise<number>
  fetchClaims: (status: 'pending' | 'approved' | 'rejected') => Promise<AdminClaim[]>
  moderateClaim: (input: ModerateClaimInput) => Promise<AdminClaim>
  fetchAuditLog: () => Promise<AdminAuditEntry[]>
  /** Audit sink: every mutation above writes exactly one entry per entity. */
  logAudit: (input: LogAuditInput) => Promise<AdminAuditEntry>
}

export interface InMemoryAdminApiOptions {
  actor?: AdminAuditActor
  /** Test hook: observes every audit entry the API writes. */
  onAudit?: (entry: LogAuditInput) => void
  /** Deterministic clock base for generated audit rows. */
  fixedNow?: string
}

export interface AdminRuntime {
  auth: AdminAuthClient
  api: AdminApi
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getAdminAuditActor(user: AdminUser | null): AdminAuditActor {
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    name: user?.name ?? 'Admin',
  }
}

function cloneUpload(upload: AdminUpload): AdminUpload {
  return {
    ...upload,
    photoUrls: [...upload.photoUrls],
    videoUrls: [...upload.videoUrls],
    photoFingerprints: [...upload.photoFingerprints],
    videoFingerprints: [...upload.videoFingerprints],
  }
}

function cloneClaim(claim: AdminClaim): AdminClaim {
  return {
    ...claim,
    identity: claim.identity ? { ...claim.identity } : null,
    photo: claim.photo ? { ...claim.photo } : null,
  }
}

function cloneMessage(message: AdminGuestbookMessage): AdminGuestbookMessage {
  return { ...message, reactions: { ...message.reactions }, comments: [...message.comments] }
}

/** Deterministic timestamp for the Nth generated audit row. */
function generatedTimestamp(base: string, index: number): string {
  const start = Date.parse(base)
  return new Date(start + index * 1000).toISOString()
}

// ─── In-memory implementation ───────────────────────────────────────────────

/**
 * Deterministic, stateful admin API for Wave 7.
 *
 * Mirrors the frozen transitions (including the audit entry per state change) so
 * swapping in the real `shared/data` mutations later is behaviour-preserving.
 */
export function createInMemoryAdminApi(
  options: InMemoryAdminApiOptions = {}
): AdminApi & { fetchAuditLog: () => Promise<AdminAuditEntry[]> } {
  const fixedNow = options.fixedNow ?? ADMIN_FIXED_NOW
  const uploads: AdminUpload[] = ADMIN_FIXTURES.uploads.map(cloneUpload)
  let messages: AdminGuestbookMessage[] = ADMIN_FIXTURES.messages.map(cloneMessage)
  const claims: AdminClaim[] = ADMIN_FIXTURES.claims.map(cloneClaim)
  let auditEntries: AdminAuditEntry[] = ADMIN_AUDIT_SEED.map(entry => ({ ...entry }))
  let generated = 0

  const logAudit = (input: LogAuditInput): Promise<AdminAuditEntry> => {
    generated += 1
    const entry: AdminAuditEntry = {
      id: `audit-generated-${generated}`,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorEmail: input.actor.email ?? null,
      actorName: input.actor.name ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
      createdAt: generatedTimestamp(fixedNow, generated),
    }
    options.onAudit?.(input)
    auditEntries = [entry, ...auditEntries]
    return Promise.resolve({ ...entry })
  }

  const updateUploadStatus = (
    upload: AdminUpload,
    action: 'approve' | 'reject',
    reason?: string
  ): AdminUpload => {
    if (action === 'approve') {
      const next: AdminUpload = { ...upload, status: 'approved', rejection_reason: null }
      Object.assign(upload, next)
      return next
    }
    const next: AdminUpload = {
      ...upload,
      status: 'rejected',
      rejection_reason: reason?.trim() ? reason.trim() : null,
    }
    Object.assign(upload, next)
    return next
  }

  const findUpload = (id: string): AdminUpload => {
    const upload = uploads.find(entry => entry.id === id)
    if (!upload) throw new Error(`Upload ${id} was not found.`)
    return upload
  }

  const findClaim = (id: string): AdminClaim => {
    const claim = claims.find(entry => entry.id === id)
    if (!claim) throw new Error(`Claim ${id} was not found.`)
    return claim
  }

  const api: AdminApi = {
    fetchDashboardCounts: () => Promise.resolve({ ...ADMIN_FIXTURES.dashboardCounts }),

    fetchUploads: status =>
      Promise.resolve(uploads.filter(upload => upload.status === status).map(cloneUpload)),

    moderateUpload: async input => {
      const upload = findUpload(input.id)
      const fromStatus = upload.status
      const updated = cloneUpload(updateUploadStatus(upload, input.action, input.reason))

      await logAudit({
        entityType: 'guest_upload',
        entityId: updated.id,
        action: input.action === 'approve' ? 'upload_approved_published' : 'upload_rejected',
        actor: input.actor,
        fromStatus,
        toStatus: updated.status,
        summary:
          input.action === 'approve'
            ? 'Guest upload approved'
            : input.reason?.trim()
              ? `Guest upload rejected: ${input.reason.trim()}`
              : 'Guest upload rejected',
        ...(input.action === 'reject' && input.reason?.trim()
          ? { metadata: { rejection_reason: input.reason.trim() } }
          : {}),
      })

      return updated
    },

    bulkModerate: async input => {
      const updated: AdminUpload[] = []
      for (const id of input.ids) {
        const upload = findUpload(id)
        const fromStatus = upload.status
        const next = cloneUpload(updateUploadStatus(upload, input.action, input.reason))
        updated.push(next)

        await logAudit({
          entityType: 'guest_upload',
          entityId: next.id,
          action: input.action === 'approve' ? 'upload_approved_published' : 'upload_bulk_rejected',
          actor: input.actor,
          fromStatus,
          toStatus: next.status,
          summary:
            input.action === 'approve'
              ? 'Guest upload bulk approved'
              : input.reason?.trim()
                ? `Guest upload bulk rejected: ${input.reason.trim()}`
                : 'Guest upload bulk rejected',
          ...(input.action === 'reject' && input.reason?.trim()
            ? { metadata: { rejection_reason: input.reason.trim(), bulk_count: input.ids.length } }
            : {}),
        })
      }
      return updated
    },

    publishToAlbum: async input => {
      let published = 0
      for (const id of input.ids) {
        const upload = findUpload(id)
        published += upload.photoUrls.length
        await logAudit({
          entityType: 'guest_upload',
          entityId: upload.id,
          action: 'upload_approved_published',
          actor: input.actor,
          fromStatus: upload.status,
          toStatus: upload.status,
          summary: `Guest upload photos published to ${input.album} album`,
          metadata: { album: input.album },
        })
      }
      return { published }
    },

    fetchGuestbookMessages: () => Promise.resolve(messages.map(cloneMessage)),

    deleteGuestbookMessages: async input => {
      const selected = messages.filter(message => input.ids.includes(message.id))
      messages = messages.filter(message => !input.ids.includes(message.id))

      for (const message of selected) {
        const isBulk = input.ids.length > 1
        await logAudit({
          entityType: 'guestbook_message',
          entityId: message.id,
          action: isBulk ? 'guestbook_bulk_deleted' : 'guestbook_message_deleted',
          actor: input.actor,
          fromStatus: null,
          toStatus: 'deleted',
          summary: `Deleted guestbook message from ${message.name}.`,
          metadata: {
            guest_name: message.name,
            guest_email: message.email,
            message_preview: message.content.slice(0, 120),
            ...(isBulk ? { bulk_count: selected.length } : {}),
          },
        })
      }

      return selected.length
    },

    fetchClaims: status =>
      Promise.resolve(claims.filter(claim => claim.status === status).map(cloneClaim)),

    moderateClaim: async input => {
      const claim = findClaim(input.id)
      if (input.decision === 'reject' && !input.reason?.trim()) {
        throw new Error('A rejection reason is required.')
      }

      const fromStatus = claim.status
      claim.status = input.decision === 'approve' ? 'approved' : 'rejected'
      claim.rejectionReason = input.decision === 'reject' ? (input.reason?.trim() ?? null) : null
      claim.updatedAt = generatedTimestamp(fixedNow, generated + 1)

      await logAudit({
        entityType: 'photo_claim',
        entityId: claim.id,
        action: input.decision === 'approve' ? 'claim_approved' : 'claim_rejected',
        actor: input.actor,
        fromStatus,
        toStatus: claim.status,
        summary:
          input.decision === 'approve'
            ? claim.identity
              ? `Approved ${claim.claimType} claim for ${claim.identity.displayName} (${claim.identity.email})`
              : `Approved ${claim.claimType} claim`
            : claim.identity
              ? `Rejected ${claim.claimType} claim for ${claim.identity.displayName}: ${input.reason?.trim()}`
              : `Rejected ${claim.claimType} claim: ${input.reason?.trim()}`,
        ...(input.decision === 'reject'
          ? { metadata: { rejection_reason: input.reason?.trim() ?? '' } }
          : {}),
      })

      return cloneClaim(claim)
    },

    fetchAuditLog: () =>
      Promise.resolve(
        [...auditEntries]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 500)
          .map(entry => ({ ...entry }))
      ),

    logAudit,
  }

  return api
}
