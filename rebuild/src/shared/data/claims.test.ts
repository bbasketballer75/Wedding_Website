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
import { DataError, isDataError } from './errors'
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

describe('guest identity find-or-create', () => {
  it('returns an existing verified identity without updating it', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_identities: { data: makeIdentityRow({ is_verified: true }) } },
    })

    const identity = await findOrCreateGuestIdentity(
      { email: 'jane@example.com', displayName: 'Jane' },
      client
    )

    expect(identity.id).toBe('identity-1')
    expect(calls.some(call => call.method === 'update')).toBe(false)
  })

  it('updates an existing unverified identity', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_identities: [{ data: makeIdentityRow() }, { data: [] }] },
    })

    await findOrCreateGuestIdentity(
      { email: 'jane@example.com', displayName: 'Jane', sessionId: 's1' },
      client
    )

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_identities',
      method: 'update',
      args: [{ display_name: 'Jane', session_id: 's1' }],
    })
  })

  it('creates a new identity when none exists', async () => {
    const created = makeIdentityRow({ id: 'identity-new' })
    const { client, calls } = createMockClient({
      tables: { guest_identities: [{ data: null }, { data: created }] },
    })

    const identity = await findOrCreateGuestIdentity(
      { email: 'new@example.com', displayName: 'New Guest', sessionId: null },
      client
    )

    expect(identity.id).toBe('identity-new')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_identities',
      method: 'insert',
      args: [
        {
          email: 'new@example.com',
          display_name: 'New Guest',
          session_id: null,
          is_verified: false,
        },
      ],
    })
  })

  it('re-reads the winner on a unique-email race', async () => {
    const raced = makeIdentityRow({ id: 'identity-raced' })
    const { client } = createMockClient({
      tables: {
        guest_identities: [
          { data: null },
          { error: { message: 'duplicate key', code: '23505' } },
          { data: raced },
        ],
      },
    })

    const identity = await findOrCreateGuestIdentity(
      { email: 'race@example.com', displayName: 'Race' },
      client
    )
    expect(identity.id).toBe('identity-raced')
  })

  it('throws when the race re-read also fails', async () => {
    const { client } = createMockClient({
      tables: {
        guest_identities: [
          { data: null },
          { error: { message: 'duplicate', code: '23505' } },
          { data: null },
        ],
      },
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
      tables: {
        guest_identities: { data: makeIdentityRow({ is_verified: true }) },
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
        moderation_audit_log: { data: [{ id: 'audit-1' }] },
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
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'insert',
      args: [
        expect.objectContaining({
          action: 'claim_approved',
          entity_type: 'photo_claim',
          from_status: 'pending',
          to_status: 'approved',
          summary: 'Approved face claim for Jane Miller (jane@example.com)',
        }),
      ],
    })
  })

  it('rejecting a claim writes the reason and audits', async () => {
    const { client, calls } = createMockClient({
      tables: {
        photo_claims: [{ data: claimsFixture.rejected[0] }, { data: [] }],
        moderation_audit_log: { data: [{ id: 'audit-1' }] },
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
      surface: 'from',
      target: 'moderation_audit_log',
      method: 'insert',
      args: [expect.objectContaining({ action: 'claim_rejected' })],
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

  it('getOrCreateShareToken returns an existing token', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_share_tokens: { data: { token: 'existing-token' } } },
    })

    await expect(getOrCreateShareToken('Jane@Example.com', client)).resolves.toBe('existing-token')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guest_share_tokens',
      method: 'eq',
      args: ['guest_email', 'jane@example.com'],
    })
  })

  it('creates a token for a new guest (lowercased email)', async () => {
    const { client, calls } = createMockClient({
      tables: { guest_share_tokens: [{ data: null }, { data: { token: 'generated-token' } }] },
    })

    await expect(getOrCreateShareToken(' New@Example.com ', client)).resolves.toBe(
      'generated-token'
    )

    const insertCall = calls.find(call => call.method === 'insert')
    expect(insertCall?.args[0]).toMatchObject({ guest_email: 'new@example.com' })
    expect(typeof (insertCall?.args[0] as { token?: unknown }).token).toBe('string')
  })

  it('re-reads the winner on a token race and fails when both paths fail', async () => {
    const raced = createMockClient({
      tables: {
        guest_share_tokens: [
          { data: null },
          { error: null, data: null },
          { data: { token: 'raced-token' } },
        ],
      },
    })
    await expect(getOrCreateShareToken('race@example.com', raced.client)).resolves.toBe(
      'raced-token'
    )

    const broken = createMockClient({
      tables: {
        guest_share_tokens: [{ data: null }, { error: new Error('insert failed') }, { data: null }],
      },
    })
    await expect(getOrCreateShareToken('broken@example.com', broken.client)).rejects.toBeInstanceOf(
      DataError
    )
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

  it('fetchGuestContributionsByToken resolves the whole showcase', async () => {
    const identityWithClaims = fixtures.guestTokens.identityWithClaims as {
      photo_claims: unknown[]
    }
    const { client } = createMockClient({
      tables: {
        guest_share_tokens: { data: { guest_email: 'jane@example.com' } },
        guest_uploads: { data: fixtures.guestUploads.approved },
        guestbook_messages: { data: fixtures.guestbook.messages },
        guest_identities: {
          data: { display_name: 'Jane Miller', photo_claims: identityWithClaims.photo_claims },
        },
      },
    })

    const contributions = await fetchGuestContributionsByToken('valid-showcase-token', client)

    expect(contributions?.guestName).toBe('Jane Miller')
    expect(contributions?.claimedPhotos).toHaveLength(1)
  })

  it('returns null for an unknown token and wraps DB failures', async () => {
    const unknown = createMockClient({ tables: { guest_share_tokens: { data: null } } })
    await expect(
      fetchGuestContributionsByToken(fixtures.guestTokens.invalidToken, unknown.client)
    ).resolves.toBeNull()

    const broken = createMockClient({
      tables: { guest_share_tokens: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchGuestContributionsByToken('token', broken.client)).rejects.toBeInstanceOf(
      DataError
    )
  })

  it('propagates a relation read failure (uploads/guestbook/identity)', async () => {
    const brokenUploads = createMockClient({
      tables: {
        guest_share_tokens: { data: { guest_email: 'jane@example.com' } },
        guest_uploads: { error: new Error('boom') },
      },
    })
    try {
      await fetchGuestContributionsByToken('token', brokenUploads.client)
      throw new Error('expected rejection')
    } catch (error) {
      expect(isDataError(error)).toBe(true)
    }
  })
})
