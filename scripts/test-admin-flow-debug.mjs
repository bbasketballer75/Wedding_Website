// Debug: directly call is_admin() RPC as admin user to see what it returns.
//
// Local-only debug helper. Reads creds from env so secrets stay out of git.
//
// Required env (load via .env.test, .env, or export manually):
//   SUPABASE_TEST_URL              e.g. http://127.0.0.1:54321
//   SUPABASE_TEST_SERVICE_KEY      local service-role key (sb_secret_...)
//   SUPABASE_TEST_ANON_KEY         local anon/publishable key (sb_publishable_...)
//
// Run with: node scripts/test-admin-flow-debug.mjs <admin-email>
// or via:   node --env-file=.env.test scripts/test-admin-flow-debug.mjs <admin-email>

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
const PASSWORD = 'TestAdminFlow!2026'

if (!ADMIN_EMAIL) {
  console.error('Usage: node scripts/test-admin-flow-debug.mjs <admin-email>')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1. Service role client — auth.jwt() returns NULL (no user context)
const { data: svcResult, error: svcErr } = await admin.rpc('is_admin')
console.log(`Service role client is_admin(): ${svcResult} (error: ${svcErr?.message || 'none'})`)

// 2. Anon sign in, then call is_admin() via RPC
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: PASSWORD,
})
if (signInErr) {
  console.error('Sign in failed:', signInErr.message)
  process.exit(1)
}

console.log(`\nAdmin user JWT payload:`)
const payload = JSON.parse(
  Buffer.from(signInData.session.access_token.split('.')[1], 'base64url').toString('utf8')
)
console.log(`  app_metadata: ${JSON.stringify(payload.app_metadata)}`)
console.log(`  role claim: ${payload.role}`)

const { data: userResult, error: userErr } = await anon.rpc('is_admin')
console.log(`\nAdmin user RPC is_admin(): ${userResult} (error: ${userErr?.message || 'none'})`)
