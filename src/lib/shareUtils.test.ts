import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPrintUrl, getShareToken, ensureGuestShareToken } from '@/lib/shareUtils'
import * as supabaseModule from '@/lib/supabase'

// Store original env
const originalEnv = { ...import.meta.env }

describe('shareUtils', () => {
  beforeEach(() => {
    // Reset env mock before each test
    Object.keys(import.meta.env).forEach((key) => {
      delete import.meta.env[key]
    })
    Object.assign(import.meta.env, originalEnv)
    vi.clearAllMocks()
  })

  describe('buildPrintUrl', () => {
    it('builds Shutterfly URL with photo param', () => {
      import.meta.env.VITE_PRINT_PROVIDER = 'shutterfly'
      const url = buildPrintUrl('https://example.com/photo.jpg')
      expect(url).toContain('shutterfly.com')
      expect(url).toContain('photo=')
    })

    it('builds Artifact Uprising URL when env is artifact_uprising', () => {
      import.meta.env.VITE_PRINT_PROVIDER = 'artifact_uprising'
      const url = buildPrintUrl('https://example.com/photo.jpg')
      expect(url).toContain('artifactuprising.com')
    })

    it('defaults to Shutterfly for unknown provider', () => {
      import.meta.env.VITE_PRINT_PROVIDER = 'unknown_provider'
      const url = buildPrintUrl('https://example.com/photo.jpg')
      expect(url).toContain('shutterfly.com')
    })
  })

  describe('getShareToken', () => {
    it('generates a UUID-formatted token', () => {
      const token = getShareToken()
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
  })

  describe('ensureGuestShareToken', () => {
    it('returns existing token if email already has one', async () => {
      const mockToken = 'existing-token-123'
      const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
          data: { share_token: mockToken },
          error: null,
        }),
      }

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)

      const result = await ensureGuestShareToken('guest@example.com')

      expect(result).toBe(mockToken)
    })

    it('creates new token if none exists', async () => {
      const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
          data: null,
          error: null,
        }),
        insert: vi.fn().mockReturnValue({
          data: { share_token: 'newly-created-token' },
          error: null,
        }),
      }

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)

      const result = await ensureGuestShareToken('newguest@example.com')

      // A new UUID should have been generated and returned
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
  })
})
