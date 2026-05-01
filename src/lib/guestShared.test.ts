import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGuestShareToken, fetchGuestSharedData } from '@/lib/guestShared'
import * as supabaseModule from '@/lib/supabase'

describe('GuestShared data fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchGuestShareToken', () => {
    it('returns email when token exists', async () => {
      const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
          data: { email: 'guest@example.com', share_token: 'valid-token-123' },
          error: null,
        }),
      }

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)

      const result = await fetchGuestShareToken('valid-token-123')

      expect(result).toEqual({ email: 'guest@example.com', share_token: 'valid-token-123' })
    })

    it('returns null when token not found', async () => {
      const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)

      const result = await fetchGuestShareToken('invalid-token')

      expect(result).toBeNull()
    })
  })

  describe('fetchGuestSharedData', () => {
    it('composes uploads and guestbook by email', async () => {
      const mockUploadsResult = {
        data: [{ id: '1', url: 'https://example.com/photo.jpg', email: 'guest@example.com' }],
        error: null,
      }
      const mockGuestbookResult = {
        data: [{ id: '1', message: 'Great wedding!', email: 'guest@example.com' }],
        error: null,
      }
      const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: unknown) => void) => {
            resolve({ data: mockUploadsResult.data })
          },
        }),
      }

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)
      vi.spyOn(Promise, 'all').mockResolvedValue([mockUploadsResult, mockGuestbookResult])

      const result = await fetchGuestSharedData('guest@example.com')

      expect(result).toHaveProperty('uploads')
      expect(result).toHaveProperty('guestbook')
    })

    it('returns null when token not found', async () => {
      const mockUploadsResult = { data: [], error: null }
      const mockGuestbookResult = { data: [], error: null }
      const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)
      vi.spyOn(Promise, 'all').mockResolvedValue([mockUploadsResult, mockGuestbookResult])

      const result = await fetchGuestSharedData('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })
})
