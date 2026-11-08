/**
 * Optional local-Supabase contract test (RLS + RPC smoke) — NEVER runs in CI.
 *
 * Skips cleanly unless a local sandbox is explicitly opted into, so the default
 * `npm run test:run` stays fully mocked/offline:
 *
 *   # 1. start the local sandbox (Wave 0 recipe)
 *   cd .. && npx supabase --workdir tmp/supabase-sandbox start && cd rebuild
 *   # 2. export the sandbox REST URL + anon key printed by `supabase status -o env`
 *   export VITE_SUPABASE_URL=http://127.0.0.1:55321
 *   export VITE_SUPABASE_ANON_KEY=<ANON_KEY>
 *   export SUPABASE_CONTRACT_TEST=1
 *   # 3. run only this file
 *   npx vitest run src/shared/data/contract.test.ts
 *
 * The Lead wires `npm run test:contract` to that command in W3-3 (package.json is
 * outside this wave's scope). This file is READ-ONLY against the local DB except
 * for one documented, expected-to-fail RPC probe (baseline defect R17) which
 * fails before writing anything.
 *
 * What it proves: the generated `Database` type, the client wiring and the
 * parsers agree with the real local schema; anon RLS allows the public reads the
 * app needs; the documented RLS drift (A3 §6) is what the contracts claim.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from './database.types'
import { fetchActivityFeed } from './activity'
import { fetchApprovedGuestUploads } from './guestUploads'
import { fetchGuestbookMessages } from './guestbook'
import { fetchSiteEditorialFeatures } from './editorial'
import { fetchPhotoLikeStatuses, fetchPhotoEngagementSummary, fetchTopPhotos } from './photos'
import type { TypedSupabaseClient } from './client'

interface ContractEnv {
  url: string
  key: string
}

function resolveContractEnv(): ContractEnv | null {
  if (process.env.SUPABASE_CONTRACT_TEST !== '1') return null

  const url = process.env.SUPABASE_CONTRACT_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_CONTRACT_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null

  return { url, key }
}

const contractEnv = resolveContractEnv()

describe.skipIf(contractEnv === null)('local Supabase contract (anon key, read-only)', () => {
  let client: TypedSupabaseClient

  beforeAll(() => {
    if (!contractEnv) throw new Error('contract env not configured')
    client = createClient<Database>(contractEnv.url, contractEnv.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  })

  it('public photos are readable and parse into the view model', async () => {
    const photos = await fetchTopPhotos(3, client)
    expect(Array.isArray(photos)).toBe(true)
    for (const photo of photos) {
      expect(typeof photo.id).toBe('string')
      expect(Array.isArray(photo.faces)).toBe(true)
      expect(Array.isArray(photo.tags)).toBe(true)
    }
  })

  it('public guestbook feed is readable with replies', async () => {
    const messages = await fetchGuestbookMessages(client)
    expect(Array.isArray(messages)).toBe(true)
    for (const message of messages) expect(Array.isArray(message.comments)).toBe(true)
  })

  it('approved guest uploads are readable (RLS filters non-approved rows)', async () => {
    const uploads = await fetchApprovedGuestUploads(client)
    expect(Array.isArray(uploads)).toBe(true)
    for (const upload of uploads) {
      expect(upload.status).toBe('approved')
      expect(Array.isArray(upload.photoUrls)).toBe(true)
    }
  })

  it('public editorial features respect the active/window RLS policy', async () => {
    const features = await fetchSiteEditorialFeatures(undefined, client)
    expect(Array.isArray(features)).toBe(true)
    for (const feature of features) expect(feature.isActive).toBe(true)
  })

  it('activity feed is publicly readable (documented RLS-off drift, A3 §6 S1)', async () => {
    const items = await fetchActivityFeed(5, client)
    expect(Array.isArray(items)).toBe(true)
  })

  it('engagement RPCs answer the anon role', async () => {
    const statuses = await fetchPhotoLikeStatuses([], 'contract-test-session', client)
    expect(statuses).toEqual([])

    const summaries = await fetchPhotoEngagementSummary([], client)
    expect(summaries).toEqual([])
  })

  it('is_admin() is false for anon (authoritative role gate)', async () => {
    const { data, error } = await client.rpc('is_admin')
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('documents baseline defect R17: guestbook submit RPC references the dropped type column', async () => {
    // Expected to fail until the Wave 3/cutover repair lands (contracts/schema/rpc.md §3).
    // The statement aborts before any insert, so this probe writes nothing.
    const { error } = await client.rpc('submit_guestbook_message_with_rate_limit', {
      p_name: 'Contract Probe',
      p_email: 'contract-probe@fixtures.example',
      p_content: 'Contract probe — expected to fail on the frozen baseline (R17).',
    })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('42703')
    expect(error?.message).toContain('type')
  })

  it('documents the guest-share token public-read drift (A3 §6 S2)', async () => {
    // Baseline RLS allows anon SELECT on guest_share_tokens; the rebuild closes
    // this at cutover. The test asserts the current baseline so the drift is
    // recorded, not silently assumed away.
    const { error } = await client.from('guest_share_tokens').select('token').limit(1)
    expect(error).toBeNull()
  })
})
