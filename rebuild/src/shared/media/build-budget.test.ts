import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BUDGET_TARGETS,
  KIB,
  aggregateByRoute,
  buildBudgetReport,
  classifyChunks,
  findRegressions,
  findViolations,
  formatKiB,
  formatReportTable,
  measureBudgets,
  parseBudgetBaseline,
  parseIndexHtmlReferences,
  reportToBaseline,
  routeLabelFromFileName,
  type AssetMeasurement,
  type BudgetBaseline,
  type ChunkMeasurement,
} from './build-budget'

const HTML = `<!doctype html>
<html><head>
<script type="module" crossorigin src="/assets/index-AAAA1111.js"></script>
<link rel="modulepreload" crossorigin href="/assets/createLucideIcon-BBBB2222.js">
<link rel="modulepreload" crossorigin href="/assets/cn-CCCC3333.js">
<link rel="stylesheet" crossorigin href="/assets/index-DDDD4444.css">
</head><body><div id="root"></div></body></html>`

function asset(file: string, gzipBytes: number, rawBytes = gzipBytes * 4): AssetMeasurement {
  return { file, rawBytes, gzipBytes, brotliBytes: Math.round(gzipBytes * 0.85) }
}

const jsAssets: AssetMeasurement[] = [
  asset('index-AAAA1111.js', 228 * KIB),
  asset('createLucideIcon-BBBB2222.js', 63 * KIB),
  asset('cn-CCCC3333.js', 8 * KIB),
  asset('home-EEEE5555.js', 19 * KIB),
  asset('film-FFFF6666.js', 19 * KIB),
  asset('GalleryPage-GGGG7777.js', 9 * KIB),
  asset('index-DDDD4444.css', 27 * KIB),
]

const refs = {
  entryScripts: ['index-AAAA1111.js'],
  modulePreloads: ['createLucideIcon-BBBB2222.js', 'cn-CCCC3333.js'],
  stylesheets: ['index-DDDD4444.css'],
}

function chunk(overrides: Partial<ChunkMeasurement>): ChunkMeasurement {
  return {
    file: 'home-EEEE5555.js',
    kind: 'lazy',
    route: '/',
    rawBytes: 1000,
    gzipBytes: 1000,
    ...overrides,
  }
}

function baseline(overrides: Partial<BudgetBaseline> = {}): BudgetBaseline {
  return {
    schemaVersion: 1,
    documentedAt: '2026-11-09',
    source: 'test',
    compression: 'gzip level 9',
    targets: DEFAULT_BUDGET_TARGETS,
    measured: {
      initialJsGzBytes: 299 * KIB,
      initialCssGzBytes: 27 * KIB,
      totalJsGzBytes: 346 * KIB,
      byRoute: { '/': 19 * KIB, '/film': 19 * KIB, '/gallery': 9 * KIB },
    },
    chunks: [],
    ...overrides,
  }
}

describe('index.html initial references', () => {
  it('extracts the entry script, modulepreloads and stylesheets', () => {
    expect(parseIndexHtmlReferences(HTML)).toEqual(refs)
  })

  it('ignores non-module scripts and unrelated links', () => {
    const html = `<script src="/assets/analytics.js"></script>
      <link rel="preload" href="/assets/font.woff2">
      <script type="module" src="/assets/main.mjs"></script>`
    const parsed = parseIndexHtmlReferences(html)
    expect(parsed.entryScripts).toEqual(['main.mjs'])
    expect(parsed.modulePreloads).toEqual([])
    expect(parsed.stylesheets).toEqual([])
  })
})

describe('chunk classification and measurement', () => {
  it('labels entry/preload chunks as initial and lazy chunks by route', () => {
    const chunks = classifyChunks(jsAssets, refs)
    expect(chunks.find(item => item.file === 'index-AAAA1111.js')?.kind).toBe('entry')
    expect(chunks.find(item => item.file === 'cn-CCCC3333.js')?.kind).toBe('preload')
    expect(chunks.find(item => item.file === 'home-EEEE5555.js')).toMatchObject({
      kind: 'lazy',
      route: '/',
    })
    expect(chunks.find(item => item.file === 'GalleryPage-GGGG7777.js')?.route).toBe('/gallery')
  })

  it('maps chunk file names to route labels', () => {
    expect(routeLabelFromFileName('home-BIBVthCh.js')).toBe('/')
    expect(routeLabelFromFileName('film-D8kCPLdQ.js')).toBe('/film')
    expect(routeLabelFromFileName('GalleryPage-u1q4qI2p.js')).toBe('/gallery')
    expect(routeLabelFromFileName('PrintPage-CIRcxR4C.js')).toBe('/print')
    expect(routeLabelFromFileName('guest-share-DK4PnXTA.js')).toBe('/guest/:token')
    expect(routeLabelFromFileName('createLucideIcon-VjqcKefL.js')).toBe('shared')
    expect(routeLabelFromFileName('hooks-CLmGc-J7.js')).toBe('shared')
  })

  it('sums initial JS, initial CSS and total JS', () => {
    const chunks = classifyChunks(jsAssets, refs)
    const measurement = measureBudgets(
      chunks,
      jsAssets.filter(item => item.file.endsWith('.css')),
      refs
    )
    expect(measurement.initialJsGzBytes).toBe((228 + 63 + 8) * KIB)
    expect(measurement.initialCssGzBytes).toBe(27 * KIB)
    expect(measurement.totalJsGzBytes).toBe((228 + 63 + 8 + 19 + 19 + 9) * KIB)
  })

  it('aggregates lazy chunk bytes per route, sorted', () => {
    expect(aggregateByRoute(classifyChunks(jsAssets, refs))).toEqual({
      '/': 19 * KIB,
      '/film': 19 * KIB,
      '/gallery': 9 * KIB,
    })
  })
})

describe('budget verdicts', () => {
  it('formats KiB values', () => {
    expect(formatKiB(0)).toBe('0.0 KiB')
    expect(formatKiB(1536)).toBe('1.5 KiB')
  })

  it('flags initial/total/route budget violations', () => {
    const chunks = classifyChunks(jsAssets, refs)
    const measurement = measureBudgets(
      chunks,
      jsAssets.filter(item => item.file.endsWith('.css')),
      refs
    )
    const violations = findViolations(measurement, DEFAULT_BUDGET_TARGETS)
    const metrics = violations.map(violation => violation.metric)
    expect(metrics).toContain('initial JS (gzip)')
    expect(metrics).not.toContain('total JS (gzip)')
    expect(metrics).not.toContain('initial CSS (gzip)')
    expect(violations[0]?.message).toContain('exceeds 180 KiB')
  })

  it('flags a route chunk over 120 KiB and passes small ones', () => {
    const under = measureBudgets(
      [chunk({ file: 'home-EEEE5555.js', gzipBytes: 19 * KIB })],
      [],
      refs
    )
    expect(findViolations(under, DEFAULT_BUDGET_TARGETS)).toEqual([])

    const over = measureBudgets(
      [chunk({ file: 'film-FFFF6666.js', route: '/film', gzipBytes: 130 * KIB })],
      [],
      refs
    )
    const violations = findViolations(over, DEFAULT_BUDGET_TARGETS)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.metric).toBe('/film route chunk (gzip)')
  })

  it('detects regressions above the 2 KiB tolerance only', () => {
    const current = measureBudgets([chunk({ gzipBytes: 300 * KIB, kind: 'entry' })], [], refs)
    expect(findRegressions(current, baseline())).toEqual([])

    const grown = measureBudgets([chunk({ gzipBytes: 302.1 * KIB, kind: 'entry' })], [], refs)
    const regressions = findRegressions(grown, baseline())
    expect(regressions).toHaveLength(1)
    expect(regressions[0]?.message).toMatch(/initial JS \(gzip\) grew/)

    const routeGrown = measureBudgets([chunk({ gzipBytes: 24 * KIB, route: '/' })], [], refs)
    expect(findRegressions(routeGrown, baseline()).map(item => item.metric)).toContain(
      '/ route chunk (gzip)'
    )
  })
})

describe('baseline file', () => {
  it('round-trips a report into a validated baseline', () => {
    const report = buildBudgetReport({
      mode: 'strict',
      dist: 'dist',
      refs,
      jsAssets,
      cssAssets: jsAssets.filter(item => item.file.endsWith('.css')),
      targets: DEFAULT_BUDGET_TARGETS,
    })
    const written = reportToBaseline(report, {
      documentedAt: '2026-11-09',
      source: 'test build',
      compression: 'gzip level 9',
      notes: ['parity build'],
    })
    const parsed = parseBudgetBaseline(JSON.parse(JSON.stringify(written)))
    expect(parsed.measured.initialJsGzBytes).toBe(report.measurement.initialJsGzBytes)
    expect(parsed.measured.byRoute).toEqual(aggregateByRoute(report.measurement.chunks))
    expect(parsed.chunks.length).toBeGreaterThan(0)
    expect(parsed.notes).toEqual(['parity build'])
  })

  it('rejects malformed baselines', () => {
    expect(() => parseBudgetBaseline(null)).toThrow(/root/)
    expect(() => parseBudgetBaseline({ ...baseline(), schemaVersion: 9 })).toThrow(/schemaVersion/)
    expect(() =>
      parseBudgetBaseline({
        ...baseline(),
        targets: { ...DEFAULT_BUDGET_TARGETS, initialJsGzKiB: 'x' },
      })
    ).toThrow(/initialJsGzKiB/)
    expect(() =>
      parseBudgetBaseline({ ...baseline(), measured: { ...baseline().measured, byRoute: [] } })
    ).toThrow(/byRoute/)
    expect(() => parseBudgetBaseline({ ...baseline(), chunks: [{ file: 'x.js' }] })).toThrow(
      /invalid/
    )
  })
})

describe('report', () => {
  it('builds a strict-mode report that fails on target violations', () => {
    const report = buildBudgetReport({
      mode: 'strict',
      dist: 'dist',
      refs,
      jsAssets,
      cssAssets: jsAssets.filter(item => item.file.endsWith('.css')),
      targets: DEFAULT_BUDGET_TARGETS,
    })

    expect(report.verdict).toBe('fail')
    expect(report.routeRows.every(row => row.pass)).toBe(true)
    const table = formatReportTable(report)
    expect(table).toContain('initial JS (gzip)')
    expect(table).toContain('verdict (strict mode): FAIL')
  })

  it('baseline mode ignores fixed targets and gates regressions only', () => {
    const report = buildBudgetReport({
      mode: 'baseline',
      dist: 'dist',
      refs,
      jsAssets,
      cssAssets: jsAssets.filter(item => item.file.endsWith('.css')),
      targets: DEFAULT_BUDGET_TARGETS,
      baseline: baseline({
        measured: {
          initialJsGzBytes: 240 * KIB,
          initialCssGzBytes: 20 * KIB,
          totalJsGzBytes: 320 * KIB,
          byRoute: {},
        },
      }),
    })

    expect(report.violations).toEqual([])
    expect(report.verdict).toBe('fail')
    expect(report.regressions.map(item => item.metric)).toContain('initial JS (gzip)')
  })

  it('serialises as JSON with the documented kind', () => {
    const report = buildBudgetReport({
      mode: 'baseline',
      dist: 'dist',
      refs,
      jsAssets,
      cssAssets: [],
      targets: DEFAULT_BUDGET_TARGETS,
      baseline: baseline(),
    })
    const parsed = JSON.parse(JSON.stringify(report)) as { kind: string }
    expect(parsed.kind).toBe('bundle-budget-report')
    expect(report.verdict).toBe('pass')
  })
})
