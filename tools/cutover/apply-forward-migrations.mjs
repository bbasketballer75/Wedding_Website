#!/usr/bin/env node
/* eslint-disable no-undef -- Node CLI script; the app's ESLint flat config declares browser/node globals only for TS files. */
/**
 * tools/cutover/apply-forward-migrations.mjs — apply/verify the cutover
 * migrations against a database, in order, with a manifest and hard checks.
 *
 * The frozen baseline chain (`supabase/migrations/`) is applied by Supabase as
 * usual; this script applies the additive cutover files from
 * `tools/cutover/migrations/` (R17 repair + RLS bundle S1–S7) and verifies the
 * resulting security/behaviour invariants.
 *
 * Targets (read-only verification is always safe; applying needs A2 approval):
 *   # local sandbox (docker)
 *   node tools/cutover/apply-forward-migrations.mjs --docker-container supabase_db_<ref> --verify-only
 *   node tools/cutover/apply-forward-migrations.mjs --docker-container supabase_db_<ref> --yes
 *
 *   # staging / production (owner-approved window; A2)
 *   node tools/cutover/apply-forward-migrations.mjs --db-url "$DATABASE_URL" --yes
 *
 *   # dry run: print the ordered manifest + the checks that will run
 *   node tools/cutover/apply-forward-migrations.mjs --dry-run
 *
 * Every file is re-runnable (IF EXISTS / OR REPLACE / idempotent GRANT/REVOKE),
 * but a failed apply must be investigated before retrying: check the SQLSTATE in
 * the printed output and the DB's migration history.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const migrationsDir = path.join(repoRoot, 'tools', 'cutover', 'migrations')

const argv = process.argv.slice(2)
const has = name => argv.includes(name)
const valueOf = name => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

const dbUrl = valueOf('--db-url')
const dockerContainer = valueOf('--docker-container')
const dryRun = has('--dry-run') || !(dbUrl || dockerContainer)
const verifyOnly = has('--verify-only')
const confirmed = has('--yes') || has('--confirm')

const files = readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.error('x no forward migrations found in tools/cutover/migrations')
  process.exit(1)
}

const manifest = files.map(file => {
  const text = readFileSync(path.join(migrationsDir, file), 'utf8')
  return {
    file,
    path: path.join(migrationsDir, file),
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  }
})

function runPsql(sql) {
  const args = ['-v', 'ON_ERROR_STOP=1', '-At', '-F', '|']
  let command
  let commandArgs
  if (dockerContainer) {
    command = 'docker'
    commandArgs = [
      'exec',
      '-i',
      dockerContainer,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      ...args,
    ]
  } else {
    command = 'psql'
    commandArgs = [dbUrl, ...args]
  }
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    input: sql,
    encoding: 'utf8',
  })
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`)
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.status !== 0) {
    throw new Error(`${command} exited ${result.status}:\n${combined}`)
  }
  return combined
}

function runStatement(statement) {
  return runPsql(statement)
}

const CHECKS = [
  {
    name: 'R17: submit RPC no longer references the dropped `type` column',
    sql: `select case when pg_get_functiondef('public.submit_guestbook_message_with_rate_limit'::regproc) ~* 'insert into public\\.guestbook_messages[^;]*\\([^)]*\\btype\\b' then 'FAIL' else 'OK' end;`,
  },
  {
    name: 'S1: activity_log RLS enabled + public SELECT policy only',
    sql: `select case when (select relrowsecurity from pg_class where oid='public.activity_log'::regclass) and (select count(*) from pg_policies where schemaname='public' and tablename='activity_log' and cmd='SELECT') = 1 then 'OK' else 'FAIL' end;`,
  },
  {
    name: 'S1: anon cannot INSERT/UPDATE/DELETE activity_log',
    sql: `select case when has_table_privilege('anon','public.activity_log','INSERT') or has_table_privilege('anon','public.activity_log','UPDATE') or has_table_privilege('anon','public.activity_log','DELETE') then 'FAIL' else 'OK' end;`,
  },
  {
    name: 'S2: anon cannot read guest_identities / guest_share_tokens',
    sql: `select case when has_table_privilege('anon','public.guest_identities','SELECT') or has_table_privilege('anon','public.guest_share_tokens','SELECT') then 'FAIL' else 'OK' end;`,
  },
  {
    name: 'S2: SECURITY DEFINER guest RPCs exist and are anon-executable',
    sql: `select case when to_regprocedure('public.get_guest_contributions(text)') is not null and to_regprocedure('public.resolve_guest_identity(text,text,text)') is not null and to_regprocedure('public.get_or_create_share_token(text,uuid)') is not null and has_function_privilege('anon','public.get_guest_contributions(text)','EXECUTE') and has_function_privilege('anon','public.resolve_guest_identity(text,text,text)','EXECUTE') then 'OK' else 'FAIL' end;`,
  },
  {
    name: 'S3: guest_uploads admin-only read/update policies (old authenticated policies gone)',
    sql: `select case when (select relrowsecurity from pg_class where oid='public.guest_uploads'::regclass) and exists (select 1 from pg_policies where schemaname='public' and tablename='guest_uploads' and policyname='Admin read all guest uploads') and exists (select 1 from pg_policies where schemaname='public' and tablename='guest_uploads' and policyname='Admin update guest uploads') and not exists (select 1 from pg_policies where schemaname='public' and tablename='guest_uploads' and policyname in ('Allow authenticated read all','Allow authenticated update')) then 'OK' else 'FAIL' end;`,
  },
  {
    name: 'S4: admin delete RPC exists, direct anon delete/insert revoked',
    sql: `select case when to_regprocedure('public.delete_guestbook_messages_v1(uuid[])') is not null and not has_function_privilege('anon','public.delete_guestbook_messages_v1(uuid[])','EXECUTE') and not has_table_privilege('anon','public.guestbook_messages','INSERT') and not has_table_privilege('anon','public.guestbook_messages','DELETE') then 'OK' else 'FAIL' end;`,
  },
  {
    name: 'S5: photo_likes RLS on and anon write/read revoked',
    sql: `select case when (select relrowsecurity from pg_class where oid='public.photo_likes'::regclass) and not has_table_privilege('anon','public.photo_likes','SELECT') and not has_table_privilege('anon','public.photo_likes','INSERT') then 'OK' else 'FAIL' end;`,
  },
  {
    name: 'S6: audit append RPC exists with revoked anon execute + direct insert revoked',
    sql: `select case when to_regprocedure('public.insert_moderation_audit_v1(text,uuid,text,text,jsonb,text,text)') is not null and not has_function_privilege('anon','public.insert_moderation_audit_v1(text,uuid,text,text,jsonb,text,text)','EXECUTE') and not has_table_privilege('authenticated','public.moderation_audit_log','INSERT') then 'OK' else 'FAIL' end;`,
  },
  {
    name: 'S7: anon admin-RPC surface + rate-limit helpers revoked',
    sql: `select case when not has_function_privilege('anon','public.delete_gallery_photos_v1(uuid[],text[])','EXECUTE') and not has_function_privilege('anon','public.save_album_organization_v2(text,uuid[],jsonb,uuid[])','EXECUTE') and not has_function_privilege('anon','public.check_rate_limit(text,text,integer,integer)','EXECUTE') and not has_function_privilege('anon','public.increment_rate_limit(text,text,integer)','EXECUTE') then 'OK' else 'FAIL' end;`,
  },
]

if (dryRun) {
  console.log('Cutover migrations — dry run (no database connection)')
  console.log(
    `  target: none (${dbUrl ? 'db-url supplied but --apply omitted' : dockerContainer ? 'docker container supplied but --apply omitted' : 'no --db-url/--docker-container'})`
  )
  for (const entry of manifest) {
    console.log(`  + ${entry.file}  ${entry.bytes} B  sha256 ${entry.sha256}`)
  }
  console.log('\nVerification checks that would run after apply:')
  for (const check of CHECKS) console.log(`  - ${check.name}`)
  console.log('\nPASS (dry run)')
  process.exit(0)
}

if (!verifyOnly) {
  if (!confirmed) {
    console.error(
      'x refusing to apply without --yes: applying the cutover migrations is an A2 production authorisation.\n' +
        '  Re-run with --yes only inside the owner-approved cutover window.'
    )
    process.exit(1)
  }
  console.log('Applying cutover migrations in order:')
  for (const entry of manifest) {
    console.log(`  -> ${entry.file}`)
    try {
      const output = runStatement(readFileSync(entry.path, 'utf8'))
      if (output)
        console.log(
          output
            .split('\n')
            .slice(0, 4)
            .map(line => `     ${line}`)
            .join('\n')
        )
    } catch (error) {
      console.error(`\nx apply failed for ${entry.file}:\n${error.message}`)
      process.exit(1)
    }
  }
}

console.log('\nVerifying post-cutover invariants:')
let failures = 0
for (const check of CHECKS) {
  try {
    const result = runStatement(check.sql).trim().split('\n').at(-1)?.trim()
    const ok = result === 'OK'
    if (!ok) failures += 1
    console.log(`  ${ok ? '+' : 'x'} ${check.name}${ok ? '' : ` (got ${result})`}`)
  } catch (error) {
    failures += 1
    console.log(`  x ${check.name} (query failed: ${error.message.split('\n')[0]})`)
  }
}

console.log('')
console.log(`Manifest SHA-256 (record in the cutover checkpoint):`)
for (const entry of manifest) console.log(`  ${entry.sha256}  ${entry.file}`)
console.log('')
if (failures > 0) {
  console.log(`RESULT: FAIL — ${failures} verification check(s) failed`)
  process.exit(1)
}
console.log(`RESULT: PASS — ${CHECKS.length}/${CHECKS.length} invariants hold`)
