/**
 * Focused regression tests for the parity harness changes.
 *
 * Covers the behaviours that were wrong:
 *
 *  1. The admin session key the harness seeds must be the key the app actually
 *     reads — derived from the served VITE_SUPABASE_URL, not the contract
 *     fixture's real-project key.
 *
 *  2. An admin row that could not be authenticated must be reported as an
 *     `error`, never as a `pass`. Two sides that both landed on the login
 *     screen would otherwise compare as equal and the job would exit green
 *     having measured nothing.
 *
 *  3. The job's exit code must reflect that error.
 *
 *  4. The workflow guard must resolve a `matrix.mjs` invocation with matrix.mjs's
 *     OWN parser (a bad flag / bad selector must be rejected), and accept the
 *     exact invocation the workflow now uses.
 *
 * Run:  node --test tools/parity/parity-harness.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PARITY = join(ROOT, 'tools', 'parity')
const GUARD = join(ROOT, 'tools', 'check-parity-workflow-args.mjs')
const REBUILD_WORKFLOW = join(ROOT, '.github', 'workflows', 'rebuild.yml')

const { adminSessionStorageKey } = await import(
  new URL('./mocks/index.mjs', import.meta.url).href
)

test('admin session key follows the served URL, not the fixture', () => {
  const fixtures = { admin: { storageKey: 'sb-zaczcyzvavetgfuucljf-auth-token' } }
  const saved = process.env.VITE_SUPABASE_URL
  try {
    process.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co'
    assert.equal(
      adminSessionStorageKey({ fixtures }),
      'sb-placeholder-auth-token',
      'must seed the key @supabase/supabase-js reads from the URL it was built with',
    )
    process.env.VITE_SUPABASE_URL = 'https://faurvrckvatfcswsyobc.supabase.co'
    assert.equal(
      adminSessionStorageKey({ fixtures }),
      'sb-faurvrckvatfcswsyobc-auth-token',
    )
  } finally {
    if (saved === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = saved
  }
})

test('admin session key falls back to the contract fixture without a URL', () => {
  const saved = process.env.VITE_SUPABASE_URL
  try {
    delete process.env.VITE_SUPABASE_URL
    assert.equal(
      adminSessionStorageKey({ fixtures: { admin: { storageKey: 'sb-fallback-auth-token' } } }),
      'sb-fallback-auth-token',
    )
  } finally {
    if (saved !== undefined) process.env.VITE_SUPABASE_URL = saved
  }
})

test('an un-authenticated admin row is an error, not a pass', () => {
  const source = readFileSync(join(PARITY, 'matrix.mjs'), 'utf8')
  assert.ok(
    source.includes("const status = captureClass === 'exempt' ? 'error' : shot.status"),
    'buildRows must report an exempt (un-authenticated) admin row as an error',
  )
  assert.ok(
    source.includes("if (rows.some(row => row.status === 'error')) exitCode = Math.max(exitCode, 1)"),
    'the job exit code must reflect an unmeasured row',
  )
  assert.ok(
    source.includes('admin row not measured: ${exemptReason}'),
    'the exemption reason must survive into the failure reasons',
  )
})

test('the workflow guard resolves matrix.mjs with matrix.mjs own parser', () => {
  const guard = readFileSync(GUARD, 'utf8')
  assert.ok(
    /tools\\\/parity\\\/\(compare\|matrix\)/.test(guard),
    'the guard must match both harnesses',
  )
  assert.ok(guard.includes('parseMatrixArgs'), 'the guard must use matrix.mjs own parser')
  assert.ok(
    guard.includes("from './parity/matrix.mjs'"),
    'parseMatrixArgs must be imported from matrix.mjs, not a copied flag list',
  )
})

test('the guard accepts the invocation the workflow now uses', () => {
  const stdout = execFileSync('node', [GUARD], { cwd: ROOT, encoding: 'utf8' })
  assert.match(stdout, /parity workflow invocations valid/)
})

test('the guard rejects a bad matrix flag and a bad selector', () => {
  const original = readFileSync(REBUILD_WORKFLOW, 'utf8')
  const scratch = mkdtempSync(join(tmpdir(), 'parity-guard-'))
  try {
    // The guard scans a directory of workflow files; point it at a scratch copy
    // so the repo's own workflow file is never mutated by a test.
    const run = () =>
      execFileSync('node', [GUARD, '--workflows-dir', scratch], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })

    // The repo's own invocation must pass.
    writeFileSync(join(scratch, 'rebuild.yml'), original, 'utf8')
    assert.match(run(), /parity workflow invocations valid/)

    // An unknown flag must be rejected by the harness's own parser.
    writeFileSync(
      join(scratch, 'rebuild.yml'),
      original.replace('--wave 9', '--wave 9 --all'),
      'utf8',
    )
    assert.throws(() => run(), /unknown argument "--all"/)

    // An unknown selector must be rejected against the routes contract.
    writeFileSync(
      join(scratch, 'rebuild.yml'),
      original.replace('--routes all', '--routes priortiy'),
      'utf8',
    )
    assert.throws(() => run(), /unknown route "priortiy"/)

    // A compare.mjs invocation with an unknown flag must be rejected too.
    writeFileSync(
      join(scratch, 'rebuild.yml'),
      original.replace('tools/parity/matrix.mjs', 'tools/parity/compare.mjs'),
      'utf8',
    )
    assert.throws(() => run(), /unknown argument "--no-admin"/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  // The repo's workflow file must be byte-identical to how it started.
  assert.equal(readFileSync(REBUILD_WORKFLOW, 'utf8'), original)
})
