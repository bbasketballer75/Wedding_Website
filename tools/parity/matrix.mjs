/**
 * Full-matrix parity runner (Wave 9 W9-1).
 *
 * Runs EVERY contract route (including the 404 override and the admin sections)
 * × viewports × themes in ONE deterministic run by delegating to the existing
 * compare engine, then adds what the sweep needs on top:
 *
 *  - resumable output: completed shots are skipped on `--resume` (a crash or a
 *    timeout never loses the already-captured rows);
 *  - a single machine-readable `matrix-summary.json` and a generated
 *    `MATRIX.md` / `output/README.md` status table (pass/allowed/fail/error,
 *    changed-pixel ratio, text-diff count, page heights, first failure detail);
 *  - authenticated admin capture: the frozen legacy app uses the seeded
 *    Supabase session, the rebuild's current Wave-7 wiring point is the app's
 *    own in-memory admin runtime, so the harness performs the app's own sign-in
 *    flow with documented synthetic fixture credentials and records captured vs
 *    exempt admin rows with the reason;
 *  - `--prerender`: asserts the *served* (pre-hydration) HTML already carries
 *    per-route metadata on the rebuild side (Wave 8 W8-1). It reports
 *    pass/fail/pending/not-applicable and DOES affect the job's verdict: a
 *    `fail` raises the exit code, and a `pending` result — the flag was
 *    requested but nothing was measured — is recorded in the summary as an
 *    explicit waiver rather than passing silently.
 *
 * It never edits contracts and never auto-allowlists: failures are reported to
 * the Lead with their first text diff / diff slice path.
 *
 * Usage:
 *   node tools/parity/matrix.mjs --legacy-url http://127.0.0.1:4174 \
 *     --rebuild-url http://127.0.0.1:4175 [--out tools/parity/output/matrix] \
 *     [--routes all|priority|<ids>] [--matrix all] [--themes dark,light] \
 *     [--no-admin] [--prerender] [--resume] [--json]
 *
 * Exit codes: 0 = every row passed/allowed, 1 = parity or prerender failure,
 * 2 = harness/config error.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_CAPTURE_SECTIONS,
  ADMIN_LOGIN_DEFAULTS,
  DEFAULT_TOLERANCE,
  adminCaptureRoutes,
  loadRoutesContract,
  probeUrl,
  resolveRoutePath,
} from './config.mjs'
import { runCompare, SCHEMA_VERSION } from './compare.mjs'
import { guestShareToken, loadFixtures } from './mocks/fixtures.mjs'
import {
  HarnessError,
  ROOT,
  formatRatio,
  log,
  nowIso,
  readJsonFile,
  writeJsonFile,
  writeTextFile,
} from './util.mjs'

const DEFAULT_MATRIX_OUT = path.join(ROOT, 'tools', 'parity', 'output', 'matrix')

const USAGE = `Usage: node tools/parity/matrix.mjs --legacy-url <url> --rebuild-url <url> [options]

Options:
  --legacy-url <url>       frozen legacy oracle base URL (e.g. http://127.0.0.1:4174)
  --rebuild-url <url>      rebuild preview base URL (e.g. http://127.0.0.1:4175)
  --routes <selector>      all (default), priority, or comma-separated route ids
  --matrix <selector>      all (default) or comma list of viewports (desktop,mobile)
  --themes <selector>      comma list of themes (default: the route's contract themes)
  --out <dir>              output directory (default: tools/parity/output/matrix)
  --supabase-url <url>     Supabase URL the preview was BUILT with (overrides
                            VITE_SUPABASE_URL for the admin session key)
  --wave <n>               rebuild wave for allowlist expiry (default: 9)
  --max-diff-ratio <n>     changed-pixel ratio tolerance (default: 0.001)
  --pixel-threshold <n>    per-pixel colour threshold (default: 0.12)
  --edge-tolerance <n>     opt-in edge-raster tolerance, 0..4 (default: 0 = exact)
  --no-admin               skip the authenticated admin-section rows
  --admin-email <email>    synthetic fixture email for the app's own sign-in flow
  --admin-password <pass>  synthetic fixture password for the app's own sign-in flow
  --no-admin-login         never attempt the app sign-in flow (admin rows are then exempt)
  --prerender              verify served HTML carries per-route metadata (W8-1)
  --resume                 skip rows already present in a previous partial run
  --json                   print the matrix summary as JSON to stdout
  --help                   show this help

Exit codes: 0 pass, 1 parity/prerender failure, 2 harness/config error.`

function fail(message) {
  throw new HarnessError(message)
}

/**
 * Parse the matrix CLI arguments. Exported so the workflow guard can resolve a
 * `matrix.mjs` invocation with the harness's OWN parser rather than a second
 * copy of the flag list.
 */
export function parseArgs(argv) {
  const options = {
    legacyUrl: null,
    rebuildUrl: null,
    routes: 'all',
    matrix: 'all',
    themes: null,
    outDir: DEFAULT_MATRIX_OUT,
    wave: 9,
    maxDiffRatio: DEFAULT_TOLERANCE.maxDiffRatio,
    pixelThreshold: DEFAULT_TOLERANCE.pixelThreshold,
    edgeTolerance: DEFAULT_TOLERANCE.edgeTolerance,
    includeAdmin: true,
    adminLogin: { ...ADMIN_LOGIN_DEFAULTS },
    prerender: false,
    resume: false,
    json: false,
    help: false,
    // The Supabase URL the preview under test was BUILT with. When it is not
    // set the harness uses its own `VITE_SUPABASE_URL`, which only derives
    // the right session key when both previews were built in this same
    // environment.
    supabaseUrl: null,
  }
  // Flags the caller actually passed, in the order they appeared. The receipt
  // must distinguish "the run used --edge-tolerance 1" from "the harness
  // defaulted edgeTolerance to 1" — printing a default as if it were passed
  // makes the receipt a claim the invocation never made.
  options.passedFlags = []
  const args = [...argv]
  let index = 0
  const readValue = flag => {
    const next = args[index + 1]
    if (next === undefined || next.startsWith('--')) fail(`${flag} needs a value`)
    index += 1
    return next
  }
  const readNumber = (flag, min, max, integer = false) => {
    const value = Number(readValue(flag))
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      fail(`${flag} must be a number between ${min} and ${max}${integer ? ' (integer)' : ''}`)
    }
    return value
  }
  while (index < args.length) {
    const arg = args[index]
    if (arg.startsWith('--')) options.passedFlags.push(arg)
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--legacy-url':
        options.legacyUrl = readValue(arg)
        break
      case '--rebuild-url':
        options.rebuildUrl = readValue(arg)
        break
      case '--routes':
        options.routes = readValue(arg)
        break
      case '--matrix':
        options.matrix = readValue(arg)
        break
      case '--themes':
        options.themes = readValue(arg)
        break
      case '--out':
        // Keep the argument AS PASSED for the receipt, and the resolved path
        // for the filesystem. The receipt names the invocation; a resolved
        // absolute path would not match the flag on any platform.
        options.outDirArg = readValue(arg)
        options.outDir = path.resolve(options.outDirArg)
        break
      case '--supabase-url':
        options.supabaseUrl = readValue(arg)
        break
      case '--wave':
        options.wave = readNumber(arg, 1, 1000, true)
        break
      case '--max-diff-ratio':
        options.maxDiffRatio = readNumber(arg, 0, 1)
        break
      case '--pixel-threshold':
        options.pixelThreshold = readNumber(arg, 0, 1)
        break
      case '--edge-tolerance':
        options.edgeTolerance = readNumber(arg, 0, 4, true)
        break
      case '--no-admin':
        options.includeAdmin = false
        break
      case '--admin-email':
        options.adminLogin.email = readValue(arg)
        break
      case '--admin-password':
        options.adminLogin.password = readValue(arg)
        break
      case '--no-admin-login':
        options.adminLogin.enabled = false
        break
      case '--prerender':
        options.prerender = true
        break
      case '--resume':
        options.resume = true
        break
      case '--json':
        options.json = true
        break
      default:
        fail(`unknown argument "${arg}"\n\n${USAGE}`)
    }
    index += 1
  }
  if (options.help) return { help: true, options }
  if (!options.legacyUrl) fail(`--legacy-url is required\n\n${USAGE}`)
  if (!options.rebuildUrl) fail(`--rebuild-url is required\n\n${USAGE}`)
  return { help: false, options }
}

/* ------------------------------------------------------------------ */
/* Prerender-aware verification (W8-1)                                  */
/* ------------------------------------------------------------------ */

function extractTag(html, pattern) {
  const match = pattern.exec(html)
  return match ? match[1] : null
}

const HTML_ENTITIES = { amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' }

function decodeHtml(value) {
  // Single pass: sequential replaces would double-unescape inputs like `&amp;lt;`.
  return String(value ?? '').replace(
    /&(amp|quot|#39|lt|gt);/g,
    (_, entity) => HTML_ENTITIES[entity]
  )
}

async function fetchServedHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    const html = await response.text()
    return {
      status: response.status,
      bytes: Buffer.byteLength(html),
      title: decodeHtml(extractTag(html, /<title>([\s\S]*?)<\/title>/i)),
      canonical: extractTag(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i),
    }
  } catch (error) {
    return { status: null, bytes: null, title: null, canonical: null, error: error.message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Classify the prerender check into a VERDICT.
 *
 * The verdict is what the job's exit code consumes, and it is deliberately
 * separate from the raw counts so the ladder can be asserted on its own.
 *
 *  - `pass`           — every checked route was prerendered on the rebuild side.
 *  - `fail`           — SOME routes were prerendered and some were not, i.e. the
 *                       output is inconsistent. This raises the exit code.
 *  - `pending`        — the flag was requested but NOTHING was prerendered,
 *                       because W8-1 prerendering has not landed on the rebuild
 *                       side yet. This is a KNOWN pre-W8-1 state, so it is
 *                       recorded as an explicit WAIVER rather than silently
 *                       passing: the summary says `waived: true` and names the
 *                       reason, and the matrix still measures the hydrated DOM.
 *  - `not-applicable` — the contract gave no per-route metadata to check.
 *
 * Exporting this makes the ladder testable without a live server, which is
 * the point: `checkPrerender` was unexported and untested, so the half of the
 * verdict that could report green while measuring nothing was unpinned.
 */
export function classifyPrerender({ expectedRoutes = 0, rebuildPrerendered = 0 }) {
  if (expectedRoutes === 0) {
    return {
      status: 'not-applicable',
      verdict: 'not-applicable',
      waived: false,
      note: 'The contract gives no per-route metadata to check.',
    }
  }
  if (rebuildPrerendered === expectedRoutes) {
    return { status: 'pass', verdict: 'pass', waived: false, note: null }
  }
  if (rebuildPrerendered > 0) {
    return {
      status: 'fail',
      verdict: 'fail',
      waived: false,
      note: 'Some routes are prerendered and some are not — inconsistent prerender output.',
    }
  }
  return {
    status: 'pending',
    verdict: 'pending',
    waived: true,
    waiverReason:
      'W8-1 prerendering has not landed on the rebuild side yet: 0 of ' +
      `${expectedRoutes} routes are prerendered. The prerender half of this gate ` +
      'measured nothing, so it asserts nothing; the capture still asserts the hydrated DOM.',
    note: 'No per-route served metadata found yet — W8-1 prerendering has not landed.',
  }
}

/**
 * Assert the served HTML (before hydration) carries per-route metadata on the
 * rebuild side, for every route the SEO contract gives a per-route title.
 * Legacy is an SPA and is recorded for reference only.
 */
async function checkPrerender({ routes, legacyUrl, rebuildUrl, guestToken }) {
  let seoContract = null
  try {
    seoContract = await readJsonFile(path.join(ROOT, 'contracts', 'seo-pwa.json'))
  } catch (error) {
    log.warn(
      `prerender: contracts/seo-pwa.json unreadable (${error.message}) — checks will be partial`
    )
  }
  const seoById = new Map((seoContract?.routes ?? []).map(route => [route.id, route]))
  const checkedRoutes = routes.filter(route => seoById.has(route.id) && route.id !== 'guest-token')
  const results = []
  for (const route of checkedRoutes) {
    const routePath = resolveRoutePath(route, { guestToken })
    const expected = seoById.get(route.id)
    const [legacyHtml, rebuildHtml] = await Promise.all([
      fetchServedHtml(`${legacyUrl}${routePath}`),
      fetchServedHtml(`${rebuildUrl}${routePath}`),
    ])
    const expectedTitle = decodeHtml(expected.title)
    const matchesExpected = html =>
      Boolean(html?.title) &&
      html.title === expectedTitle &&
      (!expected.canonicalPath || (html.canonical ?? '').endsWith(expected.canonicalPath))
    results.push({
      id: route.id,
      path: routePath,
      expectedTitle,
      expectedCanonicalPath: expected.canonicalPath ?? null,
      legacy: { ...legacyHtml, prerendered: matchesExpected(legacyHtml) },
      rebuild: { ...rebuildHtml, prerendered: matchesExpected(rebuildHtml) },
    })
  }
  const rebuildDone = results.filter(result => result.rebuild.prerendered).length
  const verdict = classifyPrerender({
    expectedRoutes: results.length,
    rebuildPrerendered: rebuildDone,
  })
  return {
    checkedAt: nowIso(),
    ...verdict,
    expectedRoutes: results.length,
    rebuildPrerendered: rebuildDone,
    routes: results,
  }
}

/* ------------------------------------------------------------------ */
/* Matrix report                                                        */
/* ------------------------------------------------------------------ */

const ADMIN_ROUTE_ID_PATTERN = /^admin(-|$)/

function isAdminRow(shot, includeAdmin) {
  if (!includeAdmin) return false
  return ADMIN_ROUTE_ID_PATTERN.test(shot.route) && shot.route !== 'admin-login'
}

/**
 * Route ids the CONTRACT (or a generated admin section) marks `auth: 'admin'`.
 *
 * This is deliberately separate from `includeAdmin`. That flag only decides
 * whether the synthetic admin child sections are ADDED to the matrix; it must
 * not decide whether an `auth: 'admin'` route that is in the matrix anyway gets
 * its authentication verified. Keying the exemption on `includeAdmin` meant the
 * CI invocation — which passes `--no-admin` to match the signed-off 46-row
 * scope, and which still captures the `auth: admin` contract route — skipped the
 * check entirely and could report `pass` for two unauthenticated login screens.
 */
function protectedRouteIds(routes) {
  return new Set(routes.filter(route => route.auth === 'admin').map(route => route.id))
}

/**
 * True when a capture ended on the admin sign-in screen.
 *
 * Compares the URL's PATHNAME, not a string suffix: `/admin/login/`,
 * `/admin/login?next=/admin/photos` and `/admin/login#form` are all the same
 * unmeasured state, and an `endsWith('/admin/login')` test reports every one of
 * them as a genuine capture. That is the same fail-open class as keying the
 * exemption on `includeAdmin`, one layer down.
 */
function isAdminLoginUrl(url) {
  if (!url) return false
  const value = String(url)
  let pathname
  try {
    pathname = new URL(value).pathname
  } catch {
    // Not an absolute URL — fall back to the path before any query/fragment.
    pathname = value.split(/[?#]/)[0]
  }
  return pathname.replace(/\/+$/, '') === '/admin/login'
}

/**
 * The invocation actually used, for the uploaded receipt.
 *
 * The artifact is what a reviewer reads to confirm the signed-off baseline ran,
 * so it must name every flag the job passed. Recording only `--wave` (the
 * previous behaviour) silently dropped `--routes`, `--matrix`, `--themes`,
 * `--edge-tolerance`, `--no-admin` and `--prerender` — i.e. exactly the options
 * that distinguish the signed-off run from a strict default one.
 */
export function describeInvocation(options) {
  // Only the flags the caller actually passed, with their effective values.
  // A default the harness supplied is NOT a flag the run used, and the
  // resolved tolerance values are recorded separately in the summary's own
  // `tolerance` field.
  const passed = new Set(options.passedFlags ?? [])
  const flags = []
  if (passed.has('--routes')) flags.push(`--routes ${options.routes}`)
  if (passed.has('--matrix')) flags.push(`--matrix ${options.matrix}`)
  if (passed.has('--themes')) flags.push(`--themes ${options.themes}`)
  if (passed.has('--max-diff-ratio')) flags.push(`--max-diff-ratio ${options.maxDiffRatio}`)
  if (passed.has('--pixel-threshold')) flags.push(`--pixel-threshold ${options.pixelThreshold}`)
  if (passed.has('--edge-tolerance')) flags.push(`--edge-tolerance ${options.edgeTolerance}`)
  if (passed.has('--no-admin')) flags.push('--no-admin')
  if (passed.has('--prerender')) flags.push('--prerender')
  if (passed.has('--resume')) flags.push('--resume')
  if (passed.has('--wave')) flags.push(`--wave ${options.wave}`)
  if (passed.has('--out')) flags.push(`--out ${options.outDirArg ?? options.outDir}`)
  if (passed.has('--supabase-url')) flags.push(`--supabase-url ${options.supabaseUrl}`)
  if (passed.has('--json')) flags.push('--json')
  // `--admin-email` and `--admin-password` are deliberately NOT printed here:
  // the receipt is published as an uploaded CI artifact, so naming a credential
  // in it would leak it. They are the ONLY flags the receipt omits, and they
  // are omitted because they carry a secret — not because they do not change
  // the comparison. `--no-admin-login` is a boolean switch with no secret value
  // and IS printed, so the receipt still says whether the app's own sign-in
  // flow was attempted.
  if (passed.has('--no-admin-login')) flags.push('--no-admin-login')
  return (
    `node tools/parity/matrix.mjs --legacy-url ${options.legacyUrl} ` +
    `--rebuild-url ${options.rebuildUrl} ${flags.join(' ')}`
  )
}

/**
 * Map the matrix CLI options onto the comparison harness's option bag.
 *
 * Exported so the mapping can be asserted BEHAVIOURALLY. A hop that quietly
 * drops a field is invisible to a source-text check and survives mutation with
 * the suite green; `runCompare` normalizes whatever this returns, so a field
 * missing here is missing for the whole capture.
 */
export function compareOptions(options, extraRoutes = []) {
  return {
    // Spread FIRST, so the explicit fields below win. Spreading the whole
    // option bag means a NEW option cannot be dropped by forgetting to list
    // it here — the failure mode the previous explicit list had.
    ...options,
    extraRoutes,
    resume: options.resume,
    report: true,
  }
}

/**
 * The matrix's comparison step — the PRODUCTION path.
 *
 * Exported so the option bag handed to the comparison harness can be asserted
 * on the value that is actually passed. Calling `runCompare(options)` directly
 * bypasses the mapping hop, and the harness then measures a narrower matrix
 * (or an unauthenticated admin run) while the job still exits 0.
 */
export async function matrixCompare(options, extraRoutes = [], compare = runCompare) {
  const bag = compareOptions(options, extraRoutes)
  const missing = REQUIRED_COMPARE_FIELDS.filter(field => {
    const value = bag[field]
    // Null deliberately selects the themes declared by the UI contract.
    if (value === undefined || (value === null && field !== 'themes')) return true
    if (field === 'extraRoutes') return !Array.isArray(value)
    return false
  })
  if (missing.length > 0) {
    throw new Error(
      `parity: the comparison option bag is missing required field(s): ${missing.join(', ')}`
    )
  }
  return compare(bag)
}

/**
 * Refuse a run that measured nothing, or measured something other than what
 * was planned.
 *
 * Exported so the guard can be asserted on its behaviour. Publishing
 * "rows 0" and exiting 0 is a green verdict on an empty measurement, and a
 * row count that contradicts the plan means some shots were silently
 * dropped.
 */
export function assertRowsComplete(rows, plannedShots = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('parity: the matrix assembled 0 rows — nothing was measured')
  }
  if (Array.isArray(plannedShots) && plannedShots.length !== rows.length) {
    throw new Error(
      `parity: the matrix assembled ${rows.length} rows but ${plannedShots.length} shots were planned`
    )
  }
  return rows
}

/**
 * The option bag the comparison harness MUST receive.
 *
 * This is the effective contract between the matrix and `runCompare`, and it
 * is asserted on the VALUE rather than on the source text. The fields listed
 * here are the ones whose absence changes what is MEASURED:
 *
 *  - `routes` / `matrix` / `themes` select which shots exist at all. Dropping
 *    `routes` silently narrows a run from the full matrix to the priority
 *    subset — a 24-row run that exits 0 and looks green.
 *  - `wave` selects the wave's route set.
 *  - `edgeTolerance` / `maxDiffRatio` / `pixelThreshold` are the tolerances.
 *  - `adminLogin` carries the app's own sign-in flow; dropping it leaves the
 *    admin rows unauthenticated (and therefore exempt/error).
 *  - `outDir` is where the evidence is written.
 *  - `extraRoutes` are the generated admin sections.
 *
 * A field dropped from `compareOptions` is missing for the whole capture, so
 * this list is asserted directly rather than inferred.
 */
export const REQUIRED_COMPARE_FIELDS = Object.freeze([
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
])

function firstFailureDetail(shot) {
  if (shot.textDiff?.status === 'fail') {
    const firstField = shot.textDiff.differences?.[0]?.field ?? 'text'
    return {
      kind: 'text',
      field: firstField,
      path: shot.files?.text?.diff ?? null,
      differences: shot.textDiff.differences?.length ?? 0,
    }
  }
  const changedSlice = (shot.pixelDiff?.slices ?? []).find(
    slice => (slice.changedPixels ?? 0) > 0 || slice.status === 'size-mismatch'
  )
  if (changedSlice) {
    return {
      kind: 'pixel',
      field: null,
      path: changedSlice.diffFile ?? null,
      changedPixels: changedSlice.changedPixels ?? null,
    }
  }
  return { kind: null, field: null, path: null }
}

export function buildRows(shots, { includeAdmin, protectedRoutes }) {
  // The protected set is REQUIRED. Defaulting it to an empty set would
  // silently disable the auth gate for any caller that forgets it — the same
  // fail-open this gate exists to prevent. Fail loudly instead.
  if (!(protectedRoutes instanceof Set)) {
    throw new Error(
      'buildRows requires protectedRoutes: derive it with protectedRouteIds() from the route contract'
    )
  }
  return shots.map(shot => {
    const admin = isAdminRow(shot, includeAdmin)
    const legacyLogin = isAdminLoginUrl(shot.legacy?.finalUrl)
    const rebuildLogin = isAdminLoginUrl(shot.rebuild?.finalUrl)
    // A protected route with no recorded final URL was not measured. Treating
    // it as a genuine capture is the same fail-open as the login-redirect case:
    // `isAdminLoginUrl(null)` is false, so an unmeasured row would compare
    // as equal.
    const legacyUrlMissing = !shot.legacy?.finalUrl
    const rebuildUrlMissing = !shot.rebuild?.finalUrl
    let captureClass = 'captured'
    let exemptReason = null
    // A row for an `auth: 'admin'` route was not measured if either side ended on
    // the login screen — regardless of `--no-admin`.
    if (admin || protectedRoutes.has(shot.route)) {
      if (legacyUrlMissing || rebuildUrlMissing) {
        captureClass = 'exempt'
        exemptReason = 'a protected route recorded no final URL — the row was not measured'
      } else if (legacyLogin && rebuildLogin) {
        captureClass = 'exempt'
        exemptReason = 'both sides redirected to /admin/login (admin session/login not accepted)'
      } else if (legacyLogin) {
        captureClass = 'exempt'
        exemptReason = 'legacy redirected to /admin/login (seeded Supabase session not accepted)'
      } else if (rebuildLogin) {
        captureClass = 'exempt'
        exemptReason = 'rebuild redirected to /admin/login (fixture sign-in flow not accepted)'
      }
    }
    const detail = firstFailureDetail(shot)
    // An admin row that could not be authenticated is NOT evidence of parity. It
    // is reported as an `error`, never as a `pass`: two sides that both landed on
    // the login screen would otherwise compare as equal and the job would exit
    // green having measured nothing. The exemption is still recorded, with its
    // reason, so the receipt says why the row was not measured.
    const status = captureClass === 'exempt' ? 'error' : shot.status
    const failureReasons =
      captureClass === 'exempt'
        ? [...(shot.failureReasons ?? []), `admin row not measured: ${exemptReason}`]
        : (shot.failureReasons ?? [])
    return {
      key: shot.key,
      route: shot.route,
      path: shot.urlPath,
      viewport: shot.viewport,
      theme: shot.theme,
      admin,
      captureClass,
      exemptReason,
      status,
      ratio: shot.pixelDiff?.ratio ?? null,
      changedPixels: shot.pixelDiff?.changedPixels ?? null,
      totalPixels: shot.pixelDiff?.totalPixels ?? null,
      textDiffs: shot.textDiff?.status === 'fail' ? (shot.textDiff.differences?.length ?? 0) : 0,
      legacyHeight: shot.legacy?.pageHeightPx ?? null,
      rebuildHeight: shot.rebuild?.pageHeightPx ?? null,
      failureReasons,
      firstFailure: detail,
      legacyFinalUrl: shot.legacy?.finalUrl ?? null,
      rebuildFinalUrl: shot.rebuild?.finalUrl ?? null,
      legacyAdminAuth: shot.legacy?.adminAuth ?? null,
      rebuildAdminAuth: shot.rebuild?.adminAuth ?? null,
      files: {
        textDiff: shot.files?.text?.diff ?? null,
        diffSlices: shot.files?.diff ?? [],
        legacyShot: shot.files?.legacy?.[0] ?? null,
        rebuildShot: shot.files?.rebuild?.[0] ?? null,
      },
    }
  })
}

/**
 * Assemble the matrix rows from a comparison result — the PRODUCTION path.
 *
 * The protected set is derived HERE, from the route contract, rather than
 * being passed in. A caller that hands `buildRows` an empty or
 * `includeAdmin`-conditioned set silently disables the auth gate — the exact
 * fail-open where CI goes green having compared two login screens. Deriving
 * it inside this function means the production call site cannot get it
 * wrong, and a test can assert on the real function instead of on a copy of
 * its logic.
 */
export function assembleRows(summary, { includeAdmin, routesContract, extraRoutes = [] }) {
  const protectedRoutes = protectedRouteIds([...routesContract.routes, ...extraRoutes])
  return buildRows(summary?.shots ?? [], { includeAdmin, protectedRoutes })
}

function markdownTable(rows) {
  const statusLabel = row => {
    if (row.captureClass === 'exempt') return 'EXEMPT'
    return row.status.toUpperCase()
  }
  const header =
    '| Route | Path | Viewport | Theme | Status | Changed px | Ratio | Text diffs | Heights (L/R) | First failure |\n' +
    '|---|---|---|---|---|---|---|---|---|---|\n'
  const lines = rows.map(row => {
    const detail = row.firstFailure?.kind
      ? `${row.firstFailure.kind}${row.firstFailure.field ? `:${row.firstFailure.field}` : ''}${
          row.firstFailure.path ? ` \`${row.firstFailure.path}\`` : ''
        }`
      : row.captureClass === 'exempt'
        ? row.exemptReason
        : ''
    return `| ${row.route} | \`${row.path}\` | ${row.viewport} | ${row.theme} | ${statusLabel(row)} | ${
      row.changedPixels ?? '—'
    } | ${row.ratio === null ? '—' : formatRatio(row.ratio)} | ${row.textDiffs} | ${
      row.legacyHeight ?? '—'
    } / ${row.rebuildHeight ?? '—'} | ${detail.replaceAll('\\', '\\\\').replaceAll('|', '\\|')} |`
  })
  return header + lines.join('\n')
}

/**
 * Build the machine-readable matrix summary — the artifact CI publishes.
 *
 * Exported so the receipt and the prerender block are asserted on the VALUE
 * the artifact actually carries. Assigning `overview.command` at the call
 * site left it unpinned: deleting that assignment kept the suite green while
 * the uploaded artifact lost its receipt. Building the whole summary in one
 * place means the receipt is part of what the function returns.
 */
export function matrixOverview(summary, rows, { includeAdmin, prerender, outDir, options }) {
  const counts = {
    rows: rows.length,
    pass: rows.filter(row => row.status === 'pass').length,
    allowed: rows.filter(row => row.status === 'allowed').length,
    fail: rows.filter(row => row.status === 'fail').length,
    error: rows.filter(row => row.status === 'error').length,
    // Exempt rows are ALSO error rows (an unmeasured row is reported as an
    // error, never as a pass), so the two buckets OVERLAP: an exempt row is
    // counted in both, and pass + allowed + fail + error + exempt exceeds the
    // row count. exempt is therefore a SUBSET annotation of error, not a
    // separate bucket, and the tally line reports it that way.
    exempt: rows.filter(row => row.captureClass === 'exempt').length,
    textDiffRows: rows.filter(row => row.textDiffs > 0).length,
    changedPixels: rows.reduce((sum, row) => sum + (row.changedPixels ?? 0), 0),
    totalPixels: rows.reduce((sum, row) => sum + (row.totalPixels ?? 0), 0),
  }
  const adminRows = rows.filter(row => row.admin)
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'parity-matrix',
    generatedAt: summary.generatedAt,
    durationMs: summary.durationMs,
    oracle: summary.oracle,
    outDir: path.relative(ROOT, outDir).split(path.sep).join('/'),
    counts,
    admin: {
      included: includeAdmin,
      captureMode:
        'legacy: seeded Supabase session in localStorage (contracts/fixtures/adminSession.json); ' +
        'rebuild: the app’s own sign-in flow with documented synthetic fixture credentials',
      login: {
        email: ADMIN_LOGIN_DEFAULTS.email,
        enabled: ADMIN_LOGIN_DEFAULTS.enabled,
        credentialSource:
          'rebuild/src/features/admin/fixtures.ts (synthetic test fixtures, never real credentials)',
      },
      sections: ADMIN_CAPTURE_SECTIONS,
      captured: adminRows.filter(row => row.captureClass === 'captured').map(row => row.key),
      exempt: adminRows
        .filter(row => row.captureClass === 'exempt')
        .map(row => ({ key: row.key, reason: row.exemptReason })),
    },
    prerender: prerender ?? null,
    // The invocation receipt travels WITH the summary it describes.
    command: options ? describeInvocation(options) : null,
    rows,
    compare: {
      summaryPath: path.join(path.relative(ROOT, outDir).split(path.sep).join('/'), 'summary.json'),
      reportPath: path.join(path.relative(ROOT, outDir).split(path.sep).join('/'), 'report.html'),
    },
    tolerance: summary.tolerance,
    determinism: summary.determinism,
  }
}

/**
 * The published tally must be internally consistent.
 *
 * Every `exempt` row is ALSO an `error` row, so the two are not disjoint
 * buckets. A summary that lists them as two peers makes
 * `pass + allowed + fail + error + exempt` exceed the row count, so a reader
 * who sums the published line is reading a number about a set that does not
 * exist. Exempt is a SUBSET annotation of error.
 */
export function tallyIsConsistent(counts) {
  const buckets = counts.pass + counts.allowed + counts.fail + counts.error
  if (buckets !== counts.rows) return false
  return counts.exempt <= counts.error
}

/**
 * The published README tally line.
 *
 * Exported so the ARTIFACT a reviewer reads is asserted on its text. The
 * stdout tally was fixed while the generated README kept listing `exempt` as a
 * fifth peer bucket, so the published line still exceeded the row count.
 */
export function readmeTallyLine(counts) {
  const suffix = counts.exempt ? `, of which ${counts.exempt} are exempt/unmeasured admin rows` : ''
  return `- rows: ${counts.rows} (${counts.pass} pass, ${counts.allowed} allowed, ${counts.fail} fail, ${counts.error} error${suffix})`
}

function outputReadme(overview, options) {
  const { counts } = overview
  const failures = overview.rows.filter(row => row.status === 'fail' || row.status === 'error')
  return `# Parity matrix output (generated)

Generated by \`tools/parity/matrix.mjs\` — do not hand-edit; re-run the matrix instead.

- generated: ${overview.generatedAt}
- oracle (legacy): ${overview.oracle.legacyUrl}
- rebuild: ${overview.oracle.rebuildUrl}
- wave: ${options.wave} · tolerances: maxDiffRatio=${options.maxDiffRatio}, pixelThreshold=${options.pixelThreshold}, edgeTolerance=${options.edgeTolerance}
- rows: ${readmeTallyLine(counts).slice(2)}

## Files

| Path | Meaning |
|---|---|
| \`matrix-summary.json\` | machine-readable matrix: every row + totals + admin/prerender details |
| \`MATRIX.md\` | generated markdown status table (same rows) |
| \`summary.json\` | underlying per-shot compare evidence (pixels, text, allowlist) |
| \`report.html\` | self-contained side-by-side legacy/rebuild/diff report |
| \`shots/{legacy,rebuild,diff}/\` | window PNGs per shot |
| \`text/{legacy,rebuild,diff}/\` | DOM/text contract capture per shot |
| \`summary.partial.json\` | incremental progress used by \`--resume\` |

## How to read the table

- **PASS** — pixels within tolerance and the DOM/text contract is identical.
- **ALLOWED** — a reviewed, expiring allowlist entry documents the residual; the
  entry and measured ratio are in \`summary.json\`.
- **FAIL** — an unexplained parity difference. The first-failure column points at
  the text diff JSON or the first changed diff slice PNG to open.
- **ERROR** — harness-level capture failure; the run\'s results are incomplete.
- **EXEMPT** — an authenticated admin row a side could not authenticate; the reason
  column names the side and the redirect. Exempt rows are not parity evidence.
- Heights are page heights (legacy / rebuild); a height difference is a layout change.

## Current status

${markdownTable(overview.rows)}

${failures.length > 0 ? `## Failures to route\n\n${failures.map(row => `- **${row.key}** — ${row.failureReasons.join('; ')}${row.firstFailure?.path ? ` → \`${row.firstFailure.path}\`` : ''}`).join('\n')}` : '## Failures to route\n\nNone.'}

## Deterministic rules

Same single run for both sides, fixed fake clock from \`contracts/ui.json.fixedNow\`,
one browser binary/OS, service workers blocked, reduced motion, mocked Supabase
from \`contracts/fixtures/\`, fixed media stub for the remote CDN, 8 fixed viewport
windows per shot. The full policy is \`docs/rebuild/PARITY.md\` §2–§3.
`
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function runMatrix(options) {
  const startedMs = Date.now()
  const fixtures = await loadFixtures({ warn: message => log.warn(message) })
  const routesContract = await loadRoutesContract()
  let guestToken = null
  try {
    guestToken = guestShareToken(fixtures.data)
  } catch {
    guestToken = null
  }
  await Promise.all([probeUrl(options.legacyUrl), probeUrl(options.rebuildUrl)])

  const extraRoutes = options.includeAdmin ? adminCaptureRoutes() : []
  log.info(
    `matrix: ${routesContract.routes.length} contract route(s)` +
      `${options.includeAdmin ? ` + ${extraRoutes.length} admin section(s)` : ''} × viewports × themes`
  )

  await fs.mkdir(options.outDir, { recursive: true })

  let prerender = null
  if (options.prerender) {
    log.info('prerender: asserting served per-route metadata before hydration…')
    const allRoutes = [...routesContract.routes, ...extraRoutes]
    prerender = await checkPrerender({
      routes: allRoutes,
      legacyUrl: options.legacyUrl,
      rebuildUrl: options.rebuildUrl,
      guestToken,
    })
    log.info(
      `prerender: ${prerender.rebuildPrerendered}/${prerender.expectedRoutes} rebuild routes prerendered (${prerender.status})`
    )
  }

  const compareResult = await matrixCompare(options, extraRoutes)

  const rows = assembleRows(compareResult.summary, {
    includeAdmin: options.includeAdmin,
    routesContract,
    extraRoutes,
  })
  // A run that assembled no rows measured nothing. Publishing "rows 0" and
  // exiting 0 is a green verdict on an empty measurement.
  assertRowsComplete(rows, compareResult.summary?.selection?.plannedShots)
  const overview = matrixOverview(compareResult.summary, rows, {
    includeAdmin: options.includeAdmin,
    prerender,
    outDir: options.outDir,
    options,
  })
  overview.durationMs = Date.now() - startedMs

  const summaryPath = path.join(options.outDir, 'matrix-summary.json')

  await writeJsonFile(summaryPath, overview)
  const matrixMarkdownPath = path.join(options.outDir, 'MATRIX.md')
  await writeTextFile(
    matrixMarkdownPath,
    `# Parity matrix — ${overview.generatedAt}\n\n` +
      `Oracle: ${options.legacyUrl} → rebuild: ${options.rebuildUrl} (wave ${options.wave})\n\n` +
      `${markdownTable(rows)}\n\n${
        prerender
          ? [
              `Prerender (W8-1): ${prerender.status} — ${prerender.rebuildPrerendered}/${prerender.expectedRoutes} rebuild routes served per-route metadata.\n\n`,
              prerender.waived ? `> **Prerender gate waived** — ${prerender.waiverReason}\n\n` : '',
            ].join('')
          : ''
      }${
        overview.admin.exempt.length > 0
          ? `Admin exempt rows:\n${overview.admin.exempt.map(item => `- ${item.key}: ${item.reason}`).join('\n')}\n`
          : ''
      }`
  )
  const readmePath = path.join(options.outDir, 'README.md')
  await writeTextFile(readmePath, outputReadme(overview, options))
  // Deliverable convenience: also refresh the output-root guide so a reader who
  // opens tools/parity/output/ first finds the latest matrix status + how-to.
  await writeTextFile(
    path.join(ROOT, 'tools', 'parity', 'output', 'README.md'),
    outputReadme(overview, options)
  )

  // Human-readable status table + failure routing, on stdout.
  log.out('')
  log.out(markdownTable(rows))
  const failures = rows.filter(row => row.status === 'fail' || row.status === 'error')
  if (failures.length > 0) {
    log.out('')
    log.out(`Failures (${failures.length}):`)
    for (const row of failures) {
      log.out(
        `  ${row.key}: ${row.failureReasons.join('; ')}${
          row.firstFailure?.path ? ` → ${row.firstFailure.path}` : ''
        }`
      )
    }
  }
  if (overview.admin.exempt.length > 0) {
    log.out('')
    log.out(`Admin rows exempt from parity evidence (${overview.admin.exempt.length}):`)
    for (const item of overview.admin.exempt) log.out(`  ${item.key}: ${item.reason}`)
  }
  log.out('')
  log.out(
    [
      `Matrix: ${overview.counts.rows} rows — ${overview.counts.pass} pass,`,
      `${overview.counts.allowed} allowed, ${overview.counts.fail} fail,`,
      `${overview.counts.error} error`,
      overview.counts.exempt
        ? ` (${overview.counts.exempt} of the errors are exempt/unmeasured rows)`
        : '',
    ].join(' ')
  )
  log.out(`Matrix summary: ${summaryPath}`)
  log.out(`Markdown:       ${matrixMarkdownPath}`)
  log.out(`Output README:  ${readmePath}`)

  let exitCode = compareResult.exitCode
  // A row that could not be measured is not a pass. `buildRows` reports an
  // un-authenticated admin row as `error`; make the job's exit code reflect it
  // so CI cannot go green having compared two login screens.
  exitCode = matrixExitCode(rows, exitCode, { prerender, options })
  return { overview, exitCode, summaryPath, matrixMarkdownPath, readmePath }
}

/**
 * The job's exit code must reflect an unmeasured row.
 *
 * Exported so the signal a caller actually consumes can be asserted on the
 * VALUE. A source-text check on the mapping passes even if the exit code is
 * never raised — which is the fail-open this gate exists to close: CI going
 * green having compared two login screens.
 */
export function exitCodeForRows(rows, exitCode = 0) {
  return rows.some(row => row.status === 'error') ? Math.max(exitCode, 1) : exitCode
}

/**
 * The matrix job's exit code — the PRODUCTION path.
 *
 * Wraps the row check AND the prerender check, so a test can assert on the
 * decision the job actually makes. Asserting on `exitCodeForRows` alone left
 * the call site unpinned: emptying `rows` before the call, or dropping the
 * prerender check, left the suite green while the job's verdict changed.
 */
export function matrixExitCode(rows, exitCode = 0, { prerender = null, options = null } = {}) {
  let code = exitCodeForRows(rows, exitCode)
  if (options?.prerender && prerender?.verdict === 'fail') code = Math.max(code, 1)
  return code
}

export async function main(argv) {
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    log.error(error.message)
    return 2
  }
  if (parsed.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  const options = parsed.options
  log.setJsonMode(options.json)
  try {
    const result = await runMatrix(options)
    if (options.json) log.printJson(result.overview)
    return result.exitCode
  } catch (error) {
    if (error instanceof HarnessError) {
      log.error(error.message)
      return 2
    }
    log.error(`unexpected error: ${error.stack ?? error.message}`)
    return 2
  }
}

const invokedDirectly = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  process.exitCode = await main(process.argv.slice(2))
}
