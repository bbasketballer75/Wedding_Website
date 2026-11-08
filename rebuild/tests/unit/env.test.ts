import { describe, expect, it } from 'vitest'
import { readEnv } from '@/app/env'

const valid = {
  VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
}

describe('readEnv', () => {
  it('parses a minimal valid environment and applies defaults', () => {
    const env = readEnv(valid)

    expect(env.VITE_SUPABASE_URL).toBe(valid.VITE_SUPABASE_URL)
    expect(env.VITE_SUPABASE_ANON_KEY).toBe(valid.VITE_SUPABASE_ANON_KEY)
    expect(env.VITE_SITE_URL).toBe('https://www.theporadas.com')
    expect(env.VITE_MEDIA_BASE_URL).toBeUndefined()
  })

  it('accepts optional media and analytics configuration', () => {
    const env = readEnv({
      ...valid,
      VITE_MEDIA_BASE_URL: 'https://media.wedding.theporadas.com',
      VITE_GA_ID: 'G-TEST123',
    })

    expect(env.VITE_MEDIA_BASE_URL).toBe('https://media.wedding.theporadas.com')
    expect(env.VITE_GA_ID).toBe('G-TEST123')
  })

  it('fails fast with a readable message when a required value is missing', () => {
    expect(() => readEnv({ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL })).toThrow(
      /VITE_SUPABASE_ANON_KEY/
    )
  })

  it('rejects malformed URLs', () => {
    expect(() =>
      readEnv({ VITE_SUPABASE_URL: 'not-a-url', VITE_SUPABASE_ANON_KEY: 'key' })
    ).toThrow(/VITE_SUPABASE_URL/)
  })
})
