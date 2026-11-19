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
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

test('an un-authenticated admin row is an error, not a pass', async () => {
  // BEHAVIOURAL, not a source-text check: a source-shape assertion passes on
  // a mapping that is present but not wired to the value a caller consumes.
  // Assert the value: an exempt row must come back as an error, with its
  // reason, and the exit signal must follow it.
  const { buildRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const protectedRoutes = new Set(['admin'])
  const exemptShot = {
    route: 'admin',
    status: 'pass',
    failureReasons: [],
    legacy: { finalUrl: 'http://127.0.0.1:4174/admin/login' },
    rebuild: { finalUrl: 'http://127.0.0.1:4174/admin/login' },
  }
  const [row] = buildRows([exemptShot], { includeAdmin: false, protectedRoutes })
  assert.equal(row.status, 'error', 'an un-authenticated admin row must be an error')
  assert.equal(row.captureClass, 'exempt', 'the row must record that it was exempt')
  assert.ok(
    row.failureReasons.some(reason => reason.includes('admin row not measured')),
    `the exemption reason must survive into the failure reasons (got: ${JSON.stringify(row.failureReasons)})`
  )

  // A row that WAS measured must still be allowed to pass — the error mapping
  // must not swallow genuine captures.
  const [good] = buildRows(
    [
      {
        route: 'admin',
        status: 'pass',
        failureReasons: [],
        legacy: { finalUrl: 'http://127.0.0.1:4174/admin' },
        rebuild: { finalUrl: 'http://127.0.0.1:4175/admin' },
      },
    ],
    { includeAdmin: false, protectedRoutes }
  )
  assert.equal(good.status, 'pass', 'a genuinely captured admin row must still pass')

  const source = readFileSync(join(PARITY, 'matrix.mjs'), 'utf8')
  assert.ok(
    source.includes("const status = captureClass === 'exempt' ? 'error' : shot.status"),
    'buildRows must report an exempt (un-authenticated) admin row as an error'
  )
  assert.ok(
    source.includes('exitCode = matrixExitCode(rows, exitCode, { prerender, options })'),
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
    // Target the INVOCATION line specifically: `matrix.mjs` now also appears
    // in the job's readiness guard, and a bare first-occurrence replace would
    // rewrite that instead and leave the invocation valid.
    writeFileSync(
      join(scratch, 'rebuild.yml'),
      original.replace('node tools/parity/matrix.mjs', 'node tools/parity/compare.mjs'),
      'utf8'
    )
    assert.throws(() => run(), /unknown argument "--no-admin"/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  // The repo's workflow file must be byte-identical to how it started.
  assert.equal(readFileSync(REBUILD_WORKFLOW, 'utf8'), original)
})

test('the production path refuses to publish a summary whose tally does not add up', () => {
  const compareSource =
    'export const SCHEMA_VERSION = 1; export const runCompare = bag => globalThis.fixtureCompare(bag);'
  // A row whose status is not one of the four tally buckets makes
  // pass + allowed + fail + error come to LESS than the row count. The
  // summary must then be REFUSED rather than published: an artifact whose
  // buckets do not sum to its own row count is a claim about a set that
  // does not exist, and it is the artifact a reviewer reads.
  const fixtureSource = `bag => ({
    exitCode: 0,
    summary: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      oracle: { legacyUrl: bag.legacyUrl, rebuildUrl: bag.rebuildUrl },
      selection: { plannedShots: ['home__desktop__dark', 'home__desktop__light'] },
      shots: [
        {
          key: 'home__desktop__dark', route: 'home', urlPath: '/', viewport: 'desktop', theme: 'dark',
          status: 'pass',
          legacy: { finalUrl: bag.legacyUrl + '/' }, rebuild: { finalUrl: bag.rebuildUrl + '/' },
        },
        {
          key: 'home__desktop__light', route: 'home', urlPath: '/', viewport: 'desktop', theme: 'light',
          status: 'not-a-bucket',
          legacy: { finalUrl: bag.legacyUrl + '/' }, rebuild: { finalUrl: bag.rebuildUrl + '/' },
        },
      ],
    },
  })`
  const out = runMatrixCli({
    argv: [
      '--legacy-url',
      'http://127.0.0.1:4174',
      '--rebuild-url',
      'http://127.0.0.1:4175',
      '--out',
      mkdtempSync(join(tmpdir(), 'matrix-tally-')),
    ],
    compareSource,
    fixtureSource,
  })
  assert.notEqual(
    out.exitStatus,
    0,
    'an inconsistent tally must fail the run, not publish a summary that does not add up'
  )
  assert.equal(
    out.summaryExists,
    false,
    'no summary may be published when the tally does not sum to the row count'
  )
  assert.match(
    out.stderr,
    /tally is inconsistent/,
    `the refusal must say why (stderr: ${out.stderr ?? ''})`
  )
})

test("the parity job's readiness guard checks the harness it actually runs", () => {
  const workflow = readFileSync(REBUILD_WORKFLOW, 'utf8')
  // The signed-off baseline invokes `matrix.mjs`. Gating readiness on
  // `compare.mjs` was legacy coupling: if that file were removed the job
  // would skip silently and still report green.
  assert.match(
    workflow,
    /if \[ -f tools\/parity\/matrix\.mjs \]/,
    'the readiness guard must check matrix.mjs, the harness the job invokes'
  )
  assert.doesNotMatch(
    workflow,
    /if \[ -f tools\/parity\/compare\.mjs \]/,
    'the readiness guard must not gate on compare.mjs'
  )
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
      /CLOCK_LEAD_MS|clockInstallTime/.test(installExpr),
      'the install immediately before a pause must lead by a named margin'
    )
  }

  const lead = source.match(/CLOCK_LEAD_MS\s*=\s*(\d+)/)
  assert.ok(lead, 'CLOCK_LEAD_MS must be a numeric literal')
  assert.ok(Number(lead[1]) >= 100, `CLOCK_LEAD_MS must be >= 100 ms (got ${lead[1]})`)
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
  // `protectedRoutes` from the production wiring and every assertion above still
  // passes. The production path is `assembleRows`, which derives the protected
  // set from the contract's own `auth` — so pin THAT, and require the wiring
  // to use it.
  const source = readFileSync(join(PARITY, 'matrix.mjs'), 'utf8')
  assert.ok(
    /buildRows\(summary\?\.shots \?\? \[\],\s*\{[^}]*protectedRoutes/s.test(source),
    'assembleRows must pass the derived protected set into buildRows'
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
  // And the production call site must USE that function, so the derived set
  // cannot be swapped for an empty one at the seam.
  assert.ok(
    /const rows = assembleRows\(compareResult\.summary,\s*\{[^}]*routesContract/s.test(
      source.replace(/\s+/g, ' ')
    ),
    'runMatrix must build its rows through assembleRows'
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
  const calls = [...capture.matchAll(/preparePage\(\s*page,\s*preparePageOptions\(/g)]
  assert.ok(calls.length >= 2, `expected both preparePage call sites, found ${calls.length}`)

  // The seam that builds those options must carry the value.
  const seam = capture.match(/export function preparePageOptions\(\{([^}]*)\}\)\s*\{([\s\S]*?)\n\}/)
  assert.ok(seam, 'preparePageOptions must exist as the single place the capture options are built')
  assert.match(
    seam[1],
    /supabaseUrl/,
    'preparePageOptions must bind supabaseUrl — it forwards it to preparePage'
  )
  assert.match(seam[2], /supabaseUrl/, 'preparePageOptions must return supabaseUrl')

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

test('every hop of the build-URL override is covered behaviourally', async () => {
  // Two hops of the chain survived mutation with the suite green: the
  // matrix -> runCompare option mapping, and the capture-side binding. A
  // source-text check cannot see either one. Each hop now has an exported
  // seam that is asserted on the VALUE, not on the source text.
  const { compareOptions, parseArgs } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const { preparePageOptions } = await import(new URL('./capture.mjs', import.meta.url).href)

  const URL_OVERRIDE = 'https://other-project.supabase.co'
  const parsed = parseArgs([
    '--legacy-url',
    'http://127.0.0.1:4174',
    '--rebuild-url',
    'http://127.0.0.1:4175',
    '--supabase-url',
    URL_OVERRIDE,
  ]).options

  // Hop 1: matrix CLI options -> the comparison harness's option bag.
  const compareOpts = compareOptions(parsed, [])
  assert.equal(
    compareOpts.supabaseUrl,
    URL_OVERRIDE,
    'the matrix -> runCompare hop must carry supabaseUrl'
  )

  // Hop 2: the capture-side binding -> the options preparePage receives.
  const pageOpts = preparePageOptions({
    theme: 'dark',
    mode: 'admin',
    fixtures: {},
    supabaseUrl: compareOpts.supabaseUrl,
  })
  assert.equal(pageOpts.supabaseUrl, URL_OVERRIDE, 'the capture-side hop must carry supabaseUrl')
})

test('the receipt names the build-URL override but never a credential', async () => {
  const { describeInvocation, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  const base = [
    '--legacy-url',
    'http://127.0.0.1:4174',
    '--rebuild-url',
    'http://127.0.0.1:4175',
    '--supabase-url',
    'https://other-project.supabase.co',
  ]
  const text = describeInvocation(parseArgs(base).options)
  assert.ok(
    text.includes('--supabase-url https://other-project.supabase.co'),
    `the receipt must name the build-URL override (got: ${text})`
  )

  // The receipt is published as an uploaded CI artifact, so a credential must
  // never appear in it — but the receipt must still say whether the app's own
  // sign-in flow was attempted.
  const withSecret = describeInvocation(
    parseArgs([...base, '--admin-email', 'admin@test.wedding', '--admin-password', 'hunter2'])
      .options
  )
  assert.ok(!withSecret.includes('hunter2'), 'the receipt must never name the admin password')
  assert.ok(
    !withSecret.includes('admin@test.wedding'),
    'the receipt must never name the admin email'
  )
  const noLogin = describeInvocation(parseArgs([...base, '--no-admin-login']).options)
  assert.ok(
    noLogin.includes('--no-admin-login'),
    'the receipt must record that the sign-in flow was disabled'
  )
  // `--json` changes what the harness prints, so it belongs in the receipt.
  const withJson = describeInvocation(parseArgs([...base, '--json']).options)
  assert.ok(withJson.includes('--json'), 'the receipt must name --json when it was passed')
})

test('the receipt records every flag except the two that carry a secret', async () => {
  const { describeInvocation, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  // The contract: the receipt names every flag the invocation used, EXCEPT the
  // two that carry a credential (publishing the receipt would leak them).
  const all = [
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
    '--json',
    '--no-admin-login',
    '--admin-email',
    'admin@test.wedding',
    '--admin-password',
    'hunter2',
  ]
  const text = describeInvocation(parseArgs(all).options)
  const omitted = ['--admin-email', '--admin-password']
  for (const flag of omitted) {
    assert.ok(!text.includes(flag), `${flag} carries a secret and must not be in the receipt`)
  }
  // Everything else that was passed must be named.
  for (const flag of [
    '--routes all',
    '--matrix all',
    '--themes dark,light',
    '--edge-tolerance 1',
    '--no-admin',
    '--prerender',
    '--wave 9',
    '--out tools/parity/output/ci',
    '--json',
    '--no-admin-login',
  ]) {
    assert.ok(text.includes(flag), `the receipt must record ${flag} (got: ${text})`)
  }
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

test('the guard resolves matrix.mjs lazily and only when it must', () => {
  // The guard must run on a machine where `matrix.mjs` cannot be loaded at
  // all — its module graph pulls in the native image library. The import must
  // therefore be LAZY: evaluated only when a matrix.mjs invocation actually
  // has to be parsed, and never when the guard has no matrix invocation to
  // check.
  //
  // Prove that BEHAVIOURALLY: run the guard under a module loader that
  // RECORDS every load of `parity/matrix.mjs`. A compare-only workflows
  // directory must record NOTHING (the module was never evaluated); a
  // directory with a matrix.mjs invocation must record a load. A STATIC
  // import would record a load in both cases and fail the first assertion.
  const scratch = mkdtempSync(join(tmpdir(), 'parity-guard-lazy-'))
  try {
    const recorder = join(scratch, 'loaded.txt')
    const loader = join(scratch, 'record-load.mjs')
    writeFileSync(
      loader,
      "import { register } from 'node:module'\n" +
        "register(new URL('hook.mjs', import.meta.url))\n"
    )
    writeFileSync(
      join(scratch, 'hook.mjs'),
      "import { appendFileSync } from 'node:fs'\n" +
        'export function resolve(specifier, context, next) {\n' +
        "  if (specifier.endsWith('parity/matrix.mjs')) {\n" +
        `    appendFileSync(${JSON.stringify(recorder)}, 'loaded\\n')\n` +
        '  }\n' +
        '  return next(specifier, context)\n' +
        '}\n'
    )
    writeFileSync(
      join(scratch, 'only-compare.yml'),
      'jobs:\n  build:\n    steps:\n      - run: node tools/parity/compare.mjs --legacy-url http://127.0.0.1:4174 --rebuild-url http://127.0.0.1:4175 --routes all --matrix all\n'
    )
    const stdout = execFileSync(
      'node',
      ['--import', pathToFileURL(loader).href, GUARD, '--workflows-dir', scratch],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    )
    assert.match(
      stdout,
      /parity workflow invocations valid/,
      `the guard must accept a compare-only workflows directory (got: ${stdout})`
    )
    assert.ok(
      !existsSync(recorder),
      'the guard must not evaluate matrix.mjs when there is no matrix.mjs invocation to check'
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  // And when a matrix.mjs invocation IS present, the guard must resolve it
  // with matrix.mjs's own parser: a bad matrix flag must be rejected.
  const scratch2 = mkdtempSync(join(tmpdir(), 'parity-guard-matrix-'))
  try {
    const recorder2 = join(scratch2, 'loaded.txt')
    const loader2 = join(scratch2, 'record-load.mjs')
    writeFileSync(
      loader2,
      "import { register } from 'node:module'\n" +
        "register(new URL('hook.mjs', import.meta.url))\n"
    )
    writeFileSync(
      join(scratch2, 'hook.mjs'),
      "import { appendFileSync } from 'node:fs'\n" +
        'export function resolve(specifier, context, next) {\n' +
        "  if (specifier.endsWith('parity/matrix.mjs')) {\n" +
        `    appendFileSync(${JSON.stringify(recorder2)}, 'loaded\\n')\n` +
        '  }\n' +
        '  return next(specifier, context)\n' +
        '}\n'
    )
    writeFileSync(
      join(scratch2, 'bad-matrix.yml'),
      'jobs:\n  build:\n    steps:\n      - run: node tools/parity/matrix.mjs --legacy-url http://127.0.0.1:4174 --rebuild-url http://127.0.0.1:4175 --all\n'
    )
    let failed = false
    try {
      execFileSync(
        'node',
        ['--import', pathToFileURL(loader2).href, GUARD, '--workflows-dir', scratch2],
        {
          cwd: ROOT,
          encoding: 'utf8',
        }
      )
    } catch (error) {
      failed = true
      assert.match(String(error.stderr ?? ''), /unknown argument/, 'the bad flag must be named')
    }
    assert.ok(failed, 'the guard must reject a bad matrix.mjs flag')
    assert.ok(
      existsSync(recorder2),
      'the guard must evaluate matrix.mjs when there IS a matrix.mjs invocation to check'
    )
  } finally {
    rmSync(scratch2, { recursive: true, force: true })
  }
})

test('the capture clock is installed before the parked time', async () => {
  // The lead is what stops `pauseAt` throwing "Cannot fast-forward to the
  // past". Assert it on the VALUE: the install instant must be strictly
  // BEFORE the parked time, by a lead large enough to absorb the real time
  // that elapses between the two awaited calls.
  const { clockInstallTime, CLOCK_LEAD_MS } = await import(
    new URL('./capture.mjs', import.meta.url).href
  )
  const parked = '2026-11-08T17:00:00.000Z'
  const install = clockInstallTime(parked)

  assert.ok(
    install.getTime() < new Date(parked).getTime(),
    'the clock must be installed BEFORE the parked time'
  )
  assert.equal(
    install.getTime(),
    new Date(parked).getTime() - CLOCK_LEAD_MS,
    'the install instant must be exactly the lead before the parked time'
  )
  assert.ok(
    CLOCK_LEAD_MS >= 100,
    `the lead must absorb more than 1 ms of real time (got ${CLOCK_LEAD_MS})`
  )
})

test('the job exit code reflects an unmeasured row', async () => {
  // The signal a caller consumes, asserted on the VALUE. A source-text check
  // on the mapping passes even when the exit code is never raised — which is
  // the fail-open this gate exists to close.
  const { exitCodeForRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  assert.equal(
    exitCodeForRows([{ status: 'error' }], 0),
    1,
    'an unmeasured row must raise the exit code'
  )
  assert.equal(
    exitCodeForRows([{ status: 'pass' }, { status: 'allowed' }], 0),
    0,
    'measured rows must leave the exit code alone'
  )
  assert.equal(
    exitCodeForRows([{ status: 'error' }], 1),
    1,
    'an existing failure must not be lowered'
  )
})

test('the production row wiring protects the admin route from the contract', async () => {
  // The PRODUCTION path, not a copy of its logic: `assembleRows` derives the
  // protected set from the route contract, so the call site cannot hand
  // `buildRows` an empty or `includeAdmin`-conditioned set and silently
  // disable the auth gate.
  const { assembleRows } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const { loadRoutesContract } = await import(new URL('./config.mjs', import.meta.url).href)
  const contract = await loadRoutesContract()

  const adminRoute = contract.routes.find(route => route.auth === 'admin')
  assert.ok(adminRoute, 'the contract must declare an auth: admin route')

  // The shot the gate exists for: both sides landed on the login screen.
  const loginShot = {
    key: `${adminRoute.id}__desktop__dark`,
    route: adminRoute.id,
    urlPath: adminRoute.path,
    viewport: 'desktop',
    theme: 'dark',
    status: 'pass',
    failureReasons: [],
    legacy: { finalUrl: 'http://127.0.0.1:4174/admin/login' },
    rebuild: { finalUrl: 'http://127.0.0.1:4175/admin/login' },
  }

  // `--no-admin` removes the synthetic admin child sections. It must NOT
  // remove the contract route's protection.
  const rows = assembleRows(
    { shots: [loginShot] },
    { includeAdmin: false, routesContract: contract, extraRoutes: [] }
  )
  assert.equal(rows.length, 1)
  assert.equal(
    rows[0].status,
    'error',
    'the production wiring must report an unauthenticated admin row as an error'
  )

  // And a genuinely captured admin row must still pass through it.
  const okRows = assembleRows(
    {
      shots: [
        {
          ...loginShot,
          legacy: { finalUrl: 'http://127.0.0.1:4174/admin' },
          rebuild: { finalUrl: 'http://127.0.0.1:4175/admin' },
        },
      ],
    },
    { includeAdmin: false, routesContract: contract, extraRoutes: [] }
  )
  assert.equal(okRows[0].status, 'pass', 'a genuinely captured admin row must still pass')
})

test('the production exit-code wiring raises on an unmeasured row', async () => {
  // The PRODUCTION path: `matrixExitCode` owns BOTH the row check and the
  // prerender check, so emptying the rows before the call — or dropping the
  // prerender check — changes the job's verdict.
  const { matrixExitCode } = await import(new URL('./matrix.mjs', import.meta.url).href)
  assert.equal(
    matrixExitCode([{ status: 'error' }], 0),
    1,
    'an unmeasured row must raise the production exit code'
  )
  assert.equal(
    matrixExitCode([{ status: 'pass' }], 0),
    0,
    'measured rows must leave the production exit code alone'
  )
  assert.equal(
    matrixExitCode([{ status: 'pass' }], 0, {
      prerender: { status: 'fail', verdict: 'fail' },
      options: { prerender: true },
    }),
    1,
    'a failed prerender check must raise the production exit code'
  )
  assert.equal(
    matrixExitCode([{ status: 'pass' }], 0, {
      prerender: { status: 'fail' },
      options: { prerender: false },
    }),
    0,
    'a prerender result must not raise the code when prerender was not requested'
  )
})

test('the capture-side and storage-key hops carry the override', async () => {
  const { preparePageOptions } = await import(new URL('./capture.mjs', import.meta.url).href)
  const { prepareStorageKey } = await import(new URL('./mocks/index.mjs', import.meta.url).href)

  const URL_OVERRIDE = 'https://other-project.supabase.co'

  // The capture-side hop: the options preparePage receives must carry it.
  const pageOpts = preparePageOptions({
    theme: 'dark',
    mode: 'admin',
    fixtures: {},
    supabaseUrl: URL_OVERRIDE,
  })
  assert.equal(pageOpts.supabaseUrl, URL_OVERRIDE, 'the capture-side hop must carry the override')

  // The LAST hop: the key actually seeded into localStorage must be derived
  // from the override, not from the ambient env.
  const saved = process.env.VITE_SUPABASE_URL
  try {
    process.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co'
    assert.equal(
      prepareStorageKey({ mode: 'admin', fixtures: {}, supabaseUrl: URL_OVERRIDE }),
      'sb-other-project-auth-token',
      'the seeded key must come from the explicit build URL'
    )
    assert.equal(
      prepareStorageKey({ mode: 'admin', fixtures: {} }),
      'sb-placeholder-auth-token',
      'without an override the ambient env still applies'
    )
    assert.equal(
      prepareStorageKey({ mode: 'public', fixtures: {}, supabaseUrl: URL_OVERRIDE }),
      '',
      'a public capture seeds no admin session at all'
    )
  } finally {
    if (saved === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = saved
  }
})

/* ------------------------------------------------------------------ */
/* Round 6 — the sixth reviewer's five conditions                      */
/* ------------------------------------------------------------------ */

const CI_ARGV = [
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

test('condition 1 — the published summary CARRIES the invocation receipt', async () => {
  const { matrixOverview, describeInvocation, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  const options = parseArgs(CI_ARGV).options
  const overview = matrixOverview(
    { generatedAt: 'T', oracle: {}, tolerance: {}, determinism: {}, selection: {} },
    [],
    { includeAdmin: false, prerender: null, outDir: 'out', options }
  )
  assert.equal(
    overview.command,
    describeInvocation(options),
    'the summary artifact must carry the receipt of the invocation that produced it'
  )
  assert.ok(
    overview.command.includes('--out tools/parity/output/ci'),
    `the receipt must name the output dir (got: ${overview.command})`
  )
  assert.ok(
    !overview.command.includes('--max-diff-ratio'),
    'the receipt must not claim a flag the invocation never passed'
  )
})

test('condition 1 — the summary carries the prerender block it was given', async () => {
  const { matrixOverview, parseArgs } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const options = parseArgs(CI_ARGV).options
  const prerender = {
    status: 'pending',
    verdict: 'pending',
    waived: true,
    waiverReason: 'W8-1 prerendering has not landed',
    expectedRoutes: 9,
    rebuildPrerendered: 0,
  }
  const overview = matrixOverview(
    { generatedAt: 'T', oracle: {}, tolerance: {}, determinism: {}, selection: {} },
    [],
    { includeAdmin: false, prerender, outDir: 'out', options }
  )
  assert.deepEqual(
    overview.prerender,
    prerender,
    'the published summary must carry the prerender block verbatim'
  )
})

test('condition 2 — the comparison receives every field its measurement depends on', async () => {
  const { matrixCompare, REQUIRED_COMPARE_FIELDS, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  const options = parseArgs(CI_ARGV).options
  let received = null
  await matrixCompare(options, [], async bag => {
    received = bag
    return { summary: { shots: [] } }
  })
  assert.ok(received, 'the comparison must be invoked')
  for (const field of REQUIRED_COMPARE_FIELDS) {
    assert.ok(
      received[field] !== undefined && received[field] !== null,
      `the comparison option bag must carry ${field} (got: ${received[field]})`
    )
  }
  assert.equal(received.routes, 'all', 'routes selects the full matrix')
  assert.equal(received.matrix, 'all', 'matrix selects the full matrix')
  assert.equal(received.themes, 'dark,light')
  assert.equal(received.wave, 9)
  assert.equal(received.edgeTolerance, 1)
  assert.ok(received.adminLogin, 'the sign-in flow must reach the comparison')
})

test('condition 2 — the production compare step FAILS CLOSED on a dropped field', async () => {
  const { matrixCompare, parseArgs } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const options = parseArgs(CI_ARGV).options
  // `routes` gone => the harness would measure the priority subset (24 rows)
  // and still exit 0. The production step must refuse instead.
  const broken = { ...options }
  delete broken.routes
  await assert.rejects(
    () => matrixCompare(broken, [], async () => ({ summary: { shots: [] } })),
    /missing required field\(s\): routes/,
    'a narrowed option bag must be refused, not measured'
  )
})

test('condition 2 — the production compare step carries the admin sections', async () => {
  const { matrixCompare, parseArgs } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const options = parseArgs(CI_ARGV).options
  const extraRoutes = [{ id: 'admin-photos', path: '/admin/photos' }]
  let received = null
  await matrixCompare(options, extraRoutes, async bag => {
    received = bag
    return { summary: { shots: [] } }
  })
  assert.deepEqual(
    received.extraRoutes,
    extraRoutes,
    'the generated admin sections must reach the comparison'
  )
})

test('condition 3 — the prerender ladder classifies every state', async () => {
  const { classifyPrerender } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const pass = classifyPrerender({ expectedRoutes: 9, rebuildPrerendered: 9 })
  assert.equal(pass.verdict, 'pass')
  assert.equal(pass.waived, false)

  const fail = classifyPrerender({ expectedRoutes: 9, rebuildPrerendered: 3 })
  assert.equal(fail.verdict, 'fail', 'partial prerendering is inconsistent output')
  assert.equal(fail.waived, false)

  const none = classifyPrerender({ expectedRoutes: 9, rebuildPrerendered: 0 })
  assert.equal(none.verdict, 'pending')
  assert.equal(
    none.waived,
    true,
    'the pre-W8-1 pending state must be an EXPLICIT waiver, not a silent pass'
  )
  assert.match(none.waiverReason, /0 of 9/, 'the waiver must record what was measured')

  const na = classifyPrerender({ expectedRoutes: 0, rebuildPrerendered: 0 })
  assert.equal(na.verdict, 'not-applicable')
  assert.equal(na.waived, false)
})

test('condition 3 — a failed prerender raises the job exit code', async () => {
  const { matrixExitCode, classifyPrerender, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  const options = parseArgs(CI_ARGV).options
  const rows = [{ status: 'pass' }]
  const fail = classifyPrerender({ expectedRoutes: 9, rebuildPrerendered: 3 })
  assert.equal(
    matrixExitCode(rows, 0, { prerender: fail, options }),
    1,
    'an inconsistent prerender output must not pass the job'
  )
  // A pending (waived) prerender must not redden today's CI, but it must not
  // silently claim to have asserted anything either.
  const pending = classifyPrerender({ expectedRoutes: 9, rebuildPrerendered: 0 })
  assert.equal(matrixExitCode(rows, 0, { prerender: pending, options }), 0)
  assert.equal(pending.waived, true)
})

test('condition 4 — an EMPTY matrix is not green', async () => {
  const { assertRowsComplete } = await import(new URL('./matrix.mjs', import.meta.url).href)
  assert.throws(
    () => assertRowsComplete([], null),
    /assembled 0 rows/,
    'a run that measured nothing must be refused'
  )
  assert.throws(
    () => assertRowsComplete([], []),
    /assembled 0 rows/,
    'an empty plan with no rows is still an empty measurement'
  )
  assert.throws(
    () => assertRowsComplete([{ status: 'pass' }], ['a', 'b']),
    /2 shots were planned/,
    'a row count that contradicts the plan must be refused'
  )
  // A matching plan passes.
  const rows = [{ status: 'pass' }]
  assert.deepEqual(assertRowsComplete(rows, ['a']), rows)
})

test('condition 2 — dropping ANY required field from the bag is refused', async () => {
  const { matrixCompare, REQUIRED_COMPARE_FIELDS, parseArgs } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  const options = parseArgs(CI_ARGV).options
  // The EXPECTED contract is written out here, independently of the exported
  // list. Iterating the exported list would let a field dropped FROM that
  // list go untested — the test would quietly stop covering it.
  const EXPECTED_FIELDS = [
    'routes',
    'matrix',
    'themes',
    'wave',
    'edgeTolerance',
    'maxDiffRatio',
    'pixelThreshold',
    'adminLogin',
    'outDir',
    'extraRoutes',
  ]
  assert.deepEqual(
    [...REQUIRED_COMPARE_FIELDS].sort(),
    [...EXPECTED_FIELDS].sort(),
    'the required-field contract must not lose a field — a dropped field is a silent measurement gap'
  )
  // Every field in the contract must be load-bearing: removing it from the
  // bag has to make the production step refuse, not measure a narrower run.
  for (const field of EXPECTED_FIELDS) {
    if (field === 'extraRoutes') {
      // `extraRoutes` is not a CLI option — it is the generated admin
      // section list, passed separately. A malformed one must be refused.
      await assert.rejects(
        () => matrixCompare(options, 'not-an-array', async () => ({ summary: { shots: [] } })),
        /missing required field\(s\): extraRoutes/,
        'a malformed extraRoutes must be refused, not measured'
      )
      continue
    }
    const broken = { ...options }
    delete broken[field]
    await assert.rejects(
      () => matrixCompare(broken, [], async () => ({ summary: { shots: [] } })),
      new RegExp(`missing required field\\(s\\): ${field}`),
      `dropping ${field} must be refused, not measured`
    )
  }
})

test('condition 2 — the mapping hop is the ONLY way to build the comparison bag', async () => {
  const { compareOptions, parseArgs } = await import(new URL('./matrix.mjs', import.meta.url).href)
  const options = parseArgs(CI_ARGV).options
  const extraRoutes = [{ id: 'admin-photos', path: '/admin/photos' }]
  const bag = compareOptions(options, extraRoutes)
  // `compareOptions` must SPREAD the whole option bag, so a new option cannot
  // be dropped by forgetting to list it. If it built an explicit list
  // instead, `report` and every future field would silently vanish.
  assert.equal(bag.report, true, 'the comparison must be told to write its report')
  for (const key of Object.keys(options)) {
    assert.ok(key in bag, `the mapping hop must carry ${key}`)
  }
  assert.deepEqual(bag.extraRoutes, extraRoutes)
})

function runMatrixCli({ argv, compareSource, fixtureSource }) {
  const outDir = mkdtempSync(join(tmpdir(), 'matrix-cli-'))
  const compareUrl = pathToFileURL(join(PARITY, 'compare.mjs')).href
  const matrixPath = join(PARITY, 'matrix.mjs')
  const matrixUrl = pathToFileURL(matrixPath).href
  // The CLI must write into the directory the parent reads back. Only the
  // VALUE after `--out` is replaced; replacing every occurrence of the flag
  // would also rewrite the value that follows it.
  const cliArgv = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') {
      cliArgv.push('--out', outDir)
      index += 1
      continue
    }
    cliArgv.push(argv[index])
  }
  // The driver runs as its own FILE. Inlining it as a template literal nests
  // three levels of escaping, and a mistake there reads as a harness failure
  // rather than as the defect under test.
  const driverDir = mkdtempSync(join(tmpdir(), 'matrix-cli-driver-'))
  const driverPath = join(driverDir, 'driver.mjs')
  const driverSource = [
    "import { registerHooks } from 'node:module'",
    'let received',
    'globalThis.fixtureCompare = bag => {',
    '  received = bag',
    '  return globalThis.fixtureResult(bag)',
    '}',
    // The fixture is defined in the PARENT, so it must be handed to the
    // driver explicitly — a function cannot cross a process boundary.
    `globalThis.fixtureResult = ${fixtureSource}`,
    'const hook = registerHooks({',
    '  load(url, context, next) {',
    `    if (url !== ${JSON.stringify(compareUrl)}) return next(url, context)`,
    '    return {',
    "      shortCircuit: true, format: 'module',",
    `      source: ${JSON.stringify(compareSource)},`,
    '    }',
    '  },',
    '})',
    "globalThis.fetch = async () => new Response('<html><head><title>ready</title></head><body></body></html>')",
    'const captured = []',
    'const realWrite = process.stderr.write.bind(process.stderr)',
    'process.stderr.write = chunk => { captured.push(String(chunk)); return true }',
    // Run matrix.mjs AS A FILE, with argv shaped so its own
    // `invokedDirectly` wrapper executes. Importing it and calling main()
    // would bypass that wrapper, so the process exit status would never be
    // exercised — and a wrapper that dropped the verdict would go unseen.
    `process.argv = [process.execPath, ${JSON.stringify(matrixPath)}, ...${JSON.stringify(cliArgv)}]`,
    'try {',
    `  await import(${JSON.stringify(matrixUrl)})`,
    '} finally {',
    '  process.stderr.write = realWrite',
    '  hook.deregister()',
    '}',
    'process.stdout.write(',
    "  '__CLI_RESULT__' + JSON.stringify({ code: process.exitCode ?? 0, received, stderr: captured.join('') })",
    ')',
  ].join('\n')
  writeFileSync(driverPath, driverSource)
  let stdout = ''
  let stderr = ''
  let exitStatus = 0
  try {
    stdout = execFileSync(process.execPath, [driverPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
    })
  } catch (error) {
    stdout = error.stdout ?? ''
    stderr = error.stderr ?? ''
    exitStatus = error.status ?? -1
  } finally {
    rmSync(driverDir, { recursive: true, force: true })
  }
  const marker = stdout.split('\n').find(line => line.startsWith('__CLI_RESULT__'))
  assert.ok(
    marker,
    `the CLI must report its result (exit ${exitStatus}, stdout: ${stdout.slice(0, 400)}, stderr: ${stderr.slice(0, 400)})`
  )
  const cliResult = JSON.parse(marker.slice('__CLI_RESULT__'.length))
  const summaryPath = join(outDir, 'matrix-summary.json')
  const readmePath = join(outDir, 'README.md')
  const matrixMarkdownPath = join(outDir, 'MATRIX.md')
  return {
    code: cliResult.code,
    exitStatus,
    received: cliResult.received,
    stderr: cliResult.stderr ?? '',
    summaryExists: existsSync(summaryPath),
    readmeExists: existsSync(readmePath),
    matrixMarkdownExists: existsSync(matrixMarkdownPath),
    summary: existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')) : null,
    readme: existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null,
    matrixMarkdown: existsSync(matrixMarkdownPath)
      ? readFileSync(matrixMarkdownPath, 'utf8')
      : null,
  }
}

test('the matrix CLI forwards the override and publishes an unmeasured row as an error', () => {
  const compareSource =
    'export const SCHEMA_VERSION = 1; export const runCompare = bag => globalThis.fixtureCompare(bag);'
  const planned = ['admin__desktop__dark', 'home__desktop__dark']
  const fixtureSource = `bag => {
    const planned = ${JSON.stringify(planned)}
    const legacyAdminUrl = bag.includeAdmin ? null : bag.legacyUrl + '/admin/login/'
    const rebuildAdminUrl = bag.rebuildUrl + (bag.includeAdmin ? '/admin' : '/admin/login?next=%2Fadmin')
    const shot = (key, route, urlPath, legacyUrl, rebuildUrl) => ({
      key,
      route,
      urlPath,
      viewport: 'desktop',
      theme: 'dark',
      status: 'pass',
      legacy: { finalUrl: legacyUrl },
      rebuild: { finalUrl: rebuildUrl },
    })
    return {
      exitCode: 0,
      summary: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        oracle: { legacyUrl: bag.legacyUrl, rebuildUrl: bag.rebuildUrl },
        selection: { plannedShots: planned },
        shots: [
          shot(planned[0], 'admin', '/admin', legacyAdminUrl, rebuildAdminUrl),
          shot(planned[1], 'home', '/', bag.legacyUrl + '/', bag.rebuildUrl + '/'),
        ],
      },
    }
  }`
  const out = runMatrixCli({
    argv: [
      '--legacy-url',
      'http://127.0.0.1:4174',
      '--rebuild-url',
      'http://127.0.0.1:4175',
      '--supabase-url',
      'https://override-check.supabase.co',
      '--prerender',
      '--out',
      mkdtempSync(join(tmpdir(), 'matrix-cli-out-')),
    ],
    compareSource,
    fixtureSource,
  })
  assert.ok(out.received, `the CLI must reach the comparison engine (stderr: ${out.stderr ?? ''})`)
  assert.equal(out.received.supabaseUrl, 'https://override-check.supabase.co')
  assert.equal(out.received.themes, null, 'omitting --themes uses the UI contract defaults')
  assert.ok(out.received.extraRoutes.some(route => route.id === 'admin-photos'))
  // The bag the ENGINE receives must carry the fields that decide WHAT is
  // measured. A call site that reached the engine directly could drop them,
  // and `compare.mjs` would apply its own defaults: `routes` falls back to
  // `'priority'` (a 24-row subset of a 46-row matrix), `wave` to `1`, and
  // `adminLogin` to the defaults. Each of those narrows the measurement
  // while the job still exits 0, so the values are asserted HERE, at the
  // production entry point, rather than only on the exported helper.
  assert.equal(out.received.routes, 'all', 'the engine must receive the full route selector')
  assert.equal(out.received.wave, 9, 'the engine must receive the signed-off wave')
  assert.ok(out.received.adminLogin, 'the engine must receive the sign-in configuration')
  assert.equal(
    out.code,
    1,
    `an unmeasured protected row must make the real CLI fail (stderr: ${out.stderr ?? ''})`
  )
  // The PROCESS must exit with the verdict, not merely return it. The CLI
  // driver runs matrix.mjs as a file, so its own `process.exitCode` wrapper
  // is what runs here.
  assert.equal(
    out.exitStatus,
    1,
    'the process exit status must carry the CLI verdict (a green job on a red verdict)'
  )
  assert.ok(out.summary, 'the CLI must publish its summary')
  assert.deepEqual(
    out.summary.rows.map(row => row.key),
    planned,
    'the published receipt must retain the unmeasured row'
  )
  assert.equal(out.summary.counts.rows, out.summary.rows.length)
  const [admin, home] = out.summary.rows
  assert.equal(admin.status, 'error')
  assert.equal(admin.captureClass, 'exempt')
  assert.equal(admin.legacyFinalUrl, null)
  assert.match(admin.exemptReason, /no final URL/)
  assert.equal(home.status, 'pass')
  // The published summary must carry the receipt and the prerender block.
  assert.ok(
    typeof out.summary.command === 'string' && out.summary.command.includes('--legacy-url'),
    `the published summary must carry the receipt (got: ${out.summary.command})`
  )
  assert.ok(
    out.summary.prerender && typeof out.summary.prerender.status === 'string',
    'the published summary must carry the prerender block'
  )
  // The generated README must carry the same tally the summary does.
  assert.ok(out.readme, 'the CLI must publish its README')
  // MATRIX.md is a PUBLISHED artifact a reviewer reads, so the prerender
  // verdict and its waiver must survive into it.
  assert.ok(out.matrixMarkdown, 'the CLI must publish MATRIX.md')
  assert.match(
    out.matrixMarkdown,
    /Prerender \(W8-1\): pending/,
    'MATRIX.md must carry the prerender verdict'
  )
  assert.match(
    out.matrixMarkdown,
    /Prerender gate waived/,
    'MATRIX.md must carry the explicit prerender waiver'
  )
  assert.match(
    out.readme,
    /of which 1 are exempt\/unmeasured admin rows/,
    'the published README tally must treat exempt as a subset of error'
  )

  // Under the signed-off flags, --no-admin excludes added sections, not
  // protection for the contract's admin route. Two login screens must not pass.
  const ci = runMatrixCli({ argv: CI_ARGV, compareSource, fixtureSource })
  assert.ok(ci.received, `the CI-shaped CLI must reach the comparison engine: ${ci.stderr}`)
  assert.equal(ci.received.includeAdmin, false)
  assert.deepEqual(ci.received.extraRoutes, [])
  assert.equal(ci.received.themes, 'dark,light')
  assert.equal(ci.code, 1, 'the CI-shaped CLI must reject an admin login-screen comparison')
  const [redirectedAdmin, publicControl] = ci.summary.rows
  assert.equal(redirectedAdmin.key, 'admin__desktop__dark')
  assert.equal(redirectedAdmin.status, 'error')
  assert.match(redirectedAdmin.exemptReason, /both sides redirected to \/admin\/login/)
  assert.equal(publicControl.status, 'pass')
})

test('the matrix CLI refuses a run that measured nothing', () => {
  const compareSource =
    'export const SCHEMA_VERSION = 1; export const runCompare = bag => globalThis.fixtureCompare(bag);'
  const fixtureSource = `() => ({
    exitCode: 0,
    summary: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      oracle: { legacyUrl: 'http://127.0.0.1:4174', rebuildUrl: 'http://127.0.0.1:4175' },
      selection: { plannedShots: [] },
      shots: [],
    },
  })`
  const out = runMatrixCli({
    argv: [
      '--legacy-url',
      'http://127.0.0.1:4174',
      '--rebuild-url',
      'http://127.0.0.1:4175',
      '--out',
      mkdtempSync(join(tmpdir(), 'matrix-cli-empty-')),
    ],
    compareSource,
    fixtureSource,
  })
  assert.notEqual(out.code, 0, 'a run that measured nothing must not exit green')
  assert.equal(out.summaryExists, false, 'no summary may be published for an empty measurement')
})

test('the matrix CLI refuses a run whose row count contradicts the plan', () => {
  const compareSource =
    'export const SCHEMA_VERSION = 1; export const runCompare = bag => globalThis.fixtureCompare(bag);'
  // Two shots were planned but only ONE was measured. A row count that
  // contradicts the plan means shots were silently dropped, so the run must be
  // refused rather than published as a narrower green matrix.
  const fixtureSource = `bag => {
    const shot = (key, route, urlPath, legacyUrl, rebuildUrl) => ({
      key, route, urlPath, viewport: 'desktop', theme: 'dark', status: 'pass',
      legacy: { finalUrl: legacyUrl }, rebuild: { finalUrl: rebuildUrl },
    })
    return {
      exitCode: 0,
      summary: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        oracle: { legacyUrl: bag.legacyUrl, rebuildUrl: bag.rebuildUrl },
        selection: { plannedShots: ['home__desktop__dark', 'film__desktop__dark'] },
        shots: [
          shot('home__desktop__dark', 'home', '/', bag.legacyUrl + '/', bag.rebuildUrl + '/'),
        ],
      },
    }
  }`
  const out = runMatrixCli({
    argv: [
      '--legacy-url',
      'http://127.0.0.1:4174',
      '--rebuild-url',
      'http://127.0.0.1:4175',
      '--out',
      mkdtempSync(join(tmpdir(), 'matrix-cli-plan-')),
    ],
    compareSource,
    fixtureSource,
  })
  assert.notEqual(out.code, 0, 'a run that dropped a planned shot must not exit green')
  assert.equal(out.summaryExists, false, 'no summary may be published for a partial run')
})

test('captureShot seeds both pages with the override and installs the clock before parking', async () => {
  const { captureShot } = await import(new URL('./capture.mjs', import.meta.url).href)
  const seeded = []
  const clockEvents = []
  const noop = async () => {}
  const warmPage = {
    async addInitScript(_script, { storageKey }) {
      seeded.push(storageKey)
    },
    emulateMedia: noop,
    route: noop,
    clock: { install: noop },
    goto: async () => ({ status: () => 200 }),
    waitForLoadState: noop,
    evaluate: async () => true,
    waitForTimeout: noop,
    close: noop,
  }
  const capturePage = {
    on() {},
    async addInitScript(_script, { storageKey }) {
      seeded.push(storageKey)
    },
    emulateMedia: noop,
    route: noop,
    clock: {
      async install({ time }) {
        clockEvents.push(['install', time.toISOString()])
      },
      async pauseAt(time) {
        clockEvents.push(['pauseAt', time.toISOString()])
        throw new Error('stop after capturing the clock inputs')
      },
    },
  }
  const pages = [warmPage, capturePage]
  const browser = {
    newContext: async () => ({ newPage: async () => pages.shift(), close: noop }),
  }
  const result = await captureShot(browser, {
    baseUrl: 'http://127.0.0.1:4174',
    side: 'legacy',
    route: { id: 'admin', auth: 'admin' },
    routePath: '/admin',
    viewport: { name: 'desktop', width: 1280, height: 720 },
    theme: 'dark',
    ui: { fixedNow: '2026-01-01T00:00:00.000Z' },
    fixtures: { admin: { storageKey: 'fixture-key-must-not-be-used' } },
    mediaStub: Buffer.alloc(0),
    supabaseUrl: 'https://override-check.supabase.co',
  })
  assert.equal(result.error?.message, 'stop after capturing the clock inputs')
  assert.deepEqual(seeded, ['sb-override-check-auth-token', 'sb-override-check-auth-token'])
  assert.deepEqual(clockEvents, [
    ['install', '2025-12-31T23:59:59.000Z'],
    ['pauseAt', '2026-01-01T00:00:00.000Z'],
  ])
})

test('the published README line is the one the summary builder writes', async () => {
  const { matrixOverview, readmeTallyLine, tallyIsConsistent } = await import(
    new URL('./matrix.mjs', import.meta.url).href
  )
  const rows = [
    { status: 'pass', captureClass: 'captured' },
    { status: 'error', captureClass: 'exempt' },
  ]
  const overview = matrixOverview(
    { generatedAt: 'T', oracle: {}, tolerance: {}, determinism: {}, selection: {} },
    rows,
    { includeAdmin: false, prerender: null, outDir: 'out', options: null }
  )
  assert.ok(tallyIsConsistent(overview.counts), 'the summary tally must be internally consistent')
  assert.equal(
    overview.counts.error,
    1,
    'an exempt row is an error row, so it is counted once in error'
  )
  assert.equal(overview.counts.exempt, 1, 'and separately annotated as a subset')
  const line = readmeTallyLine(overview.counts)
  assert.match(line, /of which 1 are exempt\/unmeasured admin rows/)
})
