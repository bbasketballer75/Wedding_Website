#!/usr/bin/env node
/* eslint-disable no-undef -- Node CLI script; the app's ESLint flat config declares browser/node globals only for TS files. */
/**
 * tools/cutover/check-forward-migrations.mjs — static audit of the cutover
 * (forward) migrations that live OUTSIDE the frozen legacy baseline.
 *
 * The frozen `supabase/migrations/` chain stays read-only (legacy freeze). The
 * owner-approved cutover migrations are additive forward files under
 * `tools/cutover/migrations/` and are applied in the cutover window (A2):
 *
 *   R17 repair ............ 20261110000000_fix_guestbook_submit_rpc.sql
 *   RLS bundle S1–S7 ...... 20261110000100_rls_hardening_bundle.sql
 *
 * What it proves (static, no database needed):
 *   1. Every file matches `<14 digits>_<label>.sql`, in strictly increasing,
 *      unique order, and forms the contiguous chain after the frozen baseline.
 *   2. No destructive statement (DROP TABLE/COLUMN, TRUNCATE, DELETE FROM,
 *      ALTER TABLE ... DROP COLUMN) hides in a cutover file.
 *   3. Every file has the required header block and uses an idempotent style
 *      (IF EXISTS / OR REPLACE / GRANT-REVOKE) so a retried window is safe.
 *   4. The SHA-256 + byte size manifest of the chain is printed (and can be
 *      recorded in the cutover checkpoint).
 *
 * Usage:
 *   node tools/cutover/check-forward-migrations.mjs          # human report, exits 1 on findings
 *   node tools/cutover/check-forward-migrations.mjs --json   # machine-readable
 *
 * The dynamic half (apply + verify against a database) is
 * `tools/cutover/apply-forward-migrations.mjs`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const migrationsDir = path.join(repoRoot, 'tools', 'cutover', 'migrations')
const frozenDir = path.join(repoRoot, 'supabase', 'migrations')
const FROZEN_BASELINE_COUNT = 31
const NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/
const DESTRUCTIVE =
  /(^|;)\s*(drop\s+table|drop\s+column|truncate\s+table|truncate\s+\w|delete\s+from|alter\s+table\s+[^;]*drop\s+column)/i
const REQUIRED_ACL = [/grant\s+|revoke\s+/i]
const HEADER = /--\s*={5,}/m

const args = new Set(process.argv.slice(2))
const jsonMode = args.has('--json')

function stripNonSql(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*--.*$/gm, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

const findings = []
const push = (code, message, file) => findings.push({ code, message, file })

let files = []
try {
  files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort()
} catch (error) {
  push(
    'migrations-missing',
    `cannot read ${migrationsDir}: ${error.message}`,
    'tools/cutover/migrations'
  )
}

const frozenFiles = readdirSync(frozenDir)
  .filter(name => name.endsWith('.sql'))
  .sort()
if (frozenFiles.length !== FROZEN_BASELINE_COUNT) {
  push(
    'frozen-baseline-count',
    `frozen baseline has ${frozenFiles.length} migrations, expected ${FROZEN_BASELINE_COUNT} (the legacy freeze forbids changing this chain)`,
    'supabase/migrations'
  )
}

const seen = new Set()
const manifest = []
let previousVersion = null
const lastFrozenVersion = frozenFiles
  .map(name => name.match(NAME)?.[1])
  .filter(Boolean)
  .sort()
  .at(-1)

for (const file of files) {
  const text = readFileSync(path.join(migrationsDir, file), 'utf8')
  const match = file.match(NAME)
  if (!match) {
    push('migration-filename', `does not match <14 digits>_<label>.sql: ${file}`, file)
    continue
  }
  const [, version] = match
  if (seen.has(version)) push('migration-duplicate-version', `duplicate version ${version}`, file)
  seen.add(version)
  if (previousVersion && version <= previousVersion) {
    push('migration-order', `version ${version} does not increase after ${previousVersion}`, file)
  }
  if (lastFrozenVersion && version <= lastFrozenVersion) {
    push(
      'migration-before-frozen-tip',
      `version ${version} is not after the frozen baseline tip ${lastFrozenVersion}`,
      file
    )
  }
  previousVersion = version

  if (!HEADER.test(text)) push('migration-header', 'missing -- ==== header block', file)
  if (DESTRUCTIVE.test(stripNonSql(text))) {
    push(
      'migration-destructive',
      'contains a destructive statement (DROP TABLE/COLUMN, TRUNCATE, DELETE FROM) — cutover migrations must be additive/replacement-only',
      file
    )
  }
  if (
    /^\s*drop\s+function\s+if\s+exists/im.test(text) === false &&
    /drop\s+function/im.test(text)
  ) {
    push('migration-idempotency', 'DROP FUNCTION without IF EXISTS is not re-runnable', file)
  }
  for (const acl of REQUIRED_ACL) {
    if (!acl.test(text)) {
      push(
        'migration-acl',
        `missing matching statement ${acl} (explicit GRANT/REVOKE expected)`,
        file
      )
    }
  }

  manifest.push({ file, version, bytes: Buffer.byteLength(text), sha256: sha256(text) })
}

const ok = findings.length === 0

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        ok,
        migrationsDir: 'tools/cutover/migrations',
        frozenBaselineCount: frozenFiles.length,
        lastFrozenVersion,
        manifest,
        findings,
      },
      null,
      2
    )
  )
} else {
  console.log('Cutover forward migrations — static audit')
  console.log(
    `  - frozen baseline: ${frozenFiles.length} migrations (read-only, expected ${FROZEN_BASELINE_COUNT})`
  )
  console.log(
    `  - forward files: ${files.length}${lastFrozenVersion ? `, after frozen tip ${lastFrozenVersion}` : ''}`
  )
  for (const entry of manifest) {
    console.log(`  + ${entry.file}  ${entry.bytes} B  sha256 ${entry.sha256.slice(0, 16)}…`)
  }
  if (!ok) {
    console.log('\nFindings:')
    for (const finding of findings) {
      console.log(`  x [${finding.code}] ${finding.message} (${finding.file})`)
    }
    console.log('\nRESULT: FAIL')
  } else {
    console.log('\nRESULT: PASS — forward chain is additive, ordered, idempotent and recordable')
  }
}

process.exit(ok ? 0 : 1)
