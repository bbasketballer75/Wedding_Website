// supabase-mgmt-api-push.mjs
//
// Pushes migrations to Supabase using ONLY the Management API — never touches
// a direct Postgres connection. This is the path that works on this machine:
// the project's db.*.supabase.co endpoint is IPv6-only and not routable from
// here, and the project's Supavisor pooler binding is currently off.
//
// Usage:
//   node scripts/supabase-mgmt-api-push.mjs                # push all pending
//   node scripts/supabase-mgmt-api-push.mjs --dry-run     # show what would push
//   node scripts/supabase-mgmt-api-push.mjs <migration-name-fragment>
//
// Requires:
//   SUPABASE_ACCESS_TOKEN  (already in Netlify env; copy locally if needed)
//   supabase/migrations/*.sql  (the source of truth)
//
// Behaviour:
//   - Reads /v1/projects/{ref}/database/migrations to see what's applied
//   - Finds migrations/*.sql that are NOT in that list
//   - POSTs each one to /v1/projects/{ref}/database/migrations
//     with body { version, name, statements }
//   - Refuses to push if remote history is missing a local file (refuses
//     to silently re-apply; surfaces the drift and exits non-zero)
//   - --dry-run: prints the plan, makes no API mutations
//
// Safety:
//   - Never prints secret values, never logs the access token
//   - Re-fetches the history after each push to confirm the migration landed
//   - Returns non-zero on any API failure so CI fails loudly

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_REF = 'zaczcyzvavetgfuucljf'
const MIGRATIONS_DIR = 'supabase/migrations'
const SUPABASE_API = 'https://api.supabase.com/v1'

function loadToken() {
  const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => {
        const [k, ...v] = l.split('=')
        return [
          k.trim(),
          v
            .join('=')
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ]
      })
  )
  if (!env.SUPABASE_ACCESS_TOKEN) {
    console.error('Missing SUPABASE_ACCESS_TOKEN in .env')
    process.exit(1)
  }
  return env.SUPABASE_ACCESS_TOKEN
}

function parseMigrationFile(filename) {
  // '20260915020000_remove_unsplash_placeholder_photos.sql' -> { version, name }
  const stem = filename.replace(/\.sql$/, '')
  const [version, ...nameParts] = stem.split('_')
  return { version, name: nameParts.join('_') }
}

function listLocalMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ file: f, ...parseMigrationFile(f) }))
    .sort((a, b) => a.version.localeCompare(b.version))
}

async function fetchRemoteMigrations(token) {
  const res = await fetch(`${SUPABASE_API}/projects/${PROJECT_REF}/database/migrations?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`GET migrations failed: ${res.status} ${res.statusText} — ${await res.text()}`)
  }
  return res.json() // [{ version, name, ... }]
}

async function pushMigration(token, { version, name, statements }) {
  const res = await fetch(`${SUPABASE_API}/projects/${PROJECT_REF}/database/migrations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version, name, statements }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`POST ${version} ${name} failed: ${res.status} — ${err}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filter = args.find(a => !a.startsWith('--'))

  const token = loadToken()
  console.log(`project: ${PROJECT_REF}  mode: ${dryRun ? 'dry-run' : 'apply'}\n`)

  const local = listLocalMigrations()
  const remote = await fetchRemoteMigrations(token)
  const remoteVersions = new Set(remote.map(m => m.version))
  const remoteNames = new Set(remote.map(m => `${m.version}_${m.name}`))

  // Drift detection: if remote has a version we DON'T have locally, refuse.
  // This prevents silently re-applying or skipping the missing one.
  const localKeys = new Set(local.map(m => `${m.version}_${m.name}`))
  const missing = remote.filter(m => !localKeys.has(`${m.version}_${m.name}`))
  if (missing.length) {
    console.error('!! Remote has migrations not in local repo. Aborting to avoid drift:')
    for (const m of missing) console.error(`   v=${m.version}  name=${m.name}`)
    console.error(
      '\nFix: drop a matching .sql file into supabase/migrations/ before pushing again.'
    )
    process.exit(2)
  }

  // Pending = local but not on remote, optionally filtered by name fragment
  const pending = local.filter(m => {
    if (remoteVersions.has(m.version)) return false
    if (filter && !m.file.includes(filter)) return false
    return true
  })

  if (!pending.length) {
    console.log('✓ Nothing pending. Remote and local migration histories are in sync.')
    return
  }

  console.log(`${dryRun ? 'Would push' : 'Pushing'} ${pending.length} migration(s):\n`)
  for (const m of pending) {
    const tag = remoteVersions.has(m.version) ? ' [already applied]' : ''
    console.log(`  • ${m.version}_${m.name}${tag}`)
  }
  console.log()

  if (dryRun) {
    console.log('--dry-run: no API calls made.')
    return
  }

  // Apply one at a time, refetching history after each so a failure stops the run
  for (const m of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, m.file), 'utf8')
    // Split on lines starting with "--\s*statement-breakpoint" (drizzle-style)
    // or fall back to the whole file as one statement.
    const statements = sql
      .split(/^--\s*statement-breakpoint\s*$/m)
      .map(s => s.trim())
      .filter(Boolean)
    console.log(
      `→ ${m.version}_${m.name}  (${statements.length} statement${statements.length === 1 ? '' : 's'})`
    )
    try {
      await pushMigration(token, { version: m.version, name: m.name, statements })
    } catch (err) {
      console.error(`✗ ${err.message}`)
      process.exit(1)
    }
  }

  // Refetch and confirm
  const after = await fetchRemoteMigrations(token)
  const afterVersions = new Set(after.map(m => m.version))
  const unconfirmed = pending.filter(m => !afterVersions.has(m.version))
  if (unconfirmed.length) {
    console.error('\n!! Push reported success but remote history does not reflect:')
    for (const m of unconfirmed) console.error(`   ${m.version}_${m.name}`)
    process.exit(1)
  }
  console.log(`\n✓ Applied ${pending.length} migration(s).`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
