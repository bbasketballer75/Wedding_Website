// Test script: creates an admin and a non-admin user on local Supabase,
// promotes the admin via promote_to_admin(), then prints session tokens for
// Playwright to use for verification.
//
// Local-only RLS test helper. Reads creds from env so secrets stay out of git.
//
// Required env (load via .env.test, .env, or export manually):
//   SUPABASE_TEST_URL              e.g. http://127.0.0.1:54321
//   SUPABASE_TEST_SERVICE_KEY      local service-role key (sb_secret_...)
//   SUPABASE_TEST_ANON_KEY         local anon/publishable key (sb_publishable_...)
//
// Run with: node scripts/test-admin-flow-setup.mjs
// or via:   node --env-file=.env.test scripts/test-admin-flow-setup.mjs

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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_PASSWORD = 'TestAdminFlow!2026'

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user
}

async function promoteToAdmin(userId) {
  // promote_to_admin is SECURITY DEFINER and revoked from anon/authenticated.
  // We call it with the service-role client so the grant bypasses the revoke.
  const { error } = await admin.rpc('promote_to_admin', {
    target_user_id: userId,
  })
  if (error) throw new Error(`promoteToAdmin ${userId}: ${error.message}`)
}

async function getAppMetadata(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) throw new Error(`getUserById ${userId}: ${error.message}`)
  return data.user.app_metadata
}

async function signIn(email) {
  // Use anon client to do a real password sign-in (what the UI does)
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return data
}

async function main() {
  console.log('=== Admin Flow Test Setup ===\n')

  // 1. Create admin user
  const adminEmail = `test-admin-${Date.now()}@example.com`
  const adminUser = await createUser(adminEmail)
  console.log(`✓ Created admin user: ${adminEmail} (id=${adminUser.id})`)

  // 2. Create non-admin user
  const regularEmail = `test-regular-${Date.now()}@example.com`
  const regularUser = await createUser(regularEmail)
  console.log(`✓ Created regular user: ${regularEmail} (id=${regularUser.id})`)

  // 3. Promote admin via RPC
  await promoteToAdmin(adminUser.id)
  const adminMeta = await getAppMetadata(adminUser.id)
  console.log(`✓ Promoted admin via promote_to_admin()`)
  console.log(`  app_metadata: ${JSON.stringify(adminMeta)}`)

  const regularMeta = await getAppMetadata(regularUser.id)
  console.log(`  regular user app_metadata: ${JSON.stringify(regularMeta)}`)

  // 4. Sign in both to get fresh JWTs (with updated app_metadata)
  const adminSession = await signIn(adminEmail)
  const regularSession = await signIn(regularEmail)

  // The admin JWT should have app_metadata.role='admin' in the JWT payload
  // (decoded from the access_token). Print a snippet of the decoded payload.
  const decodeJwtPayload = token => {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  }

  console.log(
    `\n✓ Admin JWT app_metadata: ${JSON.stringify(decodeJwtPayload(adminSession.session.access_token).app_metadata)}`
  )
  console.log(
    `✓ Regular JWT app_metadata: ${JSON.stringify(decodeJwtPayload(regularSession.session.access_token).app_metadata)}`
  )

  console.log(`\n=== SETUP COMPLETE ===`)
  console.log(`Save these for Playwright verification:`)
  console.log(`ADMIN_EMAIL=${adminEmail}`)
  console.log(`ADMIN_PASSWORD=${TEST_PASSWORD}`)
  console.log(`ADMIN_ACCESS_TOKEN=${adminSession.session.access_token}`)
  console.log(`ADMIN_REFRESH_TOKEN=${adminSession.session.refresh_token}`)
  console.log(`REGULAR_EMAIL=${regularEmail}`)
  console.log(`REGULAR_PASSWORD=${TEST_PASSWORD}`)
  console.log(`REGULAR_ACCESS_TOKEN=${regularSession.session.access_token}`)
  console.log(`REGULAR_REFRESH_TOKEN=${regularSession.session.refresh_token}`)
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
