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

  it('treats blank values as absent', () => {
    const env = readEnv({
      ...valid,
      VITE_MEDIA_BASE_URL: '',
      VITE_SENTRY_DSN: '   ',
      VITE_GA_ID: '',
    })

    expect(env.VITE_MEDIA_BASE_URL).toBeUndefined()
    expect(env.VITE_SENTRY_DSN).toBeUndefined()
    expect(env.VITE_GA_ID).toBeUndefined()
    expect(env.VITE_SITE_URL).toBe('https://www.theporadas.com')
  })

  it('rejects a malformed optional URL', () => {
    expect(() => readEnv({ ...valid, VITE_MEDIA_BASE_URL: 'not-a-url' })).toThrow(
      /VITE_MEDIA_BASE_URL/
    )
  })

  it('rejects a malformed VITE_SITE_URL', () => {
    expect(() => readEnv({ ...valid, VITE_SITE_URL: 'not-a-url' })).toThrow(/VITE_SITE_URL/)
  })

  it('trims surrounding whitespace', () => {
    const env = readEnv({
      VITE_SUPABASE_URL: '  https://placeholder.supabase.co  ',
      VITE_SUPABASE_ANON_KEY: '  placeholder-anon-key  ',
    })

    expect(env.VITE_SUPABASE_URL).toBe('https://placeholder.supabase.co')
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('placeholder-anon-key')
  })
})
