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
 *    per-route metadata on the rebuild side (Wave 8 W8-1), reporting
 *    pass/pending/fail without touching the parity verdict of the capture.
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

function parseArgs(argv) {
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
  }
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
        options.outDir = path.resolve(readValue(arg))
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
  let status = 'pending'
  if (results.length === 0) status = 'not-applicable'
  else if (rebuildDone === results.length) status = 'pass'
  else if (rebuildDone > 0) status = 'fail'
  return {
    checkedAt: nowIso(),
    status,
    expectedRoutes: results.length,
    rebuildPrerendered: rebuildDone,
    note:
      status === 'pending'
        ? 'No per-route served metadata found yet — W8-1 prerendering has not landed. Captures still assert the hydrated DOM.'
        : status === 'fail'
          ? 'Some routes are prerendered and some are not — inconsistent prerender output.'
          : null,
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

function buildRows(shots, { includeAdmin }) {
  return shots.map(shot => {
    const admin = isAdminRow(shot, includeAdmin)
    const legacyLogin = String(shot.legacy?.finalUrl ?? '').endsWith('/admin/login')
    const rebuildLogin = String(shot.rebuild?.finalUrl ?? '').endsWith('/admin/login')
    let captureClass = 'captured'
    let exemptReason = null
    if (admin) {
      if (legacyLogin && rebuildLogin) {
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
    return {
      key: shot.key,
      route: shot.route,
      path: shot.urlPath,
      viewport: shot.viewport,
      theme: shot.theme,
      admin,
      captureClass,
      exemptReason,
      status: shot.status,
      ratio: shot.pixelDiff?.ratio ?? null,
      changedPixels: shot.pixelDiff?.changedPixels ?? null,
      totalPixels: shot.pixelDiff?.totalPixels ?? null,
      textDiffs: shot.textDiff?.status === 'fail' ? (shot.textDiff.differences?.length ?? 0) : 0,
      legacyHeight: shot.legacy?.pageHeightPx ?? null,
      rebuildHeight: shot.rebuild?.pageHeightPx ?? null,
      failureReasons: shot.failureReasons ?? [],
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

function matrixOverview(summary, rows, { includeAdmin, prerender, outDir }) {
  const counts = {
    rows: rows.length,
    pass: rows.filter(row => row.status === 'pass').length,
    allowed: rows.filter(row => row.status === 'allowed').length,
    fail: rows.filter(row => row.status === 'fail').length,
    error: rows.filter(row => row.status === 'error').length,
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
    rows,
    compare: {
      summaryPath: path.join(path.relative(ROOT, outDir).split(path.sep).join('/'), 'summary.json'),
      reportPath: path.join(path.relative(ROOT, outDir).split(path.sep).join('/'), 'report.html'),
    },
    tolerance: summary.tolerance,
    determinism: summary.determinism,
  }
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
- rows: ${counts.rows} (${counts.pass} pass, ${counts.allowed} allowed, ${counts.fail} fail, ${counts.error} error, ${counts.exempt} exempt admin rows)

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

  const compareResult = await runCompare({
    legacyUrl: options.legacyUrl,
    rebuildUrl: options.rebuildUrl,
    routes: options.routes,
    matrix: options.matrix,
    themes: options.themes,
    outDir: options.outDir,
    maxDiffRatio: options.maxDiffRatio,
    pixelThreshold: options.pixelThreshold,
    edgeTolerance: options.edgeTolerance,
    wave: options.wave,
    extraRoutes,
    resume: options.resume,
    report: true,
    adminLogin: options.adminLogin,
  })

  const rows = buildRows(compareResult.summary.shots ?? [], { includeAdmin: options.includeAdmin })
  const overview = matrixOverview(compareResult.summary, rows, {
    includeAdmin: options.includeAdmin,
    prerender,
    outDir: options.outDir,
  })
  overview.command = `node tools/parity/matrix.mjs --legacy-url ${options.legacyUrl} --rebuild-url ${options.rebuildUrl} --wave ${options.wave}`
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
          ? `Prerender (W8-1): ${prerender.status} — ${prerender.rebuildPrerendered}/${prerender.expectedRoutes} rebuild routes served per-route metadata.\n\n`
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
    `Matrix: ${overview.counts.rows} rows — ${overview.counts.pass} pass, ${overview.counts.allowed} allowed, ` +
      `${overview.counts.fail} fail, ${overview.counts.error} error, ${overview.counts.exempt} exempt`
  )
  log.out(`Matrix summary: ${summaryPath}`)
  log.out(`Markdown:       ${matrixMarkdownPath}`)
  log.out(`Output README:  ${readmePath}`)

  let exitCode = compareResult.exitCode
  if (options.prerender && prerender?.status === 'fail') exitCode = Math.max(exitCode, 1)
  return { overview, exitCode, summaryPath, matrixMarkdownPath, readmePath }
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
