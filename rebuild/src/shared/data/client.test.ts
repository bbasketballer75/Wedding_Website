import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ mocked: true })),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

import type { AppEnv } from '@/app/env'
import {
  CLIENT_AUTH_OPTIONS,
  CLIENT_REALTIME_OPTIONS,
  createDataClient,
  getSupabaseClient,
  resetSupabaseClient,
} from './client'

const env: AppEnv = {
  VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'public-anon-key',
  VITE_SITE_URL: 'https://www.theporadas.com',
}

describe('typed Supabase client', () => {
  beforeEach(() => {
    createClientMock.mockClear()
    resetSupabaseClient()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClient()
  })

  it('creates the client with the public env values and frozen options', () => {
    createDataClient(env)

    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY,
      expect.objectContaining({
        auth: CLIENT_AUTH_OPTIONS,
        realtime: { params: { eventsPerSecond: 10 } },
      })
    )
  })

  it('locks the frozen auth and realtime option values', () => {
    expect(CLIENT_AUTH_OPTIONS).toEqual({
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    })
    expect(CLIENT_REALTIME_OPTIONS.params.eventsPerSecond).toBe(10)
  })

  it('getSupabaseClient reads import.meta.env lazily and memoises the instance', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://placeholder.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'placeholder-anon-key')

    const first = getSupabaseClient()
    const second = getSupabaseClient()

    expect(second).toBe(first)
    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith(
      'https://placeholder.supabase.co',
      'placeholder-anon-key',
      expect.any(Object)
    )
  })

  it('resetSupabaseClient forces a fresh instance (HMR / env change)', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://placeholder.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'placeholder-anon-key')

    getSupabaseClient()
    resetSupabaseClient()
    getSupabaseClient()

    expect(createClientMock).toHaveBeenCalledTimes(2)
  })

  it('fails fast with a readable message when public env is missing', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    expect(() => getSupabaseClient()).toThrowError(/Invalid environment configuration/)
  })
})
