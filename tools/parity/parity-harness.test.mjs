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

const { adminSessionStorageKey } = await import(new URL('./mocks/index.mjs', import.meta.url).href)

test('admin session key follows the served URL, not the fixture', () => {
  const fixtures = { admin: { storageKey: 'sb-zaczcyzvavetgfuucljf-auth-token' } }
  const saved = process.env.VITE_SUPABASE_URL
  try {
    process.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co'
    assert.equal(
      adminSessionStorageKey({ fixtures }),
      'sb-placeholder-auth-token',
      'must seed the key @supabase/supabase-js reads from the URL it was built with'
    )
    process.env.VITE_SUPABASE_URL = 'https://faurvrckvatfcswsyobc.supabase.co'
    assert.equal(adminSessionStorageKey({ fixtures }), 'sb-faurvrckvatfcswsyobc-auth-token')
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
      'sb-fallback-auth-token'
    )
  } finally {
    if (saved !== undefined) process.env.VITE_SUPABASE_URL = saved
  }
})

test('an un-authenticated admin row is an error, not a pass', () => {
  const source = readFileSync(join(PARITY, 'matrix.mjs'), 'utf8')
  assert.ok(
    source.includes("const status = captureClass === 'exempt' ? 'error' : shot.status"),
    'buildRows must report an exempt (un-authenticated) admin row as an error'
  )
  assert.ok(
    source.includes(
      "if (rows.some(row => row.status === 'error')) exitCode = Math.max(exitCode, 1)"
    ),
    'the job exit code must reflect an unmeasured row'
  )
  assert.ok(
    source.includes('admin row not measured: ${exemptReason}'),
    'the exemption reason must survive into the failure reasons'
  )
})

test('the workflow guard resolves matrix.mjs with matrix.mjs own parser', () => {
  const guard = readFileSync(GUARD, 'utf8')
  assert.ok(
    /tools\\\/parity\\\/\(compare\|matrix\)/.test(guard),
    'the guard must match both harnesses'
  )
  assert.ok(guard.includes('parseMatrixArgs'), 'the guard must use matrix.mjs own parser')
  assert.ok(
    guard.includes("from './parity/matrix.mjs'"),
    'parseMatrixArgs must be imported from matrix.mjs, not a copied flag list'
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
      'utf8'
    )
    assert.throws(() => run(), /unknown argument "--all"/)

    // An unknown selector must be rejected against the routes contract.
    writeFileSync(
      join(scratch, 'rebuild.yml'),
      original.replace('--routes all', '--routes priortiy'),
      'utf8'
    )
    assert.throws(() => run(), /unknown route "priortiy"/)

    // A compare.mjs invocation with an unknown flag must be rejected too.
    writeFileSync(
      join(scratch, 'rebuild.yml'),
      original.replace('tools/parity/matrix.mjs', 'tools/parity/compare.mjs'),
      'utf8'
    )
    assert.throws(() => run(), /unknown argument "--no-admin"/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  // The repo's workflow file must be byte-identical to how it started.
  assert.equal(readFileSync(REBUILD_WORKFLOW, 'utf8'), original)
})

test('every pauseAt jumps forward from its install, so the capture clock cannot stall', () => {
  const source = readFileSync(join(PARITY, 'capture.mjs'), 'utf8')

  // A warmup page installs a clock and never pauses it, so target the PAUSE
  // sites rather than the first `install(` in the file. `[^\n]*` (greedy, one
  // line) is deliberate: a non-greedy `[\s\S]*?` stops at the FIRST `)` —
  // the one closing `new Date(...)` — and would hide a trailing `.getTime()+1`
  // from every assertion below, so the guard would pass on the bug.
  const pauses = [...source.matchAll(/page\.clock\.pauseAt\(([^\n]*)\)/g)]
  assert.ok(pauses.length >= 1, 'capture.mjs must pause the fake clock somewhere')

  for (const pause of pauses) {
    const pauseExpr = pause[1].replace(/\s+/g, ' ').trim()
    // Playwright's pauseAt only jumps FORWARD. Pausing at the install time plus
    // an offset throws "Cannot fast-forward to the past" as soon as more than
    // that offset of real time elapses between the two awaited calls, which
    // made `gallery__mobile__dark` error and took the whole matrix to exit 2.
    assert.ok(
      !/\.getTime\(\)\s*\+/.test(pauseExpr),
      `pauseAt must not use an offset (got ${pauseExpr})`
    )
    assert.ok(
      !/LEAD_MS/.test(pauseExpr),
      `pauseAt must land exactly on the parked time (got ${pauseExpr})`
    )

    // The install that arms this pause must lead the parked time.
    const before = source.slice(0, pause.index)
    const installIdx = before.lastIndexOf('page.clock.install(')
    assert.ok(installIdx !== -1, 'a pause must be preceded by an install')
    const installExpr = before.slice(installIdx).replace(/\s+/g, ' ')
    assert.ok(
      /FIXED_NOW_LEAD_MS/.test(installExpr),
      'the install immediately before a pause must lead by a named margin'
    )
  }

  const lead = source.match(/FIXED_NOW_LEAD_MS\s*=\s*(\d+)/)
  assert.ok(lead, 'FIXED_NOW_LEAD_MS must be a numeric literal')
  assert.ok(Number(lead[1]) >= 100, `FIXED_NOW_LEAD_MS must be >= 100 ms (got ${lead[1]})`)
})
