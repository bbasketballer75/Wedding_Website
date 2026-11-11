/**
 * Self-contained HTML parity report.
 *
 * `renderReport({ summary, outDir })` reads the summary plus the captured PNGs
 * and writes `<outDir>/report.html` with every image inlined as base64 WebP, so
 * the report opens offline with no server and no external assets. Full-size
 * PNGs stay next to it under shots/ for deep inspection.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { DEFAULT_OUT_DIR } from './util.mjs'
import { HarnessError, escapeHtml, formatRatio, log, pathExists, readJsonFile } from './util.mjs'

const THUMB_WIDTH = 420
const THUMB_CACHE = new Map()

async function thumbDataUri(outDir, relativeFile) {
  if (!relativeFile) return null
  const absolute = path.join(outDir, relativeFile)
  if (THUMB_CACHE.has(absolute)) return THUMB_CACHE.get(absolute)
  if (!(await pathExists(absolute))) {
    THUMB_CACHE.set(absolute, null)
    return null
  }
  const buffer = await sharp(absolute)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()
  const uri = `data:image/webp;base64,${buffer.toString('base64')}`
  THUMB_CACHE.set(absolute, uri)
  return uri
}

function statusClass(status) {
  if (status === 'pass') return 'ok'
  if (status === 'allowed') return 'allowed'
  if (status === 'fail') return 'bad'
  return 'error'
}

function badge(status) {
  return `<span class="badge ${statusClass(status)}">${escapeHtml(status.toUpperCase())}</span>`
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US')
}

async function renderShot(outDir, shot) {
  const slices = []
  const sliceCount = Math.max(
    shot.files?.legacy?.length ?? 0,
    shot.files?.rebuild?.length ?? 0,
    shot.files?.diff?.length ?? 0
  )
  for (let index = 0; index < sliceCount; index += 1) {
    const [legacyUri, rebuildUri, diffUri] = await Promise.all([
      thumbDataUri(outDir, shot.files?.legacy?.[index]),
      thumbDataUri(outDir, shot.files?.rebuild?.[index]),
      thumbDataUri(outDir, shot.files?.diff?.[index]),
    ])
    const slice = shot.pixelDiff?.slices?.[index]
    const ratioLabel =
      slice && slice.ratio !== null && slice.ratio !== undefined
        ? formatRatio(slice.ratio)
        : (slice?.status ?? 'n/a')
    slices.push(`
      <div class="slice">
        <div class="slice-title">slice ${String(index).padStart(3, '0')} · ${escapeHtml(String(ratioLabel))}${
          slice?.status === 'size-mismatch' || slice?.status === 'slice-missing'
            ? ` · ${escapeHtml(slice.status)}`
            : ''
        }</div>
        <div class="slice-grid">
          <figure><figcaption>legacy</figcaption>${legacyUri ? `<img src="${legacyUri}" alt="legacy ${escapeHtml(shot.key)} slice ${index}">` : '<div class="missing">no image</div>'}</figure>
          <figure><figcaption>rebuild</figcaption>${rebuildUri ? `<img src="${rebuildUri}" alt="rebuild ${escapeHtml(shot.key)} slice ${index}">` : '<div class="missing">no image</div>'}</figure>
          <figure><figcaption>diff</figcaption>${diffUri ? `<img src="${diffUri}" alt="diff ${escapeHtml(shot.key)} slice ${index}">` : '<div class="missing">no image</div>'}</figure>
        </div>
      </div>`)
  }

  const reasons = shot.failureReasons?.length
    ? `<div class="reasons">${shot.failureReasons.map(reason => escapeHtml(reason)).join(' · ')}</div>`
    : ''
  const textDiffBlock =
    shot.textDiff?.status === 'fail'
      ? `<details class="textdiff"><summary>Text/DOM differences (${shot.textDiff.differences?.length ?? 0})</summary>${(
          shot.textDiff.differences ?? []
        )
          .map(
            difference =>
              `<div class="diff-field"><strong>${escapeHtml(difference.field)}</strong><pre>legacy: ${escapeHtml(
                JSON.stringify(difference.legacySummary, null, 2)
              )}\nrebuild: ${escapeHtml(JSON.stringify(difference.rebuildSummary, null, 2))}</pre></div>`
          )
          .join('')}</details>`
      : ''
  const allowlistBlock = shot.allowlist?.accepted
    ? `<div class="allowlist">allowed by allowlist: <em>${escapeHtml(shot.allowlist.entry.reason)}</em> (max ${formatRatio(shot.allowlist.entry.maxDiffPixelRatio)}, expires wave ${shot.allowlist.entry.expiresAtWave})</div>`
    : ''
  const errors = [...(shot.legacy?.consoleErrors ?? []), ...(shot.rebuild?.consoleErrors ?? [])]
  const warnings = shot.warnings ?? []
  const diagnostics =
    errors.length ||
    warnings.length ||
    shot.legacy?.pageErrors?.length ||
    shot.rebuild?.pageErrors?.length
      ? `<details class="diagnostics"><summary>Console errors / warnings</summary><pre>${escapeHtml(
          [
            ...warnings.map(warning => `WARN ${warning}`),
            ...(shot.legacy?.consoleErrors ?? []).map(error => `legacy console: ${error}`),
            ...(shot.rebuild?.consoleErrors ?? []).map(error => `rebuild console: ${error}`),
            ...(shot.legacy?.pageErrors ?? []).map(error => `legacy pageerror: ${error}`),
            ...(shot.rebuild?.pageErrors ?? []).map(error => `rebuild pageerror: ${error}`),
          ].join('\n')
        )}</pre></details>`
      : ''

  return `
    <section class="shot" id="shot-${escapeHtml(shot.key)}">
      <header>
        <h3>${escapeHtml(shot.route)} <span class="muted">/ ${escapeHtml(shot.routePath)}</span></h3>
        <div class="meta">
          ${badge(shot.status)} ${escapeHtml(shot.viewport)} · ${escapeHtml(shot.theme)} theme · parity ${escapeHtml(String(shot.parity))}
          · changed ${formatNumber(shot.pixelDiff?.changedPixels)}/${formatNumber(shot.pixelDiff?.totalPixels)} (${formatRatio(shot.pixelDiff?.ratio ?? 0)})
          · height ${formatNumber(shot.legacy?.pageHeightPx)}px vs ${formatNumber(shot.rebuild?.pageHeightPx)}px
          · ${formatNumber(shot.legacy?.durationMs)}ms + ${formatNumber(shot.rebuild?.durationMs)}ms
        </div>
        ${reasons}${allowlistBlock}${errors.length ? `<div class="reasons">console errors: ${formatNumber(errors.length)}</div>` : ''}
      </header>
      ${slices.join('')}
      ${textDiffBlock}
      ${diagnostics}
    </section>`
}

function renderStyles() {
  return `:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#12100e;color:#f2ece2}
.wrap{max-width:1220px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:26px;margin:0 0 6px}
h2{font-size:18px;margin:34px 0 10px;border-bottom:1px solid #3a322a;padding-bottom:6px}
h3{font-size:16px;margin:0 0 4px}
.muted{color:#a99d8c;font-weight:400}
.summary{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.card{background:#1d1814;border:1px solid #332a23;border-radius:10px;padding:12px 16px;min-width:130px}
.card .value{font-size:22px;font-weight:600}
.card .label{color:#a99d8c;font-size:12px}
.verdict{padding:12px 18px;border-radius:10px;margin:16px 0;font-size:16px;font-weight:600}
.verdict.ok{background:#12301c;border:1px solid #1f6b3a;color:#9be7b4}
.verdict.bad{background:#3a1517;border:1px solid #7c2b2f;color:#ffb3b3}
.verdict.error{background:#3a2a12;border:1px solid #7c5a2b;color:#ffdda3}
table.kv{width:100%;border-collapse:collapse;margin:10px 0 4px}
table.kv td{border-bottom:1px solid #2a241f;padding:6px 8px;vertical-align:top}
table.kv td:first-child{color:#a99d8c;width:280px;white-space:nowrap}
.shot{background:#181411;border:1px solid #2f2822;border-radius:12px;padding:16px 16px 10px;margin:18px 0}
.shot header{margin-bottom:10px}
.badge{display:inline-block;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700;letter-spacing:.04em}
.badge.ok{background:#17341f;color:#8ce0a8}
.badge.allowed{background:#2f2a12;color:#e8d98c}
.badge.bad{background:#3a1517;color:#ff9d9d}
.badge.error{background:#3a2a12;color:#ffce8c}
.meta{color:#a99d8c;font-size:12px;margin-top:2px}
.reasons{color:#ffb3b3;background:#2a1214;border:1px solid #5c2327;border-radius:8px;padding:6px 10px;margin:8px 0;font-size:13px}
.allowlist{color:#e8d98c;background:#2b2712;border:1px solid #5c5323;border-radius:8px;padding:6px 10px;margin:8px 0;font-size:13px}
.slice{margin:14px 0 6px}
.slice-title{color:#a99d8c;font-size:12px;margin-bottom:6px}
.slice-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
figure{margin:0;background:#0f0d0b;border:1px solid #2a241f;border-radius:8px;padding:6px}
figcaption{color:#a99d8c;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
img{display:block;width:100%;height:auto;border-radius:4px}
.missing{color:#6d6257;padding:30px 0;text-align:center;font-size:12px}
.textdiff,.diagnostics{margin:10px 0;border:1px solid #2f2822;border-radius:8px;padding:8px 10px;background:#141110}
summary{cursor:pointer;color:#d8cbb6}
pre{white-space:pre-wrap;word-break:break-word;font-size:12px;color:#cfc3b0;margin:6px 0}
.diff-field{margin:8px 0}
footer{margin-top:40px;color:#8a7f70;font-size:12px;border-top:1px solid #2f2822;padding-top:12px}
@media (max-width:900px){.slice-grid{grid-template-columns:1fr}}`
}

function renderHeader(summary) {
  const verdictClass =
    summary.verdict?.status === 'passed'
      ? 'ok'
      : summary.verdict?.status === 'error'
        ? 'error'
        : 'bad'
  return `<h1>Parity report</h1>
    <div class="muted">${escapeHtml(summary.kind ?? 'parity-compare')} · generated ${escapeHtml(summary.generatedAt ?? '')} · ${formatNumber(summary.durationMs)}ms</div>
    <div class="verdict ${verdictClass}">${escapeHtml((summary.verdict?.status ?? 'unknown').toUpperCase())} — exit code ${escapeHtml(String(summary.verdict?.exitCode ?? '?'))}${
      summary.verdict?.reasons?.length ? ` — ${escapeHtml(summary.verdict.reasons.join('; '))}` : ''
    }</div>
    <div class="summary">
      <div class="card"><div class="value">${formatNumber(summary.totals?.shots)}</div><div class="label">shots</div></div>
      <div class="card"><div class="value">${formatNumber(summary.totals?.passed)}</div><div class="label">pass</div></div>
      <div class="card"><div class="value">${formatNumber(summary.totals?.allowed)}</div><div class="label">allowed</div></div>
      <div class="card"><div class="value">${formatNumber(summary.totals?.failed)}</div><div class="label">fail</div></div>
      <div class="card"><div class="value">${formatNumber(summary.totals?.errors)}</div><div class="label">error</div></div>
      <div class="card"><div class="value">${formatNumber(summary.totals?.textDiffs)}</div><div class="label">text diffs</div></div>
      <div class="card"><div class="value">${formatRatio(summary.totals?.changedPixelRatio ?? 0)}</div><div class="label">changed pixels</div></div>
    </div>
    <h2>Run</h2>
    <table class="kv">
      <tr><td>legacy URL</td><td>${escapeHtml(summary.oracle?.legacyUrl ?? '')}</td></tr>
      <tr><td>rebuild URL</td><td>${escapeHtml(summary.oracle?.rebuildUrl ?? '')}</td></tr>
      <tr><td>same instance</td><td>${summary.oracle?.sameInstance ? 'yes (self-check)' : 'no'}</td></tr>
      <tr><td>fixed clock</td><td>${escapeHtml(summary.determinism?.clock?.fixedNow ?? '')} — ${escapeHtml(summary.determinism?.clock?.strategy ?? '')}</td></tr>
      <tr><td>timezone / locale</td><td>${escapeHtml(summary.determinism?.timezoneId ?? '')} / ${escapeHtml(summary.determinism?.locale ?? '')}</td></tr>
      <tr><td>tolerance</td><td>max diff ratio ${escapeHtml(String(summary.tolerance?.maxDiffRatio ?? ''))} · pixel threshold ${escapeHtml(String(summary.tolerance?.pixelThreshold ?? ''))} · edge tolerance ${escapeHtml(String(summary.tolerance?.edgeTolerance ?? 0))} (${escapeHtml(summary.tolerance?.edgeToleranceSemantics ?? 'exact per-pixel comparison (default)')})</td></tr>
      <tr><td>allowlist</td><td>${escapeHtml(summary.allowlist?.file ?? '')} — ${formatNumber(summary.allowlist?.entries)} entries at wave ${formatNumber(summary.allowlist?.wave)}</td></tr>
      <tr><td>fixtures</td><td>${escapeHtml(summary.determinism?.fixtures?.source ?? '')}</td></tr>
      <tr><td>toolchain</td><td>node ${escapeHtml(summary.toolchain?.node ?? '')} · playwright ${escapeHtml(
        summary.toolchain?.playwright ?? ''
      )} · chromium ${escapeHtml(summary.toolchain?.chromium ?? '')} · sharp ${escapeHtml(summary.toolchain?.sharp ?? '')}</td></tr>
      <tr><td>routes / viewports / themes</td><td>${formatNumber(summary.selection?.routes?.length)} routes · ${escapeHtml(
        (summary.selection?.viewports ?? []).map(viewport => viewport.name).join(', ')
      )} · ${escapeHtml((summary.selection?.themes ?? []).join(', '))}</td></tr>
      <tr><td>masks</td><td>${escapeHtml(
        Object.entries(summary.determinism?.masks ?? {})
          .map(([route, selectors]) => `${route}: ${selectors.join(', ')}`)
          .join(' · ') || 'none'
      )}</td></tr>
    </table>
    <h2>Shots</h2>`
}

export async function renderReport({ summary, outDir }) {
  THUMB_CACHE.clear()
  const sections = []
  for (const shot of summary.shots ?? []) sections.push(await renderShot(outDir, shot))
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parity report · ${escapeHtml(summary.generatedAt ?? '')}</title>
<style>${renderStyles()}</style>
</head>
<body>
<div class="wrap">
${renderHeader(summary)}
${sections.join('\n')}
<footer>
  Self-contained report: every image is inlined. Full-size PNGs live in <code>shots/</code> next to this file.
  Regenerate with <code>node tools/parity/report.mjs --out ${escapeHtml(outDir)}</code>.
</footer>
</div>
</body>
</html>
`
  const reportPath = path.join(outDir, 'report.html')
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(reportPath, html, 'utf8')
  return reportPath
}

function parseReportArgs(argv) {
  const options = { outDir: DEFAULT_OUT_DIR }
  const args = [...argv]
  while (args.length > 0) {
    const arg = args.shift()
    if (arg === '--out') {
      const value = args.shift()
      if (!value) throw new HarnessError('--out needs a directory')
      options.outDir = path.resolve(value)
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new HarnessError(`unknown argument "${arg}"`)
    }
  }
  return options
}

export async function main(argv) {
  try {
    const options = parseReportArgs(argv)
    if (options.help) {
      process.stdout.write('Usage: node tools/parity/report.mjs [--out <dir>]\n')
      return 0
    }
    const summaryPath = path.join(options.outDir, 'summary.json')
    const summary = await readJsonFile(summaryPath)
    const reportPath = await renderReport({ summary, outDir: options.outDir })
    log.out(`Wrote ${reportPath}`)
    return 0
  } catch (error) {
    log.error(error.message)
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
