/**
 * Parity harness configuration: contracts, deterministic capture constants,
 * CLI parsing and matrix/route selection.
 *
 * Everything that can drift lives in `contracts/` (ui.json for viewports,
 * themes, device scale factor and the shared fixed clock; routes.json for the
 * route list and parity priorities). The in-code fallbacks exist only so the
 * harness can boot before the contracts land — they print a warning and are
 * never reported as evidence.
 */
import path from 'node:path'
import {
  ALLOWLIST_PATH,
  DEFAULT_OUT_DIR,
  ROOT,
  HarnessError,
  isHttpUrl,
  log,
  parseFiniteNumber,
  pathExists,
  readJsonFile,
  splitList,
} from './util.mjs'

/** Used only when contracts/ui.json is absent; mirrors the contract values. */
export const FALLBACK_FIXED_NOW = '2026-11-08T17:00:00.000Z'

export const DEFAULT_TOLERANCE = {
  maxDiffRatio: 0.001,
  pixelThreshold: 0.12,
  /**
   * Exact per-pixel comparison by default. --edge-tolerance 1 additionally
   * accepts a pixel when the other image matches within +/-1 px (edge-raster
   * phase). It is opt-in per comparison and can never mask feature changes:
   * see docs/rebuild/PARITY.md section 2.
   */
  edgeTolerance: 0,
}

/**
 * Determinism constants. These are behavioural knobs, not app knowledge:
 * locale/timezone match the machine context the archive is authored in, and
 * the scroll sweep uses the same steps the e2e support layer documents.
 */
export const CAPTURE = {
  locale: 'en-US',
  timezoneId: 'America/New_York',
  reducedMotion: 'reduce',
  colorSchemeFromTheme: true,
  scrollbarGutter: 'stable',
  scrollStepPx: 600,
  scrollStepSettleMs: 80,
  scrollSettleMs: 150,
  sliceSettleMs: 120,
  maxPageHeightPx: 60000,
  warmupSettleMs: 1800,
  captureSettleMs: 150,
  /** Extra fake-clock advance after the page settles, before screenshots. */
  finalRunForMs: 1500,
  /** Frames advanced after each scroll step (lazy-load trigger flush). */
  scrollRunForMs: 48,
  /** Fake-time budget after each window scroll: completes in-view reveal animations. */
  windowRunForMs: 900,
  /**
   * Fixed number of viewport windows captured per shot, at absolute scroll
   * offsets 0, viewportHeight, 2*viewportHeight, … clamped to the page bottom.
   * The count is deliberately independent of page height so a layout-height
   * difference between legacy and rebuild cannot change the capture plan.
   */
  windowCount: 8,
  viewportMeta: 'width=device-width, initial-scale=1.0',
}

/**
 * Optional per-route CSS masks. A selector listed here is hidden before
 * capture and therefore excluded from the pixel diff. Masks are the last
 * resort for genuinely time/random-dependent decoration; a whole
 * route/viewport/theme combination belongs in contracts/parity-allowlist.json
 * instead. Each entry must explain itself in docs/rebuild/PARITY.md.
 */
export const ROUTE_MASKS = {
  // Empty on purpose: Home's residual is a page-wide raster phase (see the
  // documented allowlist entries), not a discrete time-driven widget, so a mask
  // would hide real content without measuring anything.
}

/**
 * Captured-URL overrides for contract route ids whose contract `path` is not a
 * navigable URL.
 *
 * `contracts/routes.json` describes the SPA catch-all as `/*` (it is not a URL
 * you can request, and it deliberately has no dedicated `/404` route). The
 * harness therefore captures a *representative* unmatched URL instead:
 *
 *   not-found → /people
 *
 * `/people` is the frozen app's retired face-recognition route: the SPA fallback
 * serves the shared shell and the router renders the NotFound view (noindex,
 * nofollow, canonical /404) while tests/e2e/seo.spec.ts and smoke.spec.ts assert
 * exactly that 404 behaviour. Any future non-navigable contract route id gets
 * its representative URL here — never hardcoded inside capture.mjs.
 */
export const ROUTE_PATH_OVERRIDES = {
  'not-found': '/people',
  // The contract gates the admin shell behind `/admin/*`; `/admin` is its
  // navigable dashboard URL (both apps render the dashboard at /admin).
  admin: '/admin',
}

/**
 * Synthetic admin credentials for the rebuild's current Wave-7 in-memory auth
 * stub (`rebuild/src/features/admin/fixtures.ts`). They are documented test
 * fixtures, never real credentials, and only used by `--admin-login` capture.
 * The frozen legacy app authenticates with the seeded Supabase session instead,
 * so it never reaches a login form.
 */
export const ADMIN_LOGIN_DEFAULTS = {
  enabled: true,
  email: 'admin@test.wedding',
  password: 'admin-fixture-password',
  submitTimeoutMs: 20000,
}

/**
 * Admin child sections captured by the full matrix (Wave 9 W9-1).
 *
 * Both apps serve the same 10 sections under `/admin/*`; `/admin/photos` is the
 * uploads-moderation route in both apps, so the task's `/admin/uploads` is
 * captured as the documented alias row `admin-uploads` (unknown section →
 * dashboard on the rebuild; layout-only fallback on the legacy app).
 */
export const ADMIN_CAPTURE_SECTIONS = [
  'photos',
  'uploads',
  'albums',
  'review',
  'claims',
  'guestbook',
  'featured',
  'audit',
  'analytics',
  'settings',
]

/** Build synthetic contract-shaped admin routes for the extra matrix rows. */
export function adminCaptureRoutes() {
  return ADMIN_CAPTURE_SECTIONS.map(section => ({
    id: `admin-${section}`,
    path: `/admin/${section}`,
    kind: 'admin',
    auth: 'admin',
    parity: 2,
    matrix: ['desktop', 'mobile'],
    themes: ['dark', 'light'],
    query: [],
    fixtures: [],
    notes:
      section === 'uploads'
        ? 'Alias row: /admin/photos is the uploads route in both apps; /admin/uploads is not a frozen route (unknown section → dashboard).'
        : `Admin section /admin/${section}.`,
  }))
}

export const FALLBACK_UI = {
  themes: ['dark', 'light'],
  defaultTheme: 'dark',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
  fixedNow: FALLBACK_FIXED_NOW,
  viewports: {
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 },
  },
  fonts: [],
  breakpoints: {},
}

/**
 * In-code fallback route list, reconstructed from the frozen app's router
 * (src/App.tsx). Replace-by-contract is expected; the harness warns when the
 * fallback is in use so evidence is never taken from it silently.
 */
export const FALLBACK_ROUTES = [
  { id: 'home', path: '/', kind: 'public', auth: 'none', parity: 1 },
  { id: 'film', path: '/film', kind: 'public', auth: 'none', parity: 1 },
  { id: 'gallery', path: '/gallery', kind: 'public', auth: 'none', parity: 1 },
  { id: 'guestbook', path: '/guestbook', kind: 'public', auth: 'none', parity: 1 },
  { id: 'upload', path: '/upload', kind: 'public', auth: 'none', parity: 2 },
  { id: 'guest-photos', path: '/guest-photos', kind: 'public', auth: 'none', parity: 2 },
  { id: 'activity', path: '/activity', kind: 'public', auth: 'none', parity: 2 },
  { id: 'print', path: '/print', kind: 'print', auth: 'none', parity: 2 },
  { id: 'admin-login', path: '/admin/login', kind: 'admin', auth: 'none', parity: 3 },
  { id: 'admin', path: '/admin', kind: 'admin', auth: 'admin', parity: 3 },
  { id: 'guest-share', path: '/guest/:token', kind: 'guest', auth: 'guest-token', parity: 3 },
  { id: 'not-found', path: '/__parity-missing__', kind: 'error', auth: 'none', parity: 3 },
].map(route => ({ ...route, matrix: ['desktop', 'mobile'], themes: ['dark', 'light'], query: [] }))

const UI_THEMES = ['dark', 'light']

function fail(message) {
  throw new HarnessError(message)
}

/** Load and validate contracts/ui.json (with documented fallback). */
export async function loadUiContract({ root = ROOT } = {}) {
  const file = path.join(root, 'contracts', 'ui.json')
  if (!(await pathExists(file))) {
    return {
      source: 'fallback',
      file: null,
      warnings: [
        'contracts/ui.json is missing — using documented fallback viewports/themes/fixedNow.',
      ],
      ...FALLBACK_UI,
    }
  }
  const raw = await readJsonFile(file)
  const warnings = []

  const themes = Array.isArray(raw.themes) && raw.themes.length ? raw.themes : FALLBACK_UI.themes
  if (themes.length !== (raw.themes?.length ?? 0))
    fail('contracts/ui.json: "themes" must be a non-empty array')
  for (const theme of themes) {
    if (!UI_THEMES.includes(theme)) fail(`contracts/ui.json: unsupported theme "${theme}"`)
  }

  const viewports = raw.viewports
  if (!viewports || typeof viewports !== 'object')
    fail('contracts/ui.json: "viewports" is required')
  for (const name of ['desktop', 'mobile']) {
    const viewport = viewports[name]
    if (!viewport || !Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)) {
      fail(`contracts/ui.json: viewports.${name} needs integer width/height`)
    }
  }

  const deviceScaleFactor = raw.deviceScaleFactor ?? FALLBACK_UI.deviceScaleFactor
  if (typeof deviceScaleFactor !== 'number' || deviceScaleFactor <= 0) {
    fail('contracts/ui.json: "deviceScaleFactor" must be a positive number')
  }

  const fixedNow = raw.fixedNow ?? FALLBACK_FIXED_NOW
  if (Number.isNaN(new Date(fixedNow).getTime())) {
    fail(`contracts/ui.json: "fixedNow" is not a valid date string: ${fixedNow}`)
  }
  if (!raw.fixedNow) warnings.push('contracts/ui.json has no fixedNow — using documented fallback.')

  const reducedMotion = raw.reducedMotion ?? CAPTURE.reducedMotion
  if (reducedMotion !== 'reduce') fail('contracts/ui.json: "reducedMotion" must be "reduce"')

  return {
    source: 'contracts/ui.json',
    file,
    themes,
    defaultTheme: raw.defaultTheme ?? FALLBACK_UI.defaultTheme,
    reducedMotion,
    deviceScaleFactor,
    fixedNow,
    viewports: { desktop: { ...viewports.desktop }, mobile: { ...viewports.mobile } },
    fonts: Array.isArray(raw.fonts) ? raw.fonts : [],
    breakpoints: raw.breakpoints ?? {},
    warnings,
  }
}

function validateRoute(route, index) {
  if (!route || typeof route !== 'object')
    fail(`contracts/routes.json: routes[${index}] is not an object`)
  if (typeof route.id !== 'string' || !route.id)
    fail(`contracts/routes.json: routes[${index}].id is required`)
  if (typeof route.path !== 'string' || !route.path.startsWith('/')) {
    fail(`contracts/routes.json: routes[${index}] (${route.id}) path must start with "/"`)
  }
  if (![1, 2, 3].includes(route.parity)) {
    fail(`contracts/routes.json: routes[${index}] (${route.id}) parity must be 1, 2 or 3`)
  }
  const matrix =
    Array.isArray(route.matrix) && route.matrix.length ? route.matrix : ['desktop', 'mobile']
  const themes = Array.isArray(route.themes) && route.themes.length ? route.themes : UI_THEMES
  return {
    id: route.id,
    path: route.path,
    kind: route.kind ?? 'public',
    auth: route.auth ?? 'none',
    parity: route.parity,
    query: Array.isArray(route.query) ? route.query : [],
    matrix,
    themes,
    fixtures: Array.isArray(route.fixtures) ? route.fixtures : [],
    notes: route.notes ?? '',
  }
}

/** Load and validate contracts/routes.json (with documented fallback). */
export async function loadRoutesContract({ root = ROOT } = {}) {
  const file = path.join(root, 'contracts', 'routes.json')
  if (!(await pathExists(file))) {
    return {
      source: 'fallback',
      file: null,
      warnings: ['contracts/routes.json is missing — using documented fallback route list.'],
      routes: FALLBACK_ROUTES.map(route => ({ ...route })),
    }
  }
  const raw = await readJsonFile(file)
  if (!Array.isArray(raw.routes) || raw.routes.length === 0) {
    fail('contracts/routes.json: "routes" must be a non-empty array')
  }
  const ids = new Set()
  const routes = raw.routes.map((route, index) => {
    const validated = validateRoute(route, index)
    if (ids.has(validated.id)) fail(`contracts/routes.json: duplicate route id "${validated.id}"`)
    ids.add(validated.id)
    return validated
  })
  return { source: 'contracts/routes.json', file, warnings: [], routes }
}

/**
 * Resolve the URL path a contract route is captured at.
 *
 * Precedence:
 *  1. ROUTE_PATH_OVERRIDES[route.id] — representative URL for a non-navigable
 *     contract path (e.g. `not-found` → `/people`);
 *  2. the contract path itself, with `:token` and `*` substituted.
 */
export function resolveRoutePath(route, { guestToken } = {}) {
  const override = ROUTE_PATH_OVERRIDES[route.id]
  if (override) {
    let overridden = override
    if (overridden.includes(':token')) {
      if (!guestToken) fail(`route "${route.id}" needs a guest token fixture but none is available`)
      overridden = overridden.replace(':token', encodeURIComponent(guestToken))
    }
    return overridden
  }
  let routePath = route.path
  if (routePath.includes(':token')) {
    if (!guestToken) fail(`route "${route.id}" needs a guest token fixture but none is available`)
    routePath = routePath.replace(':token', encodeURIComponent(guestToken))
  }
  if (routePath.includes('*')) routePath = routePath.replaceAll('*', '__parity-missing__')
  return routePath
}

/** Report which selected routes use a capture-path override (goes in summary.json). */
export function capturePathOverrides(routes) {
  const applied = {}
  for (const route of routes) {
    const override = ROUTE_PATH_OVERRIDES[route.id]
    if (override) applied[route.id] = { contractPath: route.path, capturePath: override }
  }
  return applied
}

function resolveViewports(ui, matrix) {
  const available = Object.entries(ui.viewports).map(([name, viewport]) => ({
    name,
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: ui.deviceScaleFactor,
  }))
  if (matrix === 'all') return { viewports: available, warnings: [] }
  const requested = splitList(matrix)
  if (requested.length === 0) fail('--matrix needs "all" or a comma list of viewports')
  const viewports = []
  for (const name of requested) {
    const match = available.find(candidate => candidate.name === name)
    if (!match) {
      fail(
        `--matrix contains unknown viewport "${name}" (available: ${available.map(v => v.name).join(', ')})`
      )
    }
    viewports.push(match)
  }
  return { viewports, warnings: [] }
}

function selectRoutes(routesContract, routesOption, warnings) {
  if (routesOption === 'all') return routesContract.routes.filter(route => route.parity <= 3)
  if (routesOption === 'priority') {
    const priority = routesContract.routes.filter(route => route.parity === 1)
    if (priority.length === 0) {
      warnings.push('routes.json has no parity===1 routes — falling back to every route.')
      return routesContract.routes
    }
    return priority
  }
  const requested = splitList(routesOption)
  if (requested.length === 0) fail('--routes needs "priority", "all" or a comma list of route ids')
  const selected = []
  for (const id of requested) {
    const match = routesContract.routes.find(route => route.id === id || route.path === id)
    if (!match) {
      fail(
        `--routes contains unknown route "${id}" (available: ${routesContract.routes
          .map(route => route.id)
          .join(', ')})`
      )
    }
    selected.push(match)
  }
  return selected
}

/**
 * Resolve the capture plan from CLI options + contracts.
 * Returns route/viewport/theme triples plus everything the summary needs.
 */
export function resolveSelection({ ui, routesContract, options }) {
  const warnings = []
  const routes = selectRoutes(routesContract, options.routes, warnings)
  const { viewports, warnings: viewportWarnings } = resolveViewports(ui, options.matrix)
  warnings.push(...viewportWarnings)

  const requestedThemes =
    options.themes === undefined || options.themes === null ? null : splitList(options.themes)
  const themes = requestedThemes ?? ui.themes
  for (const theme of themes) {
    if (!ui.themes.includes(theme))
      fail(
        `--themes contains "${theme}" but contracts/ui.json declares only ${ui.themes.join(', ')}`
      )
  }

  const plan = []
  for (const route of routes) {
    for (const viewport of viewports) {
      if (!route.matrix.includes(viewport.name)) continue
      for (const theme of themes) {
        if (!route.themes.includes(theme)) continue
        plan.push({
          route,
          viewport,
          theme,
          key: `${route.id}__${viewport.name}__${theme}`,
        })
      }
    }
  }
  if (plan.length === 0) {
    fail('the selected route/viewport/theme intersection is empty — nothing to capture')
  }
  return { routes, viewports, themes, plan, warnings }
}

/** Per-route mask selectors (config list, then optional caller override). */
export function maskSelectorsFor(routeId, overrides = {}) {
  const extra = overrides[routeId] ?? []
  return [...(ROUTE_MASKS[routeId] ?? []), ...extra]
}

export function agentInputSpec() {
  return '[--routes priority|all|<ids>] [--matrix desktop,mobile|all] [--themes dark,light] [--out <dir>] [--max-diff-ratio 0.001] [--pixel-threshold 0.12] [--wave <n>] [--allowlist <file>] [--json]'
}

export const USAGE = `Usage: node tools/parity/compare.mjs --legacy-url <url> --rebuild-url <url> ${agentInputSpec()}

Options:
  --legacy-url <url>       Base URL of the frozen legacy build (oracle)
  --rebuild-url <url>      Base URL of the rebuild build
  --routes <selector>      priority (parity===1, default), all, or comma list of route ids
  --matrix <selector>      all (default) or comma list of viewport names (desktop,mobile)
  --themes <selector>      comma list of themes (default: contracts/ui.json themes)
  --out <dir>              Output directory (default: tools/parity/output)
  --max-diff-ratio <n>     Maximum changed-pixel ratio per slice (default: 0.001)
  --pixel-threshold <n>    Per-pixel colour threshold, 0..1 (default: 0.12)
  --edge-tolerance <n>     Accept a pixel matched within +/-n px neighbourhood; 0 = exact (default: 0)
  --wave <n>               Current rebuild wave; allowlist entries expire before it
  --allowlist <file>       Allowlist path (default: contracts/parity-allowlist.json)
  --json                   Print a machine-readable JSON summary to stdout
  --help                   Show this help

Exit codes: 0 = pass, 1 = unexplained diff, 2 = harness/config error.`

/**
 * Parse compare CLI arguments. Throws HarnessError on usage mistakes.
 * `--help` returns { help: true }.
 */
export function parseCompareArgs(argv) {
  const options = {
    legacyUrl: null,
    rebuildUrl: null,
    routes: 'priority',
    matrix: 'all',
    themes: null,
    outDir: DEFAULT_OUT_DIR,
    maxDiffRatio: DEFAULT_TOLERANCE.maxDiffRatio,
    pixelThreshold: DEFAULT_TOLERANCE.pixelThreshold,
    edgeTolerance: DEFAULT_TOLERANCE.edgeTolerance,
    wave: 1,
    allowlistPath: ALLOWLIST_PATH,
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
  while (index < args.length) {
    const arg = args[index]
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--legacy-url':
        options.legacyUrl = readValue('--legacy-url')
        break
      case '--rebuild-url':
        options.rebuildUrl = readValue('--rebuild-url')
        break
      case '--routes':
        options.routes = readValue('--routes')
        break
      case '--matrix':
        options.matrix = readValue('--matrix')
        break
      case '--themes':
        options.themes = readValue('--themes')
        break
      case '--out':
        options.outDir = path.resolve(readValue('--out'))
        break
      case '--max-diff-ratio':
        options.maxDiffRatio = parseFiniteNumber(readValue('--max-diff-ratio'), 'max-diff-ratio', {
          min: 0,
          max: 1,
        })
        break
      case '--pixel-threshold':
        options.pixelThreshold = parseFiniteNumber(
          readValue('--pixel-threshold'),
          'pixel-threshold',
          { min: 0, max: 1 }
        )
        break
      case '--edge-tolerance': {
        options.edgeTolerance = parseFiniteNumber(readValue('--edge-tolerance'), 'edge-tolerance', {
          min: 0,
          max: 4,
        })
        if (!Number.isInteger(options.edgeTolerance)) fail('--edge-tolerance must be an integer')
        break
      }
      case '--wave': {
        options.wave = parseFiniteNumber(readValue('--wave'), 'wave', { min: 1, max: 1000 })
        if (!Number.isInteger(options.wave)) fail('--wave must be an integer')
        break
      }
      case '--allowlist':
        options.allowlistPath = path.resolve(readValue('--allowlist'))
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
  if (!isHttpUrl(options.legacyUrl))
    fail(`--legacy-url is not an absolute http(s) URL: ${options.legacyUrl}`)
  if (!isHttpUrl(options.rebuildUrl))
    fail(`--rebuild-url is not an absolute http(s) URL: ${options.rebuildUrl}`)
  return { help: false, options }
}

/** Trivial GET so a dead preview fails fast with a config error, not per-shot noise. */
export async function probeUrl(url, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    await response.arrayBuffer()
    return { ok: response.ok, status: response.status, url: response.url }
  } catch (error) {
    throw new HarnessError(
      `Cannot reach ${url}: ${error.message}. Is the preview server running? Do not start or replace servers from this harness.`,
      { cause: error }
    )
  } finally {
    clearTimeout(timer)
  }
}

export function announceWarnings(warnings) {
  for (const warning of warnings) log.warn(warning)
}
