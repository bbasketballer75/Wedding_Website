// Definitive RLS test: insert test data via service role, then verify
// admin can read it and regular user cannot.
//
// Local-only RLS test helper. Reads creds from env so secrets stay out of git.
//
// Required env (load via .env.test, .env, or export manually):
//   SUPABASE_TEST_URL              e.g. http://127.0.0.1:54321
//   SUPABASE_TEST_SERVICE_KEY      local service-role key (sb_secret_...)
//   SUPABASE_TEST_ANON_KEY         local anon/publishable key (sb_publishable_...)
//
// Run with: node scripts/test-admin-flow-rls.mjs <admin-email> <regular-email>
// or via:   node --env-file=.env.test scripts/test-admin-flow-rls.mjs <admin-email> <regular-email>

import { createClient } from '@supabase/supabase-js'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const SUPABASE_URL = requireEnv('SUPABASE_TEST_URL')
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_TEST_SERVICE_KEY')
const ANON_KEY = requireEnv('SUPABASE_TEST_ANON_KEY')
const ADMIN_EMAIL = process.argv[2]
const REGULAR_EMAIL = process.argv[3]
const PASSWORD = 'TestAdminFlow!2026'

if (!ADMIN_EMAIL || !REGULAR_EMAIL) {
  console.error('Usage: node scripts/test-admin-flow-rls.mjs <admin-email> <regular-email>')
  process.exit(1)
}

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return client
}

// Insert a known marker row via service role (bypasses RLS)
const MARKER = 'rls-test-' + Date.now()
const { data: insertedBatch, error: insertErr } = await service
  .from('media_review_batches')
  .insert({
    batch_key: MARKER,
    label: 'RLS test marker',
    status: 'pending',
    artifact_bucket: 'media-review-artifacts',
    artifact_prefix: 'test/',
    artifact_paths: {},
  })
  .select()
  .single()
if (insertErr) {
  console.error('Failed to insert test marker:', insertErr.message)
  process.exit(1)
}
console.log(`✓ Inserted marker row in media_review_batches: id=${insertedBatch.id}`)

const adminClient = await signIn(ADMIN_EMAIL)
const regularClient = await signIn(REGULAR_EMAIL)

let allOk = true

// Admin should see the marker row
const { data: adminData, error: adminErr } = await adminClient
  .from('media_review_batches')
  .select('id, batch_key')
  .eq('batch_key', MARKER)
if (adminErr) {
  console.log(`✗ Admin SELECT: ERROR ${adminErr.message}`)
  allOk = false
} else if (adminData && adminData.length === 1) {
  console.log(`✓ Admin can read media_review_batches (saw marker)`)
} else {
  console.log(`✗ Admin could NOT read marker (got ${adminData?.length || 0} rows)`)
  allOk = false
}

// Regular should NOT see the marker
const { data: regularData, error: regularErr } = await regularClient
  .from('media_review_batches')
  .select('id, batch_key')
  .eq('batch_key', MARKER)
if (regularErr) {
  console.log(`✓ Regular SELECT denied: ${regularErr.message}`)
} else if (regularData && regularData.length === 0) {
  console.log(`✓ Regular cannot read media_review_batches (0 rows)`)
} else {
  console.log(`✗ Regular saw marker (${regularData?.length || 0} rows) — SECURITY FAILURE`)
  allOk = false
}

// Also test the RPC functions (save_album_organization_v1 requires admin)
const { error: rpcErr } = await regularClient.rpc('save_album_organization_v1', {
  p_album: 'Engagement',
  p_ordered_photo_ids: [],
})
if (rpcErr && rpcErr.message.includes('admin access required')) {
  console.log(`✓ Regular RPC call (save_album_organization_v1): denied with correct message`)
} else if (rpcErr) {
  console.log(`⚠ Regular RPC denied but unexpected message: ${rpcErr.message}`)
} else {
  console.log(`✗ Regular RPC call SUCCEEDED — SECURITY FAILURE`)
  allOk = false
}

// Cleanup
await service.from('media_review_batches').delete().eq('id', insertedBatch.id)
console.log(`\n✓ Cleaned up marker row`)

console.log(`\n${allOk ? '✓ ALL RLS CHECKS PASS' : '✗ SOME CHECKS FAILED'}`)
process.exit(allOk ? 0 : 1)
