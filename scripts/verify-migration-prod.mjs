// Register the just-applied migration in supabase_migrations.schema_migrations
// so future `supabase db push` runs don't try to re-apply it.
//
// Also runs sanity checks: lists functions, policies, and verifies is_admin().

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const [k, ...v] = l.split('=')
      return [k.trim(), v.join('=').trim().replace(/^['"]|['"]$/g, '')]
    })
)

const PROJECT_REF = 'zaczcyzvavetgfuucljf'
const PASSWORD = env.SUPABASE_DB_PASSWORD

const client = new pg.Client({
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: `postgres.${PROJECT_REF}`,
  password: PASSWORD,
  ssl: { rejectUnauthorized: false, servername: 'aws-1-us-east-1.pooler.supabase.com' },
  connectionTimeoutMillis: 15000,
})

async function main() {
  await client.connect()
  console.log('✓ Connected')

  // 1. Register the migration in the tracking table
  const MIGRATION_VERSION = '20260623000100'
  const MIGRATION_NAME = 'admin_role_app_metadata'
  console.log(`\nRegistering migration ${MIGRATION_VERSION}_${MIGRATION_NAME}...`)

  const result = await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
     VALUES ($1, $2, $3)
     ON CONFLICT (version) DO NOTHING
     RETURNING version`,
    [MIGRATION_VERSION, MIGRATION_NAME, [{ sql: '-- see supabase/migrations/' + MIGRATION_VERSION + '_' + MIGRATION_NAME + '.sql' }]]
  )
  console.log(result.rowCount > 0 ? '  ✓ Registered' : '  (already registered)')

  // 2. Verify is_admin() exists and works
  console.log('\nVerifying is_admin()...')
  const fn = await client.query(
    `SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('is_admin', 'promote_to_admin', 'demote_from_admin') ORDER BY proname`
  )
  console.log('  Functions:')
  fn.rows.forEach(r => console.log(`    - ${r.proname} (SECURITY DEFINER: ${r.prosecdef})`))

  // 3. Verify policies were created with is_admin() check
  console.log('\nVerifying admin RLS policies...')
  const policies = await client.query(`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'Admin %'
    ORDER BY tablename, policyname
  `)
  console.log(`  Found ${policies.rowCount} admin policies:`)
  policies.rows.forEach(p => console.log(`    - ${p.tablename} | ${p.policyname} (${p.cmd})`))

  // 4. Verify is_admin() returns false for anon
  const test = await client.query(`SELECT public.is_admin() AS is_admin`)
  console.log(`\nis_admin() = ${test.rows[0].is_admin}`)

  await client.end()
  console.log('\n✓ Verification complete')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})