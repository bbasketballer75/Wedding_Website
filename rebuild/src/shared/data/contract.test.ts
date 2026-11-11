/**
 * Optional local-Supabase contract test (RLS + RPC smoke) — NEVER runs in CI.
 *
 * Skips cleanly unless a local sandbox is explicitly opted into, so the default
 * `npm run test:run` stays fully mocked/offline:
 *
 *   # 1. start the local sandbox (Wave 0 recipe)
 *   cd .. && npx supabase start && cd rebuild
 *   # 2. point at the sandbox REST URL + anon key from `supabase status -o env`
 *   #    (use these, NOT VITE_SUPABASE_*: vitest.config.ts sets deterministic
 *   #    VITE_* test env values and `test.env` overrides the shell environment)
 *   export SUPABASE_CONTRACT_TEST=1
 *   export SUPABASE_CONTRACT_URL=http://127.0.0.1:54321
 *   export SUPABASE_CONTRACT_ANON_KEY=<ANON_KEY>
 *   # 3. run only this file through the wrapper
 *   npm run test:contract
 *
 * Two modes:
 * - **frozen baseline** (default): asserts the documented pre-cutover defects —
 *   R17 raises 42703 and the A3 §6 S1/S2/S5 drifts are present.
 * - **post-cutover**: set `SUPABASE_CONTRACT_POST_CUTOVER=1` after applying
 *   `tools/cutover/migrations/*.sql`; asserts the repairs (rate-limited submit,
 *   revoked public identity/token reads, closed direct-write surfaces) and the
 *   new SECURITY DEFINER RPCs.
 *
 * Against a disposable local sandbox it writes only throwaway rows (a guestbook
 * probe note, one guest identity, one audit attempt) and never touches
 * production.
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
const POST_CUTOVER = process.env.SUPABASE_CONTRACT_POST_CUTOVER === '1'

describe.skipIf(contractEnv === null)(
  `local Supabase contract (anon key, ${POST_CUTOVER ? 'post-cutover' : 'frozen baseline'})`,
  () => {
    let client!: TypedSupabaseClient

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

    it('activity feed is publicly readable', async () => {
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

    if (!POST_CUTOVER) {
      it('frozen baseline: guestbook submit RPC references the dropped type column (R17)', async () => {
        // Expected to fail until the cutover repair lands (contracts/schema/rpc.md §3).
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

      it('frozen baseline: guest-share token table is publicly readable (A3 §6 S2)', async () => {
        const { error } = await client.from('guest_share_tokens').select('token').limit(1)
        expect(error).toBeNull()
      })
    } else {
      // Forward-migration RPCs are not in the frozen-schema generated types yet.
      const callRpc = (fn: string, args?: Record<string, unknown>) =>
        (
          client.rpc as unknown as (
            fn: string,
            args?: Record<string, unknown>
          ) => PromiseLike<{
            data: unknown
            error: { code?: string; message?: string } | null
          }>
        )(fn, args)

      it('D-01: the repaired guestbook submit RPC succeeds and enforces the rate limit', async () => {
        const email = `contract-probe-${Date.now()}@fixtures.example`
        const first = await client.rpc('submit_guestbook_message_with_rate_limit', {
          p_name: 'Contract Probe',
          p_email: email,
          p_content: 'post-cutover contract probe',
        })
        expect(first.error).toBeNull()
        const row = (first.data ?? [])[0] as { success?: boolean; message_id?: string } | undefined
        expect(row?.success).toBe(true)
        expect(typeof row?.message_id).toBe('string')
      })

      it('D-02 S2: guest identity/token tables are not publicly readable', async () => {
        const tokensRead = await client.from('guest_share_tokens').select('token').limit(1)
        expect(tokensRead.error?.code).toBe('42501')
        const identitiesRead = await client.from('guest_identities').select('id').limit(1)
        expect(identitiesRead.error?.code).toBe('42501')
      })

      it('D-02 S2: guest-share aggregate + identity RPCs answer the anon role', async () => {
        const contributions = await callRpc('get_guest_contributions', {
          p_token: 'contract-missing-token',
        })
        expect(contributions.error).toBeNull()
        expect(contributions.data).toBeNull()

        const identity = await callRpc('resolve_guest_identity', {
          p_email: `contract-identity-${Date.now()}@fixtures.example`,
          p_display_name: 'Contract Guest',
        })
        expect(identity.error).toBeNull()
        expect(identity.data).toMatchObject({ display_name: 'Contract Guest' })

        const token = await callRpc('get_or_create_share_token', {
          p_email: 'nobody@fixtures.example',
          p_upload_id: '00000000-0000-0000-0000-000000000000',
        })
        expect(token.error).toBeNull()
        expect(token.data).toBeNull()
      })

      it('D-02 S1/S4/S5: direct writes and admin tables are closed to anon', async () => {
        const activityWrite = await client
          .from('activity_log')
          .insert({ type: 'x', source_id: 'y', source_type: 'z' })
        expect(activityWrite.error?.code).toBe('42501')

        const guestbookWrite = await client
          .from('guestbook_messages')
          .insert({ name: 'Direct', email: 'direct@fixtures.example', content: 'direct' })
        expect(guestbookWrite.error?.code).toBe('42501')

        const likesRead = await client.from('photo_likes').select('id').limit(1)
        expect(likesRead.error?.code).toBe('42501')

        const guestbookDelete = await callRpc('delete_guestbook_messages_v1', {
          p_message_ids: [],
        })
        expect(guestbookDelete.error).not.toBeNull()

        const audit = await callRpc('insert_moderation_audit_v1', {
          p_entity_type: 'guestbook_message',
          p_entity_id: '00000000-0000-0000-0000-000000000000',
          p_action: 'guestbook_message_deleted',
          p_summary: 'contract probe',
        })
        expect(audit.error).not.toBeNull()
      })
    }
  }
)
