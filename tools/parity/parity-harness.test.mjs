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
  assert.ok(
    guard.includes('matrixParseArgs') && guard.includes('.parseArgs'),
    'the guard must use matrix.mjs own parser'
  )
  assert.ok(
    // Lazily imported so the guard cannot die on a missing native `sharp`;
    // it must still come from matrix.mjs itself, never a copied flag list.
    /await import\('\.\/parity\/matrix\.mjs'\)/.test(guard),
    'parseMatrixArgs must be imported from matrix.mjs, not a copied flag list'
  )
  assert.ok(
    !/^import\s*\{[^}]*parseArgs[^}]*\}\s*from\s*'\.\/parity\/matrix\.mjs'/m.test(guard),
    'matrix.mjs must not be imported statically (that path pulls in sharp)'
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

test('CI flags still reject an unauthenticated protected route', async () => {
  // The CI invocation passes `--no-admin`, which only removes the synthetic admin
  // child sections. The `auth: admin` CONTRACT route stays in the matrix, so its
  // authentication must still be verified. Keying the exemption on `includeAdmin`
  // made this exact configuration report `pass` for two login screens.
  const { buildRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const { loadRoutesContract, adminCaptureRoutes } = await import(
    new URL('./config.mjs', import.meta.url).href
  )
  const contract = await loadRoutesContract()
  const protectedRoutes = new Set(
    [...contract.routes, ...adminCaptureRoutes()]
      .filter(route => route.auth === 'admin')
      .map(route => route.id)
  )

  const shot = (route, legacyPath, rebuildPath) => ({
    key: `${route}__desktop__dark`,
    route,
    urlPath: '/',
    viewport: 'desktop',
    theme: 'dark',
    status: 'pass',
    failureReasons: [],
    legacy: { finalUrl: `http://127.0.0.1:4174${legacyPath}` },
    rebuild: { finalUrl: `http://127.0.0.1:4175${rebuildPath}` },
  })

  // CI covers the protected contract route even though it excludes the synthetic sections.
  const ciShots = [
    shot('admin', '/admin/login', '/admin/login'),
    shot('admin', '/admin', '/admin'),
    shot('admin-login', '/admin/login', '/admin/login'),
  ]
  const rows = buildRows(ciShots, { includeAdmin: false, protectedRoutes })
  const byKey = index => rows[index]

  assert.equal(byKey(0).status, 'error', 'a protected route that never authenticated must not pass')
  assert.equal(byKey(0).captureClass, 'exempt')
  assert.ok(
    byKey(0).failureReasons.some(reason => String(reason).includes('admin row not measured')),
    'the exemption reason must be recorded'
  )
  assert.equal(byKey(1).status, 'pass', 'an authenticated protected row must still pass')
  assert.equal(byKey(1).captureClass, 'captured')
  assert.equal(
    byKey(2).status,
    'pass',
    'admin-login is auth: none — a login screen is its correct capture'
  )

  // One-sided redirects are just as unmeasured as a double redirect.
  for (const pair of [
    ['/admin/login', '/admin'],
    ['/admin', '/admin/login'],
  ]) {
    const [row] = buildRows([shot('admin', pair[0], pair[1])], {
      includeAdmin: false,
      protectedRoutes,
    })
    assert.equal(
      row.status,
      'error',
      `one-sided login redirect must not pass (${pair.join(' vs ')})`
    )
  }

  // The contract really does mark a retained route auth: admin — the guard above
  // would be vacuous if it did not.
  assert.ok(
    contract.routes.some(route => route.auth === 'admin'),
    'at least one contract route must require admin auth'
  )

  // Calling buildRows directly cannot detect a regression at the CALL SITE: drop
  // `protectedRoutes` from runMatrix and every assertion above still passes. Pin
  // the wiring, and require the protected set to be derived from the contract's
  // auth rather than from `includeAdmin`.
  const source = readFileSync(join(PARITY, 'matrix.mjs'), 'utf8')
  assert.ok(
    /buildRows\(compareResult\.summary\.shots \?\? \[\],\s*\{[^}]*protectedRoutes/s.test(source),
    'runMatrix must pass protectedRoutes into buildRows'
  )
  assert.ok(
    /protectedRouteIds\(\[\.\.\.routesContract\.routes, \.\.\.extraRoutes\]\)/.test(
      source.replace(/\s+/g, ' ')
    ),
    'the protected set must be derived from the contract routes plus generated ones'
  )
  assert.ok(
    /function protectedRouteIds\(routes\)\s*\{\s*return new Set\(routes\.filter\(route => route\.auth === 'admin'\)/s.test(
      source
    ),
    "protectedRouteIds must key on the route's own `auth`, not on includeAdmin"
  )
})

test('login detection parses the pathname, so URL variants cannot slip through', async () => {
  const { buildRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const { loadRoutesContract } = await import(new URL('./config.mjs', import.meta.url).href)
  const contract = await loadRoutesContract()
  const protectedRoutes = new Set(
    contract.routes.filter(route => route.auth === 'admin').map(route => route.id)
  )
  const shot = path => ({
    route: 'admin',
    status: 'pass',
    failureReasons: [],
    legacy: { finalUrl: `http://127.0.0.1:4174${path}` },
    rebuild: { finalUrl: `http://127.0.0.1:4175${path}` },
  })

  // Every one of these IS the unmeasured login state. A suffix test reports the
  // last four as genuine captures, which is the same fail-open class as the
  // includeAdmin gate.
  for (const path of [
    '/admin/login',
    '/admin/login/',
    '/admin/login?next=%2Fadmin%2Fphotos',
    '/admin/login#form',
  ]) {
    const [row] = buildRows([shot(path)], { includeAdmin: false, protectedRoutes })
    assert.equal(row.status, 'error', `login state must not pass: ${path}`)
  }

  // A real admin page must still pass — the detector must not over-fire.
  for (const path of ['/admin', '/admin/photos', '/admin/login-help']) {
    const [row] = buildRows([shot(path)], { includeAdmin: false, protectedRoutes })
    assert.equal(row.status, 'pass', `a genuine admin page must pass: ${path}`)
  }
})

test('the uploaded receipt names every flag the invocation used', async () => {
  const { describeInvocation, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )

  // The receipt must describe the invocation the CI job ACTUALLY makes. Parse
  // the real argv so the receipt cannot drift from the invocation, and assert
  // the signed-off flags are present and the unpassed ones are absent.
  const argv = [
    '--legacy-url',
    'http://127.0.0.1:4174',
    '--rebuild-url',
    'http://127.0.0.1:4175',
    '--routes',
    'all',
    '--matrix',
    'all',
    '--themes',
    'dark,light',
    '--edge-tolerance',
    '1',
    '--no-admin',
    '--prerender',
    '--wave',
    '9',
    '--out',
    'tools/parity/output/ci',
  ]
  const text = describeInvocation(parseArgs(argv).options)
  for (const flag of [
    '--routes all',
    '--matrix all',
    '--themes dark,light',
    '--edge-tolerance 1',
    '--no-admin',
    '--prerender',
    '--wave 9',
  ]) {
    assert.ok(text.includes(flag), `receipt must record ${flag} (got: ${text})`)
  }

  // The output directory IS part of the invocation and must be named, so the
  // receipt identifies the artifacts it describes.
  assert.ok(
    text.includes('--out ') && text.includes('tools/parity/output/ci'),
    `receipt must record the --out directory (got: ${text})`
  )

  // These were NOT passed by the CI invocation. The harness defaults them, and
  // printing a default as if it were passed makes the receipt a claim the
  // invocation never made.
  for (const flag of ['--max-diff-ratio', '--pixel-threshold', '--resume']) {
    assert.ok(!text.includes(flag), `an unpassed flag must not be claimed: ${flag} (got: ${text})`)
  }

  // When the flag IS passed, the receipt must name it with its effective value.
  const withTolerances = describeInvocation(
    parseArgs([...argv, '--max-diff-ratio', '0.002', '--pixel-threshold', '0.2']).options
  )
  assert.ok(
    withTolerances.includes('--max-diff-ratio 0.002'),
    `receipt must record a passed tolerance (got: ${withTolerances})`
  )
  assert.ok(
    withTolerances.includes('--pixel-threshold 0.2'),
    `receipt must record a passed threshold (got: ${withTolerances})`
  )
})

test('buildRows refuses to run without the protected-route set', async () => {
  const { buildRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  // A default of `new Set()` would silently disable the auth gate for any
  // caller that forgot it — the same fail-open this gate exists to prevent.
  assert.throws(
    () => buildRows([], { includeAdmin: false }),
    /requires protectedRoutes/,
    'buildRows must fail loudly rather than default the protected set to empty'
  )
})

test('a protected row with no recorded final URL is an error, not a pass', async () => {
  const { buildRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const { loadRoutesContract } = await import(new URL('./config.mjs', import.meta.url).href)
  const contract = await loadRoutesContract()
  const protectedRoutes = new Set(
    contract.routes.filter(route => route.auth === 'admin').map(route => route.id)
  )
  const shot = {
    route: 'admin',
    status: 'pass',
    failureReasons: [],
    legacy: { finalUrl: null },
    rebuild: { finalUrl: null },
  }
  const [row] = buildRows([shot], { includeAdmin: false, protectedRoutes })
  assert.equal(row.status, 'error', 'an unmeasured protected row must not pass')
  assert.match(row.exemptReason, /no final URL/)
})

test('the admin session key honours an explicit build-URL override', async () => {
  const { parseArgs } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const saved = process.env.VITE_SUPABASE_URL
  try {
    // The ambient env says one project; the preview under test was BUILT with
    // another. The override must win, or the harness seeds a key the app never
    // reads and the admin rows silently degrade to the login screen.
    process.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co'
    const options = parseArgs([
      '--legacy-url',
      'http://127.0.0.1:4174',
      '--rebuild-url',
      'http://127.0.0.1:4175',
      '--supabase-url',
      'https://other-project.supabase.co',
    ]).options
    assert.equal(
      adminSessionStorageKey({ fixtures: {}, supabaseUrl: options.supabaseUrl }),
      'sb-other-project-auth-token',
      'the explicit build URL must override the ambient env'
    )
  } finally {
    if (saved === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = saved
  }
})

test('the capture path threads the build-URL override through every hop', () => {
  // A half-wired override is a runtime ReferenceError in the capture path, not
  // a parse error: `warmUpContext` referenced `supabaseUrl` without ever
  // binding it, and every row failed with "supabaseUrl is not defined".
  // Assert the plumbing statically so the next hop cannot be left unwired.
  const capture = readFileSync(join(PARITY, 'capture.mjs'), 'utf8')

  // `warmUpContext` must bind the value it forwards.
  const warm = capture.match(/async function warmUpContext\(\s*browser,\s*\{([^}]*)\}\s*\)/)
  assert.ok(warm, 'warmUpContext must still take an options bag')
  assert.match(
    warm[1],
    /supabaseUrl/,
    'warmUpContext must bind supabaseUrl — it forwards it to preparePage'
  )

  // Every preparePage call site must pass it.
  const calls = [...capture.matchAll(/preparePage\(\s*page,\s*\{([^}]*)\}\s*\)/g)]
  assert.ok(calls.length >= 2, `expected both preparePage call sites, found ${calls.length}`)
  for (const call of calls) {
    assert.match(call[1], /supabaseUrl/, 'every preparePage call must forward supabaseUrl')
  }

  // compare.mjs must hand it to each captureShot call.
  const compare = readFileSync(join(PARITY, 'compare.mjs'), 'utf8')
  const shots = [...compare.matchAll(/captureShot\(\s*browser,\s*\{([^}]*)\}\s*\)/g)]
  assert.ok(shots.length >= 2, `expected both captureShot call sites, found ${shots.length}`)
  for (const shot of shots) {
    assert.match(shot[1], /supabaseUrl/, 'every captureShot call must forward supabaseUrl')
  }
})

test('the option-normalization hop preserves the build-URL override', async () => {
  // A source-text regex cannot see this hop: `compare.mjs` builds its options
  // through `normalizeOptions`, a closed literal. If that literal omits the
  // key, the override is parsed, documented and forwarded — then silently
  // dropped, and the caller falls back to the ambient VITE_SUPABASE_URL, which
  // is exactly the failure this flag exists to prevent. Assert it BEHAVIOURALLY.
  const { normalizeOptions } = await import(new URL('./compare.mjs', import.meta.url).href)

  const normalized = normalizeOptions({ supabaseUrl: 'https://other-project.supabase.co' })
  assert.ok(
    'supabaseUrl' in normalized,
    'normalizeOptions must carry supabaseUrl — otherwise the override never reaches capture'
  )
  assert.equal(
    normalized.supabaseUrl,
    'https://other-project.supabase.co',
    'the override must survive normalization unchanged'
  )

  // Absent by default, so a caller that passes nothing gets no override and the
  // harness falls back to the ambient env exactly as before.
  assert.equal(normalizeOptions({}).supabaseUrl, null)
})

test('the workflow guard does not need the native image library', () => {
  // A static import of matrix.mjs pulls sharp via diff.mjs and kills the whole
  // guard with ERR_MODULE_NOT_FOUND before it reads any workflow.
  const guard = readFileSync(GUARD, 'utf8')
  assert.ok(
    !/^import\s*\{[^}]*parseArgs[^}]*\}\s*from\s*'\.\/parity\/matrix\.mjs'/m.test(guard),
    'matrix.mjs must not be imported statically (it pulls sharp)'
  )
  assert.ok(
    /await import\('\.\/parity\/matrix\.mjs'\)/.test(guard),
    'matrix.mjs must be imported lazily inside the matrix branch'
  )
})

test('no parity module statically imports the native image library', () => {
  // The guard's module graph reaches sharp through matrix.mjs -> compare.mjs ->
  // {diff,report}.mjs. A static import there meant a missing native binary
  // killed the guard with ERR_MODULE_NOT_FOUND before it read a workflow file;
  // the guard must work on a machine without the binary.
  for (const file of ['diff.mjs', 'report.mjs']) {
    const source = readFileSync(join(PARITY, file), 'utf8')
    assert.ok(
      !/^import\s+sharp\s+from\s+'sharp'/m.test(source),
      `${file} must not statically import sharp`
    )
    assert.ok(/await import\('sharp'\)/.test(source), `${file} must import sharp lazily`)
  }
})
