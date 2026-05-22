import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase, getOrCreateShareToken, fetchGuestContributionsByToken } from './supabase'

// Mock the supabase-js client
vi.mock('@supabase/supabase-js', () => {
  const queryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  }

  // Allow method chaining by returning queryBuilder from all query methods
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.insert.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.order.mockReturnValue(queryBuilder)
  queryBuilder.maybeSingle.mockReturnValue(queryBuilder)
  queryBuilder.single.mockReturnValue(queryBuilder)

  const mockFrom = vi.fn().mockReturnValue(queryBuilder)

  return {
    createClient: () => ({
      from: mockFrom,
    }),
  }
})

describe('Supabase Shared Links Helper Routines', () => {
  const mockQueryBuilder = supabase.from('dummy') as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateShareToken', () => {
    it('returns existing token if found', async () => {
      // Setup mock to return existing token
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { token: 'existing-uuid-token' },
        error: null,
      })

      const token = await getOrCreateShareToken('GUEST@example.com')

      // Assertions
      expect(token).toBe('existing-uuid-token')
      expect(supabase.from).toHaveBeenCalledWith('guest_share_tokens')
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('token')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('guest_email', 'guest@example.com')
      expect(mockQueryBuilder.maybeSingle).toHaveBeenCalledTimes(1)
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled()
    })

    it('generates, inserts, and returns new token if not found', async () => {
      // First call (check if exists): returns null
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Second call (insert): returns inserted token
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { token: 'newly-created-uuid' },
        error: null,
      })

      const token = await getOrCreateShareToken('guest@example.com')

      expect(token).toBe('newly-created-uuid')
      expect(supabase.from).toHaveBeenCalledWith('guest_share_tokens')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        guest_email: 'guest@example.com',
        token: expect.any(String),
      })
      expect(mockQueryBuilder.single).toHaveBeenCalledTimes(1)
    })

    it('retries fetching existing token if insert fails due to race condition', async () => {
      // First call (check if exists): returns null
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Second call (insert): returns unique constraint error
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      })

      // Third call (retry select): returns the token inserted by other request
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { token: 'race-condition-existing-token' },
        error: null,
      })

      const token = await getOrCreateShareToken('guest@example.com')

      expect(token).toBe('race-condition-existing-token')
      expect(mockQueryBuilder.maybeSingle).toHaveBeenCalledTimes(2)
    })

    it('throws the insert error if retry fetch fails as well', async () => {
      // First call (check if exists): returns null
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      // Second call (insert): returns general insert error
      const testError = { message: 'Database disconnected' }
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: testError,
      })

      // Third call (retry select): returns null/error
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      await expect(getOrCreateShareToken('guest@example.com')).rejects.toEqual(testError)
    })
  })

  describe('fetchGuestContributionsByToken', () => {
    it('returns null if token does not exist in guest_share_tokens', async () => {
      // Token resolution: returns null
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const result = await fetchGuestContributionsByToken('invalid-token')

      expect(result).toBeNull()
      expect(supabase.from).toHaveBeenCalledWith('guest_share_tokens')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('token', 'invalid-token')
    })

    it('returns complete guest album profile and data if token is valid', async () => {
      // 1. Resolve token to email
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { guest_email: 'guest@example.com' },
        error: null,
      })

      // 2. Parallel responses:
      // uploadsRes
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [
          { id: 'upload-1', guest_name: 'John Doe', photo_urls: ['url-1'] }
        ],
        error: null,
      })
      // guestbookRes
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [
          { id: 'gb-1', name: 'John Doe', message: 'Congrats!' }
        ],
        error: null,
      })
      // claimedRes
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'identity-1',
          photo_claims: [
            {
              status: 'approved',
              photos: { id: 'photo-10', url: 'claimed-10.jpg' }
            },
            {
              status: 'pending',
              photos: { id: 'photo-11', url: 'claimed-11.jpg' }
            }
          ]
        },
        error: null,
      })
      // identityRes (display name)
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { display_name: 'Johnathan Doe' },
        error: null,
      })

      const result = await fetchGuestContributionsByToken('valid-token-123')

      expect(result).not.toBeNull()
      if (result) {
        expect(result.guestName).toBe('Johnathan Doe')
        expect(result.uploads).toHaveLength(1)
        expect(result.guestbook).toHaveLength(1)
        expect(result.claimedPhotos).toHaveLength(1) // Only approved should be resolved
        expect(result.claimedPhotos[0]).toEqual({ id: 'photo-10', url: 'claimed-10.jpg' })
      }

      // Verify the parallel queries were made
      expect(supabase.from).toHaveBeenCalledWith('guest_uploads')
      expect(supabase.from).toHaveBeenCalledWith('guestbook_messages')
      expect(supabase.from).toHaveBeenCalledWith('guest_identities')
    })

    it('falls back to guestbook name then upload name then "Special Guest" if identity display name is missing', async () => {
      // 1. Resolve token to email
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { guest_email: 'guest@example.com' },
        error: null,
      })

      // 2. Parallel responses (identity display_name missing, but guestbook name present):
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [], error: null }) // guest_uploads
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [{ name: 'Guestbook Signer' }], error: null }) // guestbook
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null }) // photo_claims
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null }) // identity (display_name missing)

      const result1 = await fetchGuestContributionsByToken('valid-token-123')
      expect(result1?.guestName).toBe('Guestbook Signer')

      // 3. Clear mock calls for second check
      vi.clearAllMocks()

      // Resolve token
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { guest_email: 'guest@example.com' },
        error: null,
      })
      // Identity and guestbook empty, upload has name
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [{ guest_name: 'Uploader Name' }], error: null })
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [], error: null })
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

      const result2 = await fetchGuestContributionsByToken('valid-token-123')
      expect(result2?.guestName).toBe('Uploader Name')

      // 4. Clear mock calls for third check (everything empty)
      vi.clearAllMocks()

      // Resolve token
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { guest_email: 'guest@example.com' },
        error: null,
      })
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [], error: null })
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [], error: null })
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

      const result3 = await fetchGuestContributionsByToken('valid-token-123')
      expect(result3?.guestName).toBe('Special Guest')
    })
  })
})
