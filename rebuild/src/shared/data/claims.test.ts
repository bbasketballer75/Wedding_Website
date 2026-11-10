import { describe, expect, it } from 'vitest'
import {
  PHOTO_CLAIM_STATUSES,
  PHOTO_CLAIM_TYPES,
  approvePhotoClaim,
  fetchApprovedClaims,
  fetchClaimsByStatus,
  fetchGuestContributionsByToken,
  fetchPendingClaims,
  fetchPotentialPhotosToClaimByEmail,
  fetchRejectedClaims,
  fetchVerifiedIdentities,
  findOrCreateGuestIdentity,
  getOrCreateShareToken,
  isPhotoClaimStatus,
  isPhotoClaimType,
  parsePhotoClaim,
  parsePhotoClaims,
  rejectPhotoClaim,
  resolveGuestContributions,
  submitPhotoClaims,
} from './claims'
import { DataError } from './errors'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

const fixtures = loadFixtures()
const claimsFixture = fixtures.claims

function makeIdentityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'identity-1',
    email: 'jane@example.com',
    session_id: null,
    display_name: 'Jane Miller',
    is_verified: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('claim parsing (contracts/fixtures/claims.json)', () => {
  it('parses the pending face claim with identity and photo', () => {
    const claim = parsePhotoClaim(claimsFixture.pending[0])

    expect(claim).toMatchObject({
      id: 'claim-pending-1',
      status: 'pending',
      claimType: 'face',
      faceId: 'face-1',
      identity: { id: 'identity-jane', displayName: 'Jane Miller', email: 'jane@example.com' },
      photo: {
        id: 'photo-1',
        url: '/images/engagement/PoradaProposal-29.webp',
        thumbnail: '/images/engagement/PoradaProposal-29.webp',
        caption: null,
      },
    })
  })

  it('normalises the fixture legacy claim_type "photo" to "upload"', () => {
    const claim = parsePhotoClaim(claimsFixture.approved[0])
    expect(claim?.claimType).toBe('upload')
  })

  it('keeps rejection reasons', () => {
    const claim = parsePhotoClaim(claimsFixture.rejected[0])
    expect(claim?.rejectionReason).toBe('Face belongs to another guest')
  })

  it('drops malformed claims', () => {
    expect(parsePhotoClaim(null)).toBeNull()
    expect(parsePhotoClaim({ id: 'c', status: 'unknown' })).toBeNull()
    expect(parsePhotoClaims([...claimsFixture.pending, null, { id: 'x' }])).toHaveLength(1)
  })

  it('exposes the frozen enums', () => {
    expect([...PHOTO_CLAIM_STATUSES]).toEqual(['pending', 'approved', 'rejected'])
    expect([...PHOTO_CLAIM_TYPES]).toEqual(['upload', 'face'])
    expect(isPhotoClaimStatus('approved')).toBe(true)
    expect(isPhotoClaimStatus('deleted')).toBe(false)
    expect(isPhotoClaimType('face')).toBe(true)
    expect(isPhotoClaimType('photo')).toBe(false)
  })
})

describe('claim reads', () => {
  it('fetchVerifiedIdentities filters verified rows', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_identities: { data: [makeIdentityRow({ is_verified: true })] } },
    })

    const rows = await fetchVerifiedIdentities(client)

    expect(rows).toHaveLength(1)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_identities',
      method: 'eq',
      args: ['is_verified', true],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_identities',
      method: 'order',
      args: ['display_name', { ascending: true }],
    })
  })

  it('fetchClaimsByStatus selects relations and orders newest first', async () => {
    const { client, calls } = createMockClient({
      tables: { photo_claims: { data: claimsFixture.pending } },
    })

    const claims = await fetchClaimsByStatus('pending', client)

    expect(claims).toHaveLength(1)
    const selectCall = calls.find(
      call => call.target === 'photo_claims' && call.method === 'select'
    )
    expect(String(selectCall?.args[0])).toContain('guest_identities(*)')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('pending/approved/rejected wrappers pass their status', async () => {
    const pending = createMockClient({ tables: { photo_claims: { data: claimsFixture.pending } } })
    const approved = createMockClient({
      tables: { photo_claims: { data: claimsFixture.approved } },
    })
    const rejected = createMockClient({
      tables: { photo_claims: { data: claimsFixture.rejected } },
    })

    await fetchPendingClaims(pending.client)
    await fetchApprovedClaims(approved.client)
    await fetchRejectedClaims(rejected.client)

    expect(pending.calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'eq',
      args: ['status', 'pending'],
    })
    expect(approved.calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'eq',
      args: ['status', 'approved'],
    })
    expect(rejected.calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'eq',
      args: ['status', 'rejected'],
    })
  })

  it('wraps claim read errors', async () => {
    const { client } = createMockClient({
      tables: { photo_claims: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchClaimsByStatus('pending', client)).rejects.toMatchObject({
      code: 'postgrest:42501',
    })
  })
})

describe('guest identity find-or-create (D-02 RPC)', () => {
  it('resolves an existing identity through the SECURITY DEFINER RPC', async () => {
    const row = makeIdentityRow({ is_verified: true })
    const { client, calls } = createMockClient({
      rpcs: { resolve_guest_identity: { data: row } },
    })

    const identity = await findOrCreateGuestIdentity(
      { email: 'jane@example.com', displayName: 'Jane' },
      client
    )

    expect(identity.id).toBe('identity-1')
    expect(identity.display_name).toBe('Jane Miller')
    expect(identity.is_verified).toBe(true)
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'resolve_guest_identity',
      method: 'rpc',
      args: [{ p_email: 'jane@example.com', p_display_name: 'Jane', p_session_id: null }],
    })
    // The D-02 migrations revoke public table reads, so no direct table access.
    expect(calls.some(call => call.surface === 'from' && call.target === 'guest_identities')).toBe(
      false
    )
  })

  it('passes the session id and maps the RPC payload onto the row shape', async () => {
    const { client, calls } = createMockClient({
      rpcs: {
        resolve_guest_identity: {
          data: {
            id: 'identity-new',
            email: 'new@example.com',
            display_name: 'New Guest',
            session_id: 's1',
            is_verified: false,
            created_at: '2025-05-10T14:00:00.000Z',
          },
        },
      },
    })

    const identity = await findOrCreateGuestIdentity(
      { email: 'new@example.com', displayName: 'New Guest', sessionId: 's1' },
      client
    )

    expect(identity).toMatchObject({
      id: 'identity-new',
      session_id: 's1',
      is_verified: false,
      created_at: '2025-05-10T14:00:00.000Z',
    })
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'resolve_guest_identity',
      method: 'rpc',
      args: [{ p_email: 'new@example.com', p_display_name: 'New Guest', p_session_id: 's1' }],
    })
  })

  it('wraps RPC failures as DataError', async () => {
    const { client } = createMockClient({
      rpcs: {
        resolve_guest_identity: { error: { message: 'not authorized', code: '42501' } },
      },
    })

    await expect(
      findOrCreateGuestIdentity({ email: 'race@example.com', displayName: 'Race' }, client)
    ).rejects.toBeInstanceOf(DataError)
  })

  it('rejects an empty RPC payload', async () => {
    const { client } = createMockClient({
      rpcs: { resolve_guest_identity: { data: null } },
    })

    await expect(
      findOrCreateGuestIdentity({ email: 'race@example.com', displayName: 'Race' }, client)
    ).rejects.toBeInstanceOf(DataError)
  })
})

describe('claim submission', () => {
  it('short-circuits with no claims and maps claims onto the identity', async () => {
    const { client, calls } = createMockClient({})
    await expect(
      submitPhotoClaims({ email: 'jane@example.com', displayName: 'Jane', claims: [] }, client)
    ).resolves.toEqual([])
    expect(calls).toHaveLength(0)

    const withClaims = createMockClient({
      rpcs: { resolve_guest_identity: { data: makeIdentityRow({ is_verified: true }) } },
      tables: {
        photo_claims: { data: [{ id: 'claim-new' }] },
      },
    })

    const rows = await submitPhotoClaims(
      {
        email: 'jane@example.com',
        displayName: 'Jane',
        sessionId: 's1',
        claims: [
          { photoId: 'photo-1', claimType: 'upload' },
          { photoId: 'photo-2', faceId: 'face-1', claimType: 'face' },
        ],
      },
      withClaims.client
    )

    expect(rows).toEqual([{ id: 'claim-new' }])
    expect(withClaims.calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'insert',
      args: [
        [
          {
            guest_identity_id: 'identity-1',
            photo_id: 'photo-1',
            face_id: null,
            claim_type: 'upload',
            status: 'pending',
          },
          {
            guest_identity_id: 'identity-1',
            photo_id: 'photo-2',
            face_id: 'face-1',
            claim_type: 'face',
            status: 'pending',
          },
        ],
      ],
    })
  })
})

describe('claim moderation transitions', () => {
  it('approving a face claim verifies the identity, syncs the face and audits', async () => {
    const { client, calls } = createMockClient({
      tables: {
        photo_claims: [{ data: claimsFixture.pending[0] }, { data: [] }],
        guest_identities: { data: [] },
        media_review_faces: { data: [] },
      },
      rpcs: {
        insert_moderation_audit_v1: {
          data: {
            id: 'audit-1',
            entity_type: 'photo_claim',
            action: 'claim_approved',
            summary: 'Approved face claim for Jane Miller (jane@example.com)',
            metadata: {},
          },
        },
      },
    })

    await approvePhotoClaim(
      'claim-pending-1',
      { userId: 'admin-1', email: 'admin@test.wedding' },
      client
    )

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'update',
      args: [expect.objectContaining({ status: 'approved' })],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_identities',
      method: 'update',
      args: [{ is_verified: true }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'media_review_faces',
      method: 'update',
      args: [
        expect.objectContaining({ confirmed_name: 'Jane Miller', review_status: 'confirmed' }),
      ],
    })
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'insert_moderation_audit_v1',
      method: 'rpc',
      args: [
        expect.objectContaining({
          p_action: 'claim_approved',
          p_entity_type: 'photo_claim',
          p_from_status: 'pending',
          p_to_status: 'approved',
          p_summary: 'Approved face claim for Jane Miller (jane@example.com)',
        }),
      ],
    })
  })

  it('rejecting a claim writes the reason and audits', async () => {
    const { client, calls } = createMockClient({
      tables: {
        photo_claims: [{ data: claimsFixture.rejected[0] }, { data: [] }],
      },
      rpcs: {
        insert_moderation_audit_v1: {
          data: {
            id: 'audit-1',
            entity_type: 'photo_claim',
            action: 'claim_rejected',
            summary: 'Rejected',
            metadata: {},
          },
        },
      },
    })

    await rejectPhotoClaim('claim-rejected-1', 'not your face', null, client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photo_claims',
      method: 'update',
      args: [expect.objectContaining({ status: 'rejected', rejection_reason: 'not your face' })],
    })
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'insert_moderation_audit_v1',
      method: 'rpc',
      args: [expect.objectContaining({ p_action: 'claim_rejected' })],
    })
  })

  it('fails with not-found for a missing claim', async () => {
    const { client } = createMockClient({ tables: { photo_claims: { data: null } } })
    await expect(approvePhotoClaim('missing', null, client)).rejects.toMatchObject({
      code: 'not-found:claim',
    })
    await expect(rejectPhotoClaim('missing', undefined, null, client)).rejects.toMatchObject({
      code: 'not-found:claim',
    })
  })
})

describe('claim wizard + share tokens', () => {
  it('fetchPotentialPhotosToClaimByEmail resolves approved upload urls into photos', async () => {
    const { client, calls } = createMockClient({
      tables: {
        guest_uploads: { data: [{ photo_urls: ['/images/a.webp', '/images/b.webp'] }] },
        photos: { data: [{ id: 'photo-1', url: '/images/a.webp', thumbnail: '/images/a.webp' }] },
      },
    })

    const photos = await fetchPotentialPhotosToClaimByEmail('jamie@example.com', client)

    expect(photos).toHaveLength(1)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'photos',
      method: 'in',
      args: ['url', ['/images/a.webp', '/images/b.webp']],
    })
  })

  it('fetchPotentialPhotosToClaimByEmail short-circuits when the guest has no urls', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_uploads: { data: [] } },
    })
    await expect(fetchPotentialPhotosToClaimByEmail('none@example.com', client)).resolves.toEqual(
      []
    )
    expect(calls.some(call => call.target === 'photos')).toBe(false)
  })

  it('fetches the uploader token through the RPC', async () => {
    const { client, calls } = createMockClient({
      rpcs: { get_or_create_share_token: { data: 'existing-token' } },
    })

    await expect(getOrCreateShareToken('Jane@Example.com', 'upload-1', client)).resolves.toBe(
      'existing-token'
    )
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'get_or_create_share_token',
      method: 'rpc',
      args: [{ p_email: 'jane@example.com', p_upload_id: 'upload-1' }],
    })
  })

  it('throws when the token RPC errors or returns null', async () => {
    const failing = createMockClient({
      rpcs: {
        get_or_create_share_token: { error: { message: 'permission denied', code: '42501' } },
      },
    })
    await expect(
      getOrCreateShareToken('broken@example.com', 'upload-1', failing.client)
    ).rejects.toBeInstanceOf(DataError)

    const empty = createMockClient({
      rpcs: { get_or_create_share_token: { data: null } },
    })
    await expect(
      getOrCreateShareToken('wrong-owner@example.com', 'upload-2', empty.client)
    ).rejects.toBeInstanceOf(DataError)
  })
})

describe('guest-share aggregation (/guest/:token)', () => {
  it('resolveGuestContributions normalises uploads, notes and approved claims', () => {
    const contributions = resolveGuestContributions({
      tokenRow: fixtures.guestTokens.valid,
      uploads: fixtures.guestUploads.approved,
      guestbookRows: fixtures.guestbook.messages,
      identityRow: {
        id: 'identity-jane',
        display_name: 'Jane Miller',
        photo_claims: [
          ...(fixtures.guestTokens.identityWithClaims as { photo_claims: unknown[] }).photo_claims,
          { id: 'claim-rejected', status: 'rejected', photos: { id: 'p', url: '/x.webp' } },
        ],
      },
    })

    expect(contributions).not.toBeNull()
    expect(contributions?.guestName).toBe('Jane Miller')
    expect(contributions?.uploads).toHaveLength(2)
    expect(contributions?.guestbook).toHaveLength(3)
    expect(contributions?.claimedPhotos.map(photo => photo.id)).toEqual(['photo-1'])
  })

  it('falls back through guestbook name, upload guest name, then "Special Guest"', () => {
    const base = {
      tokenRow: fixtures.guestTokens.valid,
      uploads: [] as unknown[],
      guestbookRows: [] as unknown[],
      identityRow: null,
    }

    expect(
      resolveGuestContributions({
        ...base,
        guestbookRows: fixtures.guestbook.messages,
      })?.guestName
    ).toBe('Sarah Mitchell')

    expect(
      resolveGuestContributions({
        ...base,
        uploads: fixtures.guestUploads.approved,
      })?.guestName
    ).toBe('Jamie Rivera')

    expect(resolveGuestContributions(base)?.guestName).toBe('Special Guest')
    expect(resolveGuestContributions({ ...base, tokenRow: null })).toBeNull()
  })

  it('fetchGuestContributionsByToken resolves the showcase from the aggregate RPC', async () => {
    const identityWithClaims = fixtures.guestTokens.identityWithClaims as {
      photo_claims: unknown[]
    }
    const { client, calls } = createMockClient({
      rpcs: {
        get_guest_contributions: {
          data: {
            token: { guest_email: 'jane@example.com', token: 'valid-showcase-token' },
            identity: {
              id: 'identity-jane',
              display_name: 'Jane Miller',
              photo_claims: identityWithClaims.photo_claims,
            },
            uploads: fixtures.guestUploads.approved,
            guestbook: fixtures.guestbook.messages,
          },
        },
      },
    })

    const contributions = await fetchGuestContributionsByToken('valid-showcase-token', client)

    expect(contributions?.guestName).toBe('Jane Miller')
    expect(contributions?.claimedPhotos).toHaveLength(1)
    expect(contributions?.uploads).toHaveLength(2)
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'get_guest_contributions',
      method: 'rpc',
      args: [{ p_token: 'valid-showcase-token' }],
    })
  })

  it('returns null for an unknown token or an empty payload', async () => {
    const unknown = createMockClient({
      rpcs: { get_guest_contributions: { data: null } },
    })
    await expect(
      fetchGuestContributionsByToken(fixtures.guestTokens.invalidToken, unknown.client)
    ).resolves.toBeNull()

    const malformed = createMockClient({
      rpcs: { get_guest_contributions: { data: { token: null } } },
    })
    await expect(fetchGuestContributionsByToken('token', malformed.client)).resolves.toBeNull()
  })

  it('wraps aggregate RPC failures as DataError', async () => {
    const broken = createMockClient({
      rpcs: {
        get_guest_contributions: { error: { message: 'denied', code: '42501' } },
      },
    })
    await expect(fetchGuestContributionsByToken('token', broken.client)).rejects.toBeInstanceOf(
      DataError
    )
  })
})
