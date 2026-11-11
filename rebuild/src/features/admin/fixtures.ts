/**
 * Deterministic Wave-7 admin fixtures.
 *
 * Seeds come from the frozen contract fixtures so the admin surfaces mirror the
 * e2e-modelled data (and later swap to the real data layer without shape
 * changes):
 *   contracts/fixtures/adminSession.json  -> admin user + dashboard counts + audit seed
 *   contracts/fixtures/guestUploads.json -> pending/approved moderation queue
 *   contracts/fixtures/guestbook.json    -> admin guestbook rows
 *   contracts/fixtures/claims.json       -> claim moderation queue
 *   contracts/ui.json                    -> deterministic clock (fixedNow)
 *
 * Only values the contracts do not carry are local: one rejected upload, one
 * extra pending claim, the second audit actor, the non-admin fixture user and
 * the synthetic credential pairs (documented in the task evidence; never
 * production credentials).
 */
import adminSessionFixture from '../../../../contracts/fixtures/adminSession.json'
import claimsFixture from '../../../../contracts/fixtures/claims.json'
import guestUploadsFixture from '../../../../contracts/fixtures/guestUploads.json'
import guestbookFixture from '../../../../contracts/fixtures/guestbook.json'
import uiFixture from '../../../../contracts/ui.json'
import type { Json } from '@/shared/data/schema'
import type {
  AdminAuditEntry,
  AdminClaim,
  AdminDashboardCounts,
  AdminGuestbookMessage,
  AdminUpload,
  AdminUser,
  StubAuthCredentials,
} from './data'

/** Deterministic clock for generated rows/assets (same instant as parity). */
export const ADMIN_FIXED_NOW = uiFixture.fixedNow

// ─── Users ──────────────────────────────────────────────────────────────────

interface ContractSessionUser {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

const sessionUser: ContractSessionUser = adminSessionFixture.session.user

export const FIXTURE_ADMIN_USER: AdminUser = {
  id: sessionUser.id,
  email: sessionUser.email ?? null,
  name:
    typeof sessionUser.user_metadata?.name === 'string' ? sessionUser.user_metadata.name : 'Admin',
  role: typeof sessionUser.app_metadata?.role === 'string' ? sessionUser.app_metadata.role : null,
}

/**
 * Signed-in-but-not-admin boundary fixture. `role` is deliberately
 * `authenticated` while `user_metadata.role` claims admin: only app_metadata may
 * grant access (A4 §2 auth invariant).
 */
export const FIXTURE_NON_ADMIN_USER: AdminUser = {
  id: 'mock-member-id',
  email: 'member@test.wedding',
  name: 'Member',
  role: 'authenticated',
}

/** Synthetic credential pairs for the in-memory stub (never real secrets). */
export const FIXTURE_CREDENTIALS: readonly StubAuthCredentials[] = [
  { email: 'admin@test.wedding', password: 'admin-fixture-password', user: FIXTURE_ADMIN_USER },
  {
    email: 'member@test.wedding',
    password: 'member-fixture-password',
    user: FIXTURE_NON_ADMIN_USER,
  },
]

// ─── Uploads ────────────────────────────────────────────────────────────────

interface ContractUploadSeed {
  id: string
  guest_name: string
  guest_email: string
  message: string
  photo_urls: readonly string[]
  video_urls: readonly string[]
  status: string
  created_at: string
  rejection_reason?: string | null
}

function toUpload(seed: ContractUploadSeed): AdminUpload {
  const isApproved = seed.status === 'approved'
  return {
    id: seed.id,
    guest_name: seed.guest_name,
    guest_email: seed.guest_email,
    message: seed.message,
    created_at: seed.created_at,
    editorial_summary: null,
    editorial_title: null,
    featured_rank: null,
    memory_trail: null,
    rejection_reason: seed.rejection_reason ?? null,
    status: isApproved ? 'approved' : seed.status === 'rejected' ? 'rejected' : 'pending',
    videoVisibility: seed.video_urls.length > 0 ? 'guest_highlights' : 'archive_only',
    photoUrls: [...seed.photo_urls],
    videoUrls: [...seed.video_urls],
    photoFingerprints: seed.photo_urls.map(url => `fp-${url.split('/').pop() ?? 'photo'}`),
    videoFingerprints: seed.video_urls.map(url => `fp-${url.split('/').pop() ?? 'video'}`),
  }
}

const REJECTED_UPLOAD_SEED: ContractUploadSeed = {
  id: 'upload-rejected-1',
  guest_name: 'Taylor Brooks',
  guest_email: 'taylor@example.com',
  message: 'A blurry table shot we tried to save.',
  photo_urls: ['/images/engagement/PoradaProposal-277.webp'],
  video_urls: [],
  status: 'rejected',
  created_at: '2025-05-11T12:00:00.000Z',
  rejection_reason: 'Too blurry to publish; a sharper frame is already in the gallery.',
}

const CONTRACT_UPLOADS: readonly ContractUploadSeed[] = [
  ...guestUploadsFixture.pending,
  ...guestUploadsFixture.approved,
]

// ─── Guestbook ──────────────────────────────────────────────────────────────

interface ContractMessageComment {
  id: string
  author: string
  content: string
  created_at: string
}

interface ContractMessageSeed {
  id: string
  name: string
  email: string
  content: string
  media_url: string | null
  reactions: Record<string, number>
  created_at: string
  comments: readonly ContractMessageComment[]
}

const CONTRACT_MESSAGES =
  guestbookFixture.adminMessages as unknown as readonly ContractMessageSeed[]

function toReactionCounts(reactions: Record<string, number>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [key, value] of Object.entries(reactions)) {
    if (typeof value === 'number') counts[key] = value
  }
  return counts
}

export const FIXTURE_GUESTBOOK_MESSAGES: readonly AdminGuestbookMessage[] = CONTRACT_MESSAGES.map(
  message => ({
    id: message.id,
    name: message.name,
    email: message.email,
    content: message.content,
    createdAt: message.created_at,
    mediaUrl: message.media_url,
    reactions: toReactionCounts(message.reactions),
    comments: message.comments.map(comment => ({
      id: comment.id,
      author: comment.author,
      content: comment.content,
      createdAt: comment.created_at,
    })),
  })
)

// ─── Claims ─────────────────────────────────────────────────────────────────

interface ContractClaimSeed {
  id: string
  status: string
  claim_type: string
  created_at: string
  face_id?: string | null
  rejection_reason?: string | null
  guest_identities: { id: string; display_name: string; email: string }
  photos: { id: string; url: string; thumbnail: string }
}

function toClaim(seed: ContractClaimSeed): AdminClaim {
  return {
    id: seed.id,
    status:
      seed.status === 'approved' ? 'approved' : seed.status === 'rejected' ? 'rejected' : 'pending',
    claimType: seed.claim_type === 'face' ? 'face' : 'upload',
    faceId: seed.face_id ?? null,
    rejectionReason: seed.rejection_reason ?? null,
    createdAt: seed.created_at,
    updatedAt: seed.created_at,
    identity: {
      id: seed.guest_identities.id,
      displayName: seed.guest_identities.display_name,
      email: seed.guest_identities.email,
    },
    photo: {
      id: seed.photos.id,
      url: seed.photos.url,
      thumbnail: seed.photos.thumbnail,
      caption: null,
    },
  }
}

const EXTRA_PENDING_CLAIM: ContractClaimSeed = {
  id: 'claim-pending-2',
  status: 'pending',
  claim_type: 'face',
  created_at: '2025-05-12T11:30:00.000Z',
  face_id: 'face-3',
  guest_identities: { id: 'identity-alex', display_name: 'Alex Rivera', email: 'alex@example.com' },
  photos: {
    id: 'photo-2',
    url: '/images/engagement/PoradaProposal-11.webp',
    thumbnail: '/images/engagement/PoradaProposal-11.webp',
  },
}

const CONTRACT_CLAIMS: readonly ContractClaimSeed[] = [
  ...claimsFixture.pending,
  EXTRA_PENDING_CLAIM,
  ...claimsFixture.approved,
  ...claimsFixture.rejected,
]

// ─── Audit seed ─────────────────────────────────────────────────────────────

interface ContractAuditSeed {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_email: string
  actor_name: string
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

const CONTRACT_AUDIT: readonly ContractAuditSeed[] = adminSessionFixture.auditLog

const LOCAL_AUDIT: readonly AdminAuditEntry[] = [
  {
    id: 'audit-local-claim-approved',
    entityType: 'photo_claim',
    entityId: 'claim-approved-1',
    action: 'claim_approved',
    actorEmail: 'editor@test.wedding',
    actorName: 'Editor',
    fromStatus: 'pending',
    toStatus: 'approved',
    summary: 'Approved photo claim for Bob Baker (bob@example.com)',
    metadata: {},
    createdAt: '2025-05-14T09:00:00.000Z',
  },
  {
    id: 'audit-local-guestbook-bulk',
    entityType: 'guestbook_message',
    entityId: 'gb-msg-3',
    action: 'guestbook_bulk_deleted',
    actorEmail: 'editor@test.wedding',
    actorName: 'Editor',
    fromStatus: null,
    toStatus: 'deleted',
    summary: 'Deleted guestbook message from Aunt Patricia.',
    metadata: { guest_name: 'Aunt Patricia', bulk_count: 1 },
    createdAt: '2025-05-14T10:00:00.000Z',
  },
]

export const ADMIN_AUDIT_SEED: readonly AdminAuditEntry[] = [
  ...LOCAL_AUDIT,
  ...CONTRACT_AUDIT.map(entry => ({
    id: entry.id,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    action: entry.action,
    actorEmail: entry.actor_email,
    actorName: entry.actor_name,
    fromStatus: null,
    toStatus: null,
    summary: entry.summary,
    metadata: entry.metadata as unknown as Json,
    createdAt: entry.created_at,
  })),
]

// ─── Dashboard ──────────────────────────────────────────────────────────────

function countOf(rows: ReadonlyArray<{ count: number }>): number {
  return rows[0]?.count ?? 0
}

export const FIXTURE_DASHBOARD_COUNTS: AdminDashboardCounts = {
  photos: countOf(adminSessionFixture.dashboardCounts.photos),
  pendingUploads: countOf(adminSessionFixture.dashboardCounts.pendingUploads),
  guestbookMessages: countOf(adminSessionFixture.dashboardCounts.guestbookMessages),
  approvedUploads: countOf(adminSessionFixture.dashboardCounts.approvedUploads),
  peopleReviewBatchesInFlight: 0,
  lastGuestTaggingSyncLabel: 'No guest sync yet',
}

// ─── Bundle ─────────────────────────────────────────────────────────────────

export interface AdminFixtures {
  credentials: readonly StubAuthCredentials[]
  adminUser: AdminUser
  nonAdminUser: AdminUser
  uploads: readonly AdminUpload[]
  messages: readonly AdminGuestbookMessage[]
  claims: readonly AdminClaim[]
  dashboardCounts: AdminDashboardCounts
}

export const ADMIN_FIXTURES: AdminFixtures = {
  credentials: FIXTURE_CREDENTIALS,
  adminUser: FIXTURE_ADMIN_USER,
  nonAdminUser: FIXTURE_NON_ADMIN_USER,
  uploads: [...CONTRACT_UPLOADS.map(toUpload), toUpload(REJECTED_UPLOAD_SEED)],
  messages: FIXTURE_GUESTBOOK_MESSAGES,
  claims: CONTRACT_CLAIMS.map(toClaim),
  dashboardCounts: FIXTURE_DASHBOARD_COUNTS,
}
