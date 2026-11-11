/**
 * Real data-layer adapter for the admin portal's `AdminApi` seam (Wave 9 W9-5).
 *
 * `features/admin/data.ts` defines `AdminApi` against the deterministic
 * in-memory Wave-7 implementation. This module implements the same interface
 * 1:1 over the typed Wave-3 data layer so the admin portal reads/writes
 * Supabase:
 *
 *   fetchDashboardCounts   -> fetchDashboardCounts + review batches + guest tagging batches
 *   fetchUploads           -> fetchGuestUploadsByStatus
 *   moderateUpload         -> approveGuestUpload / rejectGuestUpload (audit internally)
 *   bulkModerate           -> bulkApproveGuestUploads / bulkRejectGuestUploads (audit internally)
 *   publishToAlbum         -> publishGuestUploadPhotosToAlbum (audits internally)
 *   fetchGuestbookMessages -> admin read with email + replies (local query, see GAP below)
 *   deleteGuestbookMessages-> deleteGuestbookMessages + one audit row per message
 *   fetchClaims            -> fetchClaimsByStatus
 *   moderateClaim          -> approvePhotoClaim / rejectPhotoClaim (audit internally)
 *   fetchAuditLog          -> fetchModerationAuditTimeline({ limit: 500 })
 *   logAudit               -> recordModerationAudit
 *
 * Audit contract: the shared-data mutations already append exactly one
 * `moderation_audit_log` row per entity. This adapter therefore NEVER calls
 * `recordModerationAudit` for those paths — only for guestbook deletion (the
 * data-layer delete has no audit) and for the explicit `logAudit` sink. That is
 * the "no double audit logging" invariant the adapter tests pin.
 *
 * Error contract: every method funnels failures through `DataError` with the
 * frozen user-facing copy from the admin pages (never raw PostgREST text). The
 * original `DataError.code` is preserved for branching/telemetry.
 *
 * GAPS (no shared/data edits — reported to the Lead; see
 * docs task report): `AdminApi` reads that the data layer does not expose yet:
 *   1. admin guestbook rows INCLUDE the guest email (`guestbook_messages.email`);
 *      `fetchGuestbookMessages` returns the public shape without email.
 *   2. upload/claim mutations return `void` in shared/data; `AdminApi` returns
 *      the updated row. The adapter re-reads the row(s) after the transition.
 * Both are implemented locally below with a TODO to move into shared/data.
 *
 * Wiring (Lead, in `app/routes/admin-routes.tsx`): replace
 *   `const api = useMemo(() => createInMemoryAdminApi(), [])`
 * with
 *   `const api = useMemo(() => createSupabaseAdminApi(), [])`
 */
import type {
  AdminApi,
  AdminAuditEntry,
  AdminClaim,
  AdminDashboardCounts,
  AdminGuestbookMessage,
  AdminUpload,
  AdminUploadStatus,
  LogAuditInput,
} from '@/features/admin/data'
import {
  approvePhotoClaim,
  fetchClaimsByStatus,
  parsePhotoClaim,
  rejectPhotoClaim,
  type PhotoClaim,
} from '@/shared/data/claims'
import { getSupabaseClient, type TypedSupabaseClient } from '@/shared/data/client'
import { DataError, isDataError, toDataError } from '@/shared/data/errors'
import { fetchGuestFaceTaggingBatches, fetchMediaReviewBatches } from '@/shared/data/mediaReview'
import {
  fetchDashboardCounts,
  fetchModerationAuditTimeline,
  parseModerationAuditEntries,
  parseModerationAuditEntry,
  recordModerationAudit,
  type ModerationAuditEntry,
  type ModerationAuditTimelineFilters,
} from '@/shared/data/moderation'
import {
  approveGuestUpload,
  bulkApproveGuestUploads,
  bulkRejectGuestUploads,
  fetchGuestUploadsByStatus,
  mapGuestUploadRow,
  publishGuestUploadPhotosToAlbum,
  rejectGuestUpload,
  type GuestUpload,
} from '@/shared/data/guestUploads'
import { parseReactions } from '@/shared/data/guestbook'
import { deleteGuestbookMessages as deleteGuestbookRows } from '@/shared/data/guestbook'
import { isPhotoAlbum } from '@/shared/data/photos'
import type { JsonObject } from '@/shared/data/schema'

/** Frozen user-facing copy for every adapter failure (from the admin pages). */
export const ADMIN_API_ERROR_COPY = {
  dashboard: 'The dashboard counts could not be loaded right now.',
  uploadsRead: 'The upload queue could not be loaded right now.',
  uploadApprove: 'That upload could not be approved. Please try again.',
  uploadReject: 'That upload could not be rejected. Please try again.',
  bulkApprove: 'The selected uploads could not be approved.',
  bulkReject: 'The selected uploads could not be rejected.',
  publish: 'Those photos could not be published.',
  guestbookRead: 'The guestbook moderation queue could not be loaded.',
  guestbookDelete: 'The selected messages could not be deleted.',
  claimsRead: 'Failed to load photo claims. Please try again.',
  claimApprove: 'Failed to approve claim. Please try again.',
  claimReject: 'Failed to reject claim. Please try again.',
  auditRead: 'Failed to load moderation history. Please try again.',
  auditWrite: 'The moderation action could not be recorded. Please try again.',
  missingRejectionReason: 'A rejection reason is required.',
} as const

/** Audit timeline cap (frozen audit page shows the newest 500). */
export const ADMIN_AUDIT_LOG_LIMIT = 500

const CLAIM_RELATIONS_SELECT = '*, guest_identities(*), photos(*)'

function toAdminError(error: unknown, copy: string): DataError {
  if (isDataError(error)) {
    return new DataError({ message: copy, code: error.code, cause: error })
  }
  return toDataError(error, copy)
}

async function runWithFrozenCopy<Result>(
  copy: string,
  operation: () => Promise<Result>
): Promise<Result> {
  try {
    return await operation()
  } catch (error) {
    throw toAdminError(error, copy)
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseAdminComments(value: unknown): AdminGuestbookMessage['comments'] {
  if (!Array.isArray(value)) return []
  const comments: Array<AdminGuestbookMessage['comments'][number]> = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const id = asString(record.id)
    const author = asString(record.author)
    const content = asString(record.content)
    const createdAt = asString(record.created_at)
    if (!id || author === null || content === null) continue
    comments.push({ id, author, content, createdAt: createdAt ?? '' })
  }
  return comments
}

function parseAdminGuestbookMessage(raw: unknown): AdminGuestbookMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const id = asString(record.id)
  const name = asString(record.name)
  const email = asString(record.email)
  const content = asString(record.content)
  if (!id || name === null || email === null || content === null) return null

  return {
    id,
    name,
    email,
    content,
    createdAt: asString(record.created_at) ?? '',
    mediaUrl: asString(record.media_url),
    reactions: parseReactions(record.reactions as JsonObject | null | undefined),
    comments: parseAdminComments(record.comments),
  }
}

function parseAdminGuestbookMessages(raw: readonly unknown[]): AdminGuestbookMessage[] {
  const messages: AdminGuestbookMessage[] = []
  for (const entry of raw) {
    const message = parseAdminGuestbookMessage(entry)
    if (message) messages.push(message)
  }
  return messages
}

/**
 * GAP 1: admin guestbook read (rows + email + replies).
 * TODO(shared/data guestbook): add `fetchAdminGuestbookMessages(client?)` with
 * this exact select/order and the `AdminGuestbookMessage` view model, then call
 * it here and delete this helper.
 */
async function readAdminGuestbookMessages(
  client: TypedSupabaseClient,
  ids: readonly string[] = []
): Promise<AdminGuestbookMessage[]> {
  let query = client
    .from('guestbook_messages')
    .select(
      'id, name, email, content, created_at, media_url, reactions, comments:guestbook_comments(id, author, content, created_at)'
    )
    .order('created_at', { ascending: false })

  if (ids.length > 0) query = query.in('id', [...ids])

  const { data, error } = await query
  if (error) throw toDataError(error, ADMIN_API_ERROR_COPY.guestbookRead)
  return parseAdminGuestbookMessages(data ?? [])
}

/**
 * GAP 2a: updated upload rows after a moderation transition.
 * TODO(shared/data guestUploads): expose `fetchGuestUploadsByIds(ids, client?)`
 * (select '*' ordered by created_at desc) or return the updated row from the
 * mutation, then delete this helper.
 */
async function readUploadRowsByIds(
  client: TypedSupabaseClient,
  ids: readonly string[]
): Promise<AdminUpload[]> {
  if (ids.length === 0) return []
  const { data, error } = await client
    .from('guest_uploads')
    .select('*')
    .in('id', [...ids])
    .order('created_at', { ascending: false })
  if (error) throw toDataError(error, ADMIN_API_ERROR_COPY.uploadsRead)
  return (data ?? []).map(row => mapGuestUploadRow(row))
}

/** GAP 2a (single row): `AdminApi.moderateUpload` returns the updated upload. */
async function readUploadRowById(
  client: TypedSupabaseClient,
  id: string,
  copy: string
): Promise<AdminUpload> {
  const { data, error } = await client.from('guest_uploads').select('*').eq('id', id).maybeSingle()
  if (error) throw toDataError(error, copy)
  if (!data) {
    throw new DataError({ message: copy, code: 'not-found:upload', cause: { id } })
  }
  return mapGuestUploadRow(data)
}

/**
 * GAP 2b: the updated claim after approve/reject.
 * TODO(shared/data claims): expose `fetchClaimById(id, client?)` with the
 * relations select (already centralised as `CLAIM_RELATIONS_SELECT` there) and
 * reuse it here.
 */
async function readClaimById(
  client: TypedSupabaseClient,
  id: string,
  copy: string
): Promise<PhotoClaim> {
  const { data, error } = await client
    .from('photo_claims')
    .select(CLAIM_RELATIONS_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw toDataError(error, copy)
  const claim = data ? parsePhotoClaim(data) : null
  if (!claim) {
    throw new DataError({ message: copy, code: 'not-found:claim', cause: { id } })
  }
  return claim
}

function toAdminUpload(upload: GuestUpload): AdminUpload {
  return upload
}

function toAdminClaim(claim: PhotoClaim): AdminClaim {
  return claim
}

function toAdminAuditEntry(entry: ModerationAuditEntry): AdminAuditEntry {
  return entry
}

function guestbookAuditMetadata(
  message: AdminGuestbookMessage,
  bulkCount: number | null
): JsonObject {
  return {
    guest_name: message.name,
    guest_email: message.email,
    message_preview: message.content.slice(0, 120),
    ...(bulkCount !== null ? { bulk_count: bulkCount } : {}),
  }
}

/**
 * Build the real admin API. Pass a client to bind a specific session/test
 * double; omit it to use the app's lazy shared client.
 */
export function createSupabaseAdminApi(client?: TypedSupabaseClient): AdminApi {
  const resolveClient = (): TypedSupabaseClient => client ?? getSupabaseClient()

  return {
    fetchDashboardCounts: (): Promise<AdminDashboardCounts> =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.dashboard, async () => {
        const activeClient = resolveClient()
        const [counts, reviewBatches, taggingBatches] = await Promise.all([
          fetchDashboardCounts(activeClient),
          fetchMediaReviewBatches(activeClient),
          fetchGuestFaceTaggingBatches(activeClient),
        ])

        const latestTaggingBatch = taggingBatches[0] ?? null
        return {
          ...counts,
          peopleReviewBatchesInFlight: reviewBatches.filter(
            batch => batch.status === 'pending' || batch.status === 'in_review'
          ).length,
          lastGuestTaggingSyncLabel: latestTaggingBatch?.lastSyncedAt
            ? new Date(latestTaggingBatch.lastSyncedAt).toLocaleString()
            : 'No guest sync yet',
        }
      }),

    fetchUploads: (status: AdminUploadStatus): Promise<AdminUpload[]> =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.uploadsRead, async () => {
        const uploads = await fetchGuestUploadsByStatus(status, resolveClient())
        return uploads.map(toAdminUpload)
      }),

    moderateUpload: input =>
      runWithFrozenCopy(
        input.action === 'approve'
          ? ADMIN_API_ERROR_COPY.uploadApprove
          : ADMIN_API_ERROR_COPY.uploadReject,
        async () => {
          const activeClient = resolveClient()
          const reason = input.reason?.trim()

          if (input.action === 'approve') {
            await approveGuestUpload(input.id, input.actor, activeClient)
          } else {
            await rejectGuestUpload(input.id, reason, input.actor, activeClient)
          }

          const copy =
            input.action === 'approve'
              ? ADMIN_API_ERROR_COPY.uploadApprove
              : ADMIN_API_ERROR_COPY.uploadReject
          const upload = await readUploadRowById(activeClient, input.id, copy)
          return toAdminUpload(upload)
        }
      ),

    bulkModerate: input =>
      runWithFrozenCopy(
        input.action === 'approve'
          ? ADMIN_API_ERROR_COPY.bulkApprove
          : ADMIN_API_ERROR_COPY.bulkReject,
        async () => {
          const activeClient = resolveClient()
          const ids = [...input.ids]
          const reason = input.reason?.trim()

          if (ids.length === 0) return []
          if (input.action === 'approve') {
            await bulkApproveGuestUploads(ids, input.actor, activeClient)
          } else {
            await bulkRejectGuestUploads(ids, reason, input.actor, activeClient)
          }

          const uploads = await readUploadRowsByIds(activeClient, ids)
          return uploads.map(toAdminUpload)
        }
      ),

    publishToAlbum: input =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.publish, async () => {
        if (!isPhotoAlbum(input.album)) {
          throw new DataError({
            message: ADMIN_API_ERROR_COPY.publish,
            code: 'validation:album',
            cause: { album: input.album },
          })
        }

        const ids = [...input.ids]
        if (ids.length === 0) return { published: 0 }
        return publishGuestUploadPhotosToAlbum(ids, input.album, input.actor, resolveClient())
      }),

    fetchGuestbookMessages: (): Promise<AdminGuestbookMessage[]> =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.guestbookRead, () =>
        readAdminGuestbookMessages(resolveClient())
      ),

    deleteGuestbookMessages: input =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.guestbookDelete, async () => {
        const activeClient = resolveClient()
        const ids = [...input.ids]
        if (ids.length === 0) return 0

        // Read the rows first: the per-message audit needs name/email/preview.
        const messages = await readAdminGuestbookMessages(activeClient, ids)
        const deleted = await deleteGuestbookRows(ids, activeClient)
        const bulk = ids.length > 1

        // Data-layer deletion does not audit; write exactly one row per message.
        for (const message of messages) {
          await recordModerationAudit(
            {
              entityType: 'guestbook_message',
              entityId: message.id,
              action: bulk ? 'guestbook_bulk_deleted' : 'guestbook_message_deleted',
              fromStatus: null,
              toStatus: 'deleted',
              summary: `Deleted guestbook message from ${message.name}.`,
              metadata: guestbookAuditMetadata(message, bulk ? ids.length : null),
              actor: input.actor,
            },
            activeClient
          )
        }

        return deleted
      }),

    fetchClaims: (status: 'pending' | 'approved' | 'rejected'): Promise<AdminClaim[]> =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.claimsRead, async () => {
        const claims = await fetchClaimsByStatus(status, resolveClient())
        return claims.map(toAdminClaim)
      }),

    moderateClaim: input => {
      if (input.decision === 'reject' && !input.reason?.trim()) {
        return Promise.reject(
          new DataError({
            message: ADMIN_API_ERROR_COPY.missingRejectionReason,
            code: 'validation:reason',
          })
        )
      }

      const copy =
        input.decision === 'approve'
          ? ADMIN_API_ERROR_COPY.claimApprove
          : ADMIN_API_ERROR_COPY.claimReject

      return runWithFrozenCopy(copy, async () => {
        const activeClient = resolveClient()
        if (input.decision === 'approve') {
          await approvePhotoClaim(input.id, input.actor, activeClient)
        } else {
          await rejectPhotoClaim(input.id, input.reason?.trim(), input.actor, activeClient)
        }

        const claim = await readClaimById(activeClient, input.id, copy)
        return toAdminClaim(claim)
      })
    },

    fetchAuditLog: (): Promise<AdminAuditEntry[]> =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.auditRead, async () => {
        const filters: ModerationAuditTimelineFilters = { limit: ADMIN_AUDIT_LOG_LIMIT }
        const rows = await fetchModerationAuditTimeline(filters, resolveClient())
        return parseModerationAuditEntries(rows).map(toAdminAuditEntry)
      }),

    logAudit: (input: LogAuditInput): Promise<AdminAuditEntry> =>
      runWithFrozenCopy(ADMIN_API_ERROR_COPY.auditWrite, async () => {
        const row = await recordModerationAudit(
          {
            entityType: input.entityType,
            entityId: input.entityId,
            action: input.action,
            summary: input.summary,
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            ...(input.fromStatus !== undefined ? { fromStatus: input.fromStatus } : {}),
            ...(input.toStatus !== undefined ? { toStatus: input.toStatus } : {}),
            actor: input.actor,
          },
          resolveClient()
        )

        const entry = parseModerationAuditEntry(row)
        if (!entry) {
          throw new DataError({
            message: ADMIN_API_ERROR_COPY.auditWrite,
            code: 'parse:audit',
            cause: { action: input.action },
          })
        }
        return toAdminAuditEntry(entry)
      }),
  }
}
