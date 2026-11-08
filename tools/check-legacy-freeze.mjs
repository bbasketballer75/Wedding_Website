#!/usr/bin/env node
/**
 * Enforces the legacy freeze.
 *
 * The frozen legacy app is the parity oracle for the greenfield rebuild: if its
 * source moves, every golden screenshot and text snapshot captured against it
 * becomes unreliable. This script fails when anything outside the explicit
 * workbench allowlist changed since the freeze tag.
 *
 * Allowed exact paths:
 *   package.json  package-lock.json  eslint.config.js  .prettierignore
 *   .gitignore    AGENTS.md
 * Plus one documented exception (2026-11-08):
 *   supabase/migrations/20260624000000_fix_guestbook_rpc_drop_type.sql
 *   — a hand-reconstructed migration that was missing four semicolons and made
 *   `supabase db reset` fail; a syntax-only repair (no SQL semantics changed).
 *   Migrations never enter the client bundle, so the parity oracle is unaffected.
 * Allowed new paths (prefixes):
 *   contracts/  docs/rebuild/  tools/  rebuild/
 *   .github/workflows/rebuild.yml
 *
 * Usage:
 *   node tools/check-legacy-freeze.mjs           # exit 1 on violations
 *   node tools/check-legacy-freeze.mjs --json
 *   FREEZE_TAG=<tag> node tools/check-legacy-freeze.mjs
 */
import { execFileSync } from 'node:child_process'
import { FREEZE_TAG, repoRoot } from './lib/paths.mjs'

const args = new Set(process.argv.slice(2))
const JSON_OUTPUT = args.has('--json')

const ALLOWED_EXACT = new Set([
  'package.json',
  'package-lock.json',
  'eslint.config.js',
  '.prettierignore',
  '.gitignore',
  'AGENTS.md',
  // Documented narrow exception — see the usage header. Syntax-only repair of a
  // migration that could not parse; remove this entry if the migration is ever
  // squashed/rewritten at cutover.
  'supabase/migrations/20260624000000_fix_guestbook_rpc_drop_type.sql',
])

const ALLOWED_PREFIXES = ['contracts/', 'docs/rebuild/', 'tools/', 'rebuild/']

const ALLOWED_FILES = new Set(['.github/workflows/rebuild.yml'])

const normalize = value => value.replace(/\\/g, '/').replace(/^"|"$/g, '').trim()

function isAllowed(filePath) {
  if (ALLOWED_EXACT.has(filePath) || ALLOWED_FILES.has(filePath)) return true
  return ALLOWED_PREFIXES.some(prefix => filePath.startsWith(prefix))
}

function git(gitArgs) {
  return execFileSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' })
}

function tagExists() {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${FREEZE_TAG}`], {
      cwd: repoRoot,
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

if (!tagExists()) {
  const message = `freeze tag "${FREEZE_TAG}" does not exist — create it before auditing`
  if (JSON_OUTPUT) process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`)
  else console.error(`  x ${message}`)
  process.exit(2)
}

const changes = []

// Committed changes on the rebuild branch since the freeze point.
const committed = git(['diff', '--name-status', `${FREEZE_TAG}..HEAD`])
  .split('\n')
  .filter(Boolean)

for (const line of committed) {
  const [status, ...rest] = line.split('\t')
  if (rest.length === 0) continue
  changes.push({ status, path: normalize(rest[rest.length - 1]) })
  if (rest.length === 2) changes.push({ status: `${status} (source)`, path: normalize(rest[0]) })
}

// Uncommitted / untracked working-tree changes.
const working = git(['status', '--porcelain=v1']).split('\n').filter(Boolean)
for (const line of working) {
  const status = line.slice(0, 2).trim() || '??'
  const rest = line.slice(3)
  if (rest.includes(' -> ')) {
    const [from, to] = rest.split(' -> ')
    changes.push({ status: `${status} (renamed to)`, path: normalize(to) })
    changes.push({ status: `${status} (renamed from)`, path: normalize(from) })
  } else {
    changes.push({ status, path: normalize(rest) })
  }
}

const violations = changes.filter(change => !isAllowed(change.path))
const deletions = changes.filter(change => change.status.startsWith('D') && !isAllowed(change.path))
const allowed = changes.filter(change => isAllowed(change.path))

const payload = {
  ok: violations.length === 0,
  freezeTag: FREEZE_TAG,
  changed: changes.length,
  allowed: allowed.map(change => `${change.status} ${change.path}`),
  violations: violations.map(change => `${change.status} ${change.path}`),
  deletions: deletions.map(change => `${change.status} ${change.path}`),
}

if (JSON_OUTPUT) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
} else if (violations.length === 0) {
  console.log(
    `\n> Legacy freeze intact (${changes.length} allowlisted change(s) since ${FREEZE_TAG})`
  )
  for (const change of allowed) console.log(`  + ${change.status} ${change.path}`)
} else {
  console.error(`\n> Legacy freeze VIOLATED: ${violations.length} path(s) outside the allowlist`)
  for (const change of violations) console.error(`  x ${change.status} ${change.path}`)
  if (deletions.length > 0) {
    console.error('  Deleting legacy files is never allowed before cutover.')
  }
  console.error(
    '  Allowed: package.json, package-lock.json, eslint.config.js, .prettierignore, ' +
      '.gitignore, AGENTS.md, contracts/**, docs/rebuild/**, tools/**, rebuild/**, ' +
      '.github/workflows/rebuild.yml'
  )
}

process.exit(violations.length === 0 ? 0 : 1)
