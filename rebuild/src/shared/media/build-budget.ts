/**
 * Bundle budget measurement helpers (pure, no filesystem access).
 *
 * `rebuild/scripts/check-budgets.mjs` reads `rebuild/dist`, gzips each emitted
 * asset, and uses these helpers to derive the *initial* JS set from
 * `dist/index.html` (entry module script + `<link rel="modulepreload">`, i.e.
 * exactly what the browser must download before first paint) and to evaluate
 * the QUALITY_BAR budgets:
 *
 *   initial JS ≤ 180 KiB gzip, any route ≤ 120 KiB gzip incremental,
 *   total JS ≤ 450 KiB gzip.
 *
 * The budgets file (`rebuild/perf/budgets.baseline.json`) records the measured
 * numbers of a known build so a *regression* is distinguishable from a target
 * miss: CI can run `--mode baseline` today and switch to `--mode strict` once
 * the initial-payload optimisation lands.
 */

export const KIB = 1024

export type BudgetMode = 'strict' | 'baseline'

export interface BudgetTargets {
  /** QUALITY_BAR: initial JS (entry + modulepreloads) gzip budget. */
  initialJsGzKiB: number
  /** QUALITY_BAR: any route/lazy chunk incremental gzip budget. */
  routeChunkGzKiB: number
  /** QUALITY_BAR: total JS gzip budget. */
  totalJsGzKiB: number
  /** Initial CSS is tracked (no QUALITY_BAR number yet; regression-gated). */
  initialCssGzKiB: number
}

export const DEFAULT_BUDGET_TARGETS: BudgetTargets = {
  initialJsGzKiB: 180,
  routeChunkGzKiB: 120,
  totalJsGzKiB: 450,
  initialCssGzKiB: 40,
}

export interface AssetMeasurement {
  /** File name inside `dist/assets`, e.g. `home-BIBVthCh.js`. */
  file: string
  rawBytes: number
  gzipBytes: number
  brotliBytes?: number
}

export type ChunkKind = 'entry' | 'preload' | 'lazy'

export interface ChunkMeasurement extends AssetMeasurement {
  kind: ChunkKind
  /** Route label for lazy chunks (`/`, `/film`, `/gallery`, `shared`, ...). */
  route: string
}

export interface InitialReferences {
  entryScripts: string[]
  modulePreloads: string[]
  stylesheets: string[]
}

export interface BudgetMeasurement {
  initialJsGzBytes: number
  initialCssGzBytes: number
  totalJsGzBytes: number
  chunks: ChunkMeasurement[]
}

export interface BudgetViolation {
  metric: string
  actualKiB: number
  limitKiB: number
  message: string
}

export interface BudgetRegression {
  metric: string
  actualKiB: number
  baselineKiB: number
  deltaKiB: number
  message: string
}

export interface BudgetBaseline {
  schemaVersion: number
  documentedAt: string
  source: string
  compression: string
  targets: BudgetTargets
  measured: {
    initialJsGzBytes: number
    initialCssGzBytes: number
    totalJsGzBytes: number
    /** Lazy-chunk gzip bytes aggregated per route label (hash-free). */
    byRoute: Record<string, number>
  }
  /** Per-chunk table of the build the baseline was captured on. */
  chunks: Array<{
    file: string
    kind: ChunkKind
    route: string
    rawBytes: number
    gzipBytes: number
    brotliBytes?: number
  }>
  notes?: string[]
}

export interface BudgetReport {
  kind: 'bundle-budget-report'
  schemaVersion: 1
  mode: BudgetMode
  dist: string
  targets: BudgetTargets
  measurement: BudgetMeasurement
  initialCss: AssetMeasurement[]
  /** Lazy chunks with their budget verdict. */
  routeRows: Array<ChunkMeasurement & { pass: boolean }>
  violations: BudgetViolation[]
  regressions: BudgetRegression[]
  verdict: 'pass' | 'fail'
}

const ROUTE_LABELS: Record<string, string> = {
  home: '/',
  'guest-share': '/guest/:token',
  'guest-photos': '/guest-photos',
  activity: '/activity',
  'activity-route': '/activity',
  'gallery-route': '/gallery',
  'guestbook-route': '/guestbook',
  'admin-routes': '/admin/*',
  'admin-login': '/admin/login',
  'not-found': '/404',
  film: '/film',
  GalleryPage: '/gallery',
  UploadPage: '/upload',
  GuestbookPage: '/guestbook',
  GuestPhotosPage: '/guest-photos',
  GuestSharePage: '/guest/:token',
  ActivityPage: '/activity',
  PrintPage: '/print',
  AdminPage: '/admin',
  AdminLoginPage: '/admin/login',
  NotFound: '/404',
}

const SHARED_PREFIXES = [
  'index',
  'createLucideIcon',
  'cn',
  'hooks',
  'vendor',
  'react',
  'motion',
  'supabase',
  'router',
  'query',
  'copy',
  'share',
  'camera',
  'book',
  'calendar',
  'chevron',
  'lucide',
]

function stripAssetsPrefix(href: string): string {
  const withoutQuery = href.split('?')[0] ?? href
  const normalized = withoutQuery.replace(/^\//, '')
  return normalized.startsWith('assets/') ? normalized.slice('assets/'.length) : normalized
}

/** Extract the initial-JS/CSS references from the built `index.html`. */
export function parseIndexHtmlReferences(html: string): InitialReferences {
  const entryScripts: string[] = []
  const modulePreloads: string[] = []
  const stylesheets: string[] = []

  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0]
    const src = /src="([^"]+)"/i.exec(tag)?.[1]
    if (src && /type="module"/i.test(tag)) entryScripts.push(stripAssetsPrefix(src))
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    const href = /href="([^"]+)"/i.exec(tag)?.[1]
    if (!href) continue
    if (/rel="modulepreload"/i.test(tag)) modulePreloads.push(stripAssetsPrefix(href))
    if (/rel="stylesheet"/i.test(tag)) stylesheets.push(stripAssetsPrefix(href))
  }

  return { entryScripts, modulePreloads, stylesheets }
}

/** `/` or `/film` etc. for a chunk file; `shared` for framework/vendor chunks. */
export function routeLabelFromFileName(file: string): string {
  const base = file.replace(/-[A-Za-z0-9_-]{8}\.js$/, '').replace(/\.js$/, '')
  if (ROUTE_LABELS[base]) return ROUTE_LABELS[base] ?? 'shared'
  const prefix = Object.keys(ROUTE_LABELS).find(key => base.startsWith(key))
  if (prefix) return ROUTE_LABELS[prefix] ?? 'shared'
  if (SHARED_PREFIXES.some(shared => base.toLowerCase().startsWith(shared.toLowerCase()))) {
    return 'shared'
  }
  // Small vendor/icon chunks that rolldown split out of shared imports; not a route.
  return 'shared'
}

/** Enrich raw asset measurements with entry/preload/lazy classification. */
export function classifyChunks(
  assets: AssetMeasurement[],
  refs: InitialReferences
): ChunkMeasurement[] {
  const entry = new Set(refs.entryScripts)
  const preloads = new Set(refs.modulePreloads)

  return assets
    .filter(asset => asset.file.endsWith('.js'))
    .map(asset => {
      const kind: ChunkKind = entry.has(asset.file)
        ? 'entry'
        : preloads.has(asset.file)
          ? 'preload'
          : 'lazy'
      return {
        ...asset,
        kind,
        route: kind === 'lazy' ? routeLabelFromFileName(asset.file) : 'initial',
      }
    })
}

/** Sum the budgets the browser pays before first paint and the lazy payload. */
export function measureBudgets(
  chunks: ChunkMeasurement[],
  cssAssets: AssetMeasurement[],
  refs: InitialReferences
): BudgetMeasurement {
  const initialJsGzBytes = chunks
    .filter(chunk => chunk.kind !== 'lazy')
    .reduce((total, chunk) => total + chunk.gzipBytes, 0)
  const totalJsGzBytes = chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0)
  const cssFiles = new Set(refs.stylesheets)
  const initialCssGzBytes = cssAssets
    .filter(asset => cssFiles.has(asset.file))
    .reduce((total, asset) => total + asset.gzipBytes, 0)

  return { initialJsGzBytes, initialCssGzBytes, totalJsGzBytes, chunks }
}

/** Lazy-chunk gzip bytes aggregated per route label (hash-independent). */
export function aggregateByRoute(chunks: ChunkMeasurement[]): Record<string, number> {
  const byRoute: Record<string, number> = {}
  for (const chunk of chunks) {
    if (chunk.kind !== 'lazy') continue
    byRoute[chunk.route] = (byRoute[chunk.route] ?? 0) + chunk.gzipBytes
  }
  return Object.fromEntries(Object.entries(byRoute).sort(([a], [b]) => a.localeCompare(b)))
}

export function formatKiB(bytes: number): string {
  return `${(bytes / KIB).toFixed(1)} KiB`
}

function toKiB(bytes: number): number {
  return Math.round((bytes / KIB) * 10) / 10
}

/** Target checks (QUALITY_BAR). */
export function findViolations(
  measurement: BudgetMeasurement,
  targets: BudgetTargets
): BudgetViolation[] {
  const violations: BudgetViolation[] = []
  const push = (metric: string, actual: number, limit: number) => {
    if (actual > limit) {
      violations.push({
        metric,
        actualKiB: toKiB(actual),
        limitKiB: limit / KIB,
        message: `${metric} ${formatKiB(actual)} exceeds ${limit / KIB} KiB budget`,
      })
    }
  }

  push('initial JS (gzip)', measurement.initialJsGzBytes, targets.initialJsGzKiB * KIB)
  push('total JS (gzip)', measurement.totalJsGzBytes, targets.totalJsGzKiB * KIB)
  push('initial CSS (gzip)', measurement.initialCssGzBytes, targets.initialCssGzKiB * KIB)

  for (const chunk of measurement.chunks) {
    if (chunk.kind === 'lazy' && chunk.gzipBytes > targets.routeChunkGzKiB * KIB) {
      violations.push({
        metric: `${chunk.route} route chunk (gzip)`,
        actualKiB: toKiB(chunk.gzipBytes),
        limitKiB: targets.routeChunkGzKiB,
        message: `${chunk.file} (${chunk.route}) ${formatKiB(chunk.gzipBytes)} exceeds ${targets.routeChunkGzKiB} KiB route budget`,
      })
    }
  }

  return violations
}

const REGRESSION_TOLERANCE_KIB = 2

/**
 * Regression checks against the recorded baseline. Aggregate metrics and the
 * per-route lazy aggregate are compared (hashed chunk file names change on
 * every build, so file-level comparison would create false positives).
 */
export function findRegressions(
  measurement: BudgetMeasurement,
  baseline: BudgetBaseline
): BudgetRegression[] {
  const regressions: BudgetRegression[] = []
  const push = (metric: string, actualBytes: number, baselineBytes: number) => {
    const deltaBytes = actualBytes - baselineBytes
    if (toKiB(deltaBytes) <= REGRESSION_TOLERANCE_KIB) return
    regressions.push({
      metric,
      actualKiB: toKiB(actualBytes),
      baselineKiB: toKiB(baselineBytes),
      deltaKiB: toKiB(deltaBytes),
      message: `${metric} grew by ${formatKiB(deltaBytes)} vs baseline (${formatKiB(actualBytes)} now, ${formatKiB(baselineBytes)} baseline)`,
    })
  }

  push('initial JS (gzip)', measurement.initialJsGzBytes, baseline.measured.initialJsGzBytes)
  push('total JS (gzip)', measurement.totalJsGzBytes, baseline.measured.totalJsGzBytes)
  push('initial CSS (gzip)', measurement.initialCssGzBytes, baseline.measured.initialCssGzBytes)

  const currentByRoute = aggregateByRoute(measurement.chunks)
  for (const [route, baselineBytes] of Object.entries(baseline.measured.byRoute)) {
    const currentBytes = currentByRoute[route] ?? 0
    push(`${route} route chunk (gzip)`, currentBytes, baselineBytes)
  }

  return regressions
}

/** Assemble the CI-friendly report object. */
export function buildBudgetReport(input: {
  mode: BudgetMode
  dist: string
  refs: InitialReferences
  jsAssets: AssetMeasurement[]
  cssAssets: AssetMeasurement[]
  targets: BudgetTargets
  baseline?: BudgetBaseline
}): BudgetReport {
  const chunks = classifyChunks(input.jsAssets, input.refs)
  const measurement = measureBudgets(chunks, input.cssAssets, input.refs)
  const violations = input.mode === 'strict' ? findViolations(measurement, input.targets) : []
  const regressions = input.baseline ? findRegressions(measurement, input.baseline) : []
  const verdict = violations.length === 0 && regressions.length === 0 ? 'pass' : 'fail'
  const cssFiles = new Set(input.refs.stylesheets)

  return {
    kind: 'bundle-budget-report',
    schemaVersion: 1,
    mode: input.mode,
    dist: input.dist,
    targets: input.targets,
    measurement,
    initialCss: input.cssAssets.filter(asset => cssFiles.has(asset.file)),
    routeRows: chunks
      .filter(chunk => chunk.kind === 'lazy')
      .sort((a, b) => b.gzipBytes - a.gzipBytes)
      .map(chunk => ({
        ...chunk,
        pass: chunk.gzipBytes <= input.targets.routeChunkGzKiB * KIB,
      })),
    violations,
    regressions,
    verdict,
  }
}

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`budgets baseline: ${label} must be a finite non-negative number`)
  }
  return value
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`budgets baseline: ${label} must be a string`)
  }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validate `rebuild/perf/budgets.baseline.json`. */
export function parseBudgetBaseline(input: unknown): BudgetBaseline {
  if (!isPlainObject(input)) throw new TypeError('budgets baseline: root must be an object')
  const schemaVersion = assertNumber(input.schemaVersion, 'schemaVersion')
  if (schemaVersion !== 1) {
    throw new TypeError(`budgets baseline: unsupported schemaVersion ${schemaVersion}`)
  }

  if (!isPlainObject(input.targets)) throw new TypeError('budgets baseline: targets missing')
  const targets: BudgetTargets = {
    initialJsGzKiB: assertNumber(input.targets.initialJsGzKiB, 'targets.initialJsGzKiB'),
    routeChunkGzKiB: assertNumber(input.targets.routeChunkGzKiB, 'targets.routeChunkGzKiB'),
    totalJsGzKiB: assertNumber(input.targets.totalJsGzKiB, 'targets.totalJsGzKiB'),
    initialCssGzKiB: assertNumber(input.targets.initialCssGzKiB, 'targets.initialCssGzKiB'),
  }

  if (!isPlainObject(input.measured)) throw new TypeError('budgets baseline: measured missing')
  if (!isPlainObject(input.measured.byRoute)) {
    throw new TypeError('budgets baseline: measured.byRoute missing')
  }
  const byRoute: Record<string, number> = {}
  for (const [route, bytes] of Object.entries(input.measured.byRoute)) {
    byRoute[route] = assertNumber(bytes, `measured.byRoute["${route}"]`)
  }

  if (!Array.isArray(input.chunks)) throw new TypeError('budgets baseline: chunks missing')
  const chunks: BudgetBaseline['chunks'] = input.chunks.map((chunk, index) => {
    if (!isPlainObject(chunk)) throw new TypeError(`budgets baseline: chunks[${index}] invalid`)
    const kind = chunk.kind
    if (kind !== 'entry' && kind !== 'preload' && kind !== 'lazy') {
      throw new TypeError(`budgets baseline: chunks[${index}].kind invalid`)
    }
    return {
      file: assertString(chunk.file, `chunks[${index}].file`),
      kind,
      route: assertString(chunk.route, `chunks[${index}].route`),
      rawBytes: assertNumber(chunk.rawBytes, `chunks[${index}].rawBytes`),
      gzipBytes: assertNumber(chunk.gzipBytes, `chunks[${index}].gzipBytes`),
      ...(chunk.brotliBytes === undefined
        ? {}
        : { brotliBytes: assertNumber(chunk.brotliBytes, `chunks[${index}].brotliBytes`) }),
    }
  })

  return {
    schemaVersion,
    documentedAt: assertString(input.documentedAt, 'documentedAt'),
    source: assertString(input.source, 'source'),
    compression: assertString(input.compression, 'compression'),
    targets,
    measured: {
      initialJsGzBytes: assertNumber(input.measured.initialJsGzBytes, 'measured.initialJsGzBytes'),
      initialCssGzBytes: assertNumber(
        input.measured.initialCssGzBytes,
        'measured.initialCssGzBytes'
      ),
      totalJsGzBytes: assertNumber(input.measured.totalJsGzBytes, 'measured.totalJsGzBytes'),
      byRoute,
    },
    chunks,
    ...(input.notes === undefined ? {} : { notes: input.notes as string[] }),
  }
}

/** Baseline file content from a finished report (deterministic, no timestamps). */
export function reportToBaseline(
  report: BudgetReport,
  metadata: { documentedAt: string; source: string; compression: string; notes?: string[] }
): BudgetBaseline {
  return {
    schemaVersion: 1,
    documentedAt: metadata.documentedAt,
    source: metadata.source,
    compression: metadata.compression,
    targets: report.targets,
    measured: {
      initialJsGzBytes: report.measurement.initialJsGzBytes,
      initialCssGzBytes: report.measurement.initialCssGzBytes,
      totalJsGzBytes: report.measurement.totalJsGzBytes,
      byRoute: aggregateByRoute(report.measurement.chunks),
    },
    chunks: report.measurement.chunks
      .map(chunk => ({
        file: chunk.file,
        kind: chunk.kind,
        route: chunk.route,
        rawBytes: chunk.rawBytes,
        gzipBytes: chunk.gzipBytes,
        ...(chunk.brotliBytes === undefined ? {} : { brotliBytes: chunk.brotliBytes }),
      }))
      .sort((a, b) => b.gzipBytes - a.gzipBytes),
    ...(metadata.notes === undefined ? {} : { notes: metadata.notes }),
  }
}

/** Human-readable table for terminal output. */
export function formatReportTable(report: BudgetReport): string {
  const lines: string[] = []
  const header = ['chunk / metric', 'kind', 'route', 'raw', 'gzip', 'verdict']
  const rows: string[][] = []

  for (const chunk of report.measurement.chunks) {
    rows.push([
      chunk.file,
      chunk.kind,
      chunk.route,
      formatKiB(chunk.rawBytes),
      formatKiB(chunk.gzipBytes),
      chunk.kind !== 'lazy'
        ? 'initial'
        : chunk.gzipBytes <= report.targets.routeChunkGzKiB * KIB
          ? 'ok'
          : 'over',
    ])
  }
  for (const css of report.initialCss) {
    rows.push([
      css.file,
      'css',
      'initial',
      formatKiB(css.rawBytes),
      formatKiB(css.gzipBytes),
      'info',
    ])
  }

  const widths = header.map((title, index) =>
    Math.max(title.length, ...rows.map(row => row[index]?.length ?? 0))
  )
  const renderRow = (row: string[]) =>
    row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ')

  lines.push(renderRow(header))
  lines.push(widths.map(width => '-'.repeat(width)).join('  '))
  for (const row of rows) lines.push(renderRow(row))

  lines.push('')
  lines.push(
    `initial JS (gzip): ${formatKiB(report.measurement.initialJsGzBytes)} / ${report.targets.initialJsGzKiB} KiB`
  )
  lines.push(
    `initial CSS (gzip): ${formatKiB(report.measurement.initialCssGzBytes)} / ${report.targets.initialCssGzKiB} KiB`
  )
  lines.push(
    `total JS (gzip): ${formatKiB(report.measurement.totalJsGzBytes)} / ${report.targets.totalJsGzKiB} KiB`
  )

  if (report.violations.length > 0) {
    lines.push('')
    lines.push('budget violations:')
    for (const violation of report.violations) lines.push(`  - ${violation.message}`)
  }
  if (report.regressions.length > 0) {
    lines.push('')
    lines.push('baseline regressions:')
    for (const regression of report.regressions) lines.push(`  - ${regression.message}`)
  }

  lines.push('')
  lines.push(`verdict (${report.mode} mode): ${report.verdict.toUpperCase()}`)
  return lines.join('\n')
}
