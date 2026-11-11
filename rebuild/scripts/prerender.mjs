#!/usr/bin/env node
/**
 * Deterministic post-build prerender for the greenfield rebuild.
 *
 * Reads the canonical route-metadata table (`src/app/seo/routeMeta.json`) and
 * rewrites the `<!-- seo:start --> ... <!-- seo:end -->` block of the Vite-built
 * `dist/index.html` for every public route, writing one static HTML file per
 * route:
 *
 *   dist/index.html            /            (home)
 *   dist/film/index.html       /film
 *   dist/gallery/index.html    /gallery
 *   dist/guestbook/index.html  /guestbook
 *   dist/upload/index.html     /upload
 *   dist/guest-photos/index.html
 *   dist/print/index.html      /print        (noindex)
 *   dist/activity/index.html   /activity     (Wave 8 stale-metadata fix)
 *   dist/people/index.html     /people       (noindex 404, retired route)
 *   dist/guest/index.html      /guest/*      (noindex shell for /guest/:token)
 *   dist/admin/index.html      /admin/*      (noindex shell; /admin/login has its own file)
 *   dist/admin/login/index.html
 *
 * Only the metadata block changes: the rest of the Vite HTML (asset hashes,
 * module entry, body) is byte-identical, so the SPA boot/hydration is unchanged.
 *
 * `--check` writes nothing; it fails if any generated file is missing or its
 * metadata block differs from the route table (the drift gate).
 *
 * Usage:
 *   node scripts/prerender.mjs [--check] [--dist DIR] [--site-url URL] [--table]
 *
 * Exit codes: 0 ok; 1 drift; 2 setup error (e.g. no build available).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import console from 'node:console'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const REBUILD_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ROUTE_META_PATH = path.join(REBUILD_ROOT, 'src/app/seo/routeMeta.json')
const DEFAULT_SITE_URL = 'https://www.theporadas.com'
const MARKERS = { start: '<!-- seo:start -->', end: '<!-- seo:end -->' }
const SHELL_MARKERS = { start: '<!-- boot-shell:start -->', end: '<!-- boot-shell:end -->' }
const ROOT_OPEN = '<div id="root">'
const ROOT_CLOSE = '</div>'
/**
 * Public routes that ship a pre-JS boot shell (LCP). The shell paints the
 * hero-critical copy from inline CSS, then `createRoot` replaces it on mount, so
 * it never reaches the post-hydration parity capture. Private/404 shells are
 * intentionally excluded.
 */
const BOOT_SHELL_ROUTE_IDS = new Set([
  'home',
  'film',
  'gallery',
  'guestbook',
  'upload',
  'print',
  'guest-photos',
  'activity',
])
const INDENT = '    '

function parseArgs(argv) {
  const options = { check: false, dist: 'dist', siteUrl: undefined, table: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') options.check = true
    else if (arg === '--dist') options.dist = argv[(index += 1)]
    else if (arg === '--site-url') options.siteUrl = argv[(index += 1)]
    else if (arg === '--table') options.table = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function normalizeSiteUrl(value) {
  return String(value).replace(/\/+$/, '')
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveUrl(value, siteUrl) {
  if (/^https?:\/\//.test(value)) return value
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`
}

/** Static URL for routes that cannot carry their build-time path (`/admin/*`). */
function staticPathFor(routePath) {
  if (routePath.endsWith('/*')) return routePath.slice(0, -1)
  if (routePath.includes(':')) return routePath.slice(0, routePath.indexOf(':'))
  return routePath
}

function substituteSiteUrl(value, siteUrl) {
  if (typeof value === 'string') return value.replaceAll('{{SITE_URL}}', siteUrl)
  if (Array.isArray(value)) return value.map(item => substituteSiteUrl(item, siteUrl))
  if (value && typeof value === 'object') {
    const result = {}
    for (const [key, nested] of Object.entries(value)) {
      result[key] = substituteSiteUrl(nested, siteUrl)
    }
    return result
  }
  return value
}

function escapeJsonLd(json) {
  // Prevent a JSON-LD string ending a script element; U+2028/2029 are invalid in
  // inline JSON on older parsers.
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * The exact head block the frozen app's static index.html contains, with the
 * runtime-mutable tags (title/description/OG/Twitter/canonical/robots) filled
 * per route. Everything else is copied byte-for-byte so the parity-visible head
 * contract is preserved; the frozen PWA/install tags stay static here and are
 * never added by the prerender.
 */
export function buildSeoBlock(route, siteUrl) {
  const title = escapeXml(route.title)
  const description = escapeXml(route.description)
  const canonical = route.canonicalPath ? resolveUrl(route.canonicalPath, siteUrl) : null
  const ogUrl = canonical ?? resolveUrl(staticPathFor(route.path), siteUrl)
  const ogImage = resolveUrl(route.ogImage, siteUrl)
  const lines = [
    `${INDENT}<!-- Primary Meta Tags -->`,
    `${INDENT}<title>${title}</title>`,
    `${INDENT}<meta name="title" content="Austin &amp; Jordyn | Wedding Archive" />`,
    `${INDENT}<meta name="description" content="${description}" />`,
    `${INDENT}<meta name="keywords" content="wedding, archive, austin, jordyn, marriage, collection" />`,
    `${INDENT}<meta name="author" content="Austin &amp; Jordyn" />`,
    '',
    `${INDENT}<!-- Open Graph / Facebook -->`,
    `${INDENT}<meta property="og:type" content="${route.ogType ?? 'website'}" />`,
    `${INDENT}<meta property="og:url" content="${ogUrl}" />`,
    `${INDENT}<meta property="og:title" content="${title}" />`,
    `${INDENT}<meta property="og:description" content="${description}" />`,
    `${INDENT}<meta property="og:image" content="${ogImage}" />`,
    '',
    `${INDENT}<!-- Twitter -->`,
    `${INDENT}<meta property="twitter:card" content="summary_large_image" />`,
    `${INDENT}<meta property="twitter:url" content="${ogUrl}" />`,
    `${INDENT}<meta property="twitter:title" content="${title}" />`,
    `${INDENT}<meta property="twitter:description" content="${description}" />`,
    `${INDENT}<meta property="twitter:image" content="${ogImage}" />`,
  ]
  if (canonical) lines.push(`${INDENT}<link rel="canonical" href="${canonical}" />`)
  lines.push(
    `${INDENT}<!-- Canonical URL is updated per-page at runtime by the route metadata hook. -->`,
    '',
    `${INDENT}<!-- Additional Meta Tags -->`,
    `${INDENT}<meta name="robots" content="${route.robots}" />`,
    `${INDENT}<meta name="language" content="English" />`,
    `${INDENT}<meta name="theme-color" content="#d4af37" />`,
    '',
    `${INDENT}<!-- PWA Meta Tags -->`,
    `${INDENT}<meta name="mobile-web-app-capable" content="yes" />`,
    `${INDENT}<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
    `${INDENT}<meta name="apple-mobile-web-app-title" content="A&amp;J Wedding" />`,
    `${INDENT}<meta name="application-name" content="A&amp;J Wedding" />`,
    `${INDENT}<meta name="msapplication-TileColor" content="#d4af37" />`,
    `${INDENT}<meta name="msapplication-config" content="/browserconfig.xml" />`
  )
  if (route.structuredData) {
    const json = JSON.stringify(substituteSiteUrl(route.structuredData, siteUrl))
    lines.push(
      `${INDENT}<script type="application/ld+json" data-seo-structured-data="true">${escapeJsonLd(json)}</script>`
    )
  }
  return lines.join('\n')
}

/**
 * Pre-JS boot shell (LCP + FCP): the hero-critical copy + inline critical CSS
 * painted straight from the static HTML. It is `aria-hidden`, contains no
 * network requests (system/Georgia font stack, no images, no scripts), and is
 * removed by React's first `createRoot().render()` — post-hydration DOM is
 * untouched, so it is invisible to parity capture.
 */
export function buildBootShell(route) {
  const heading = escapeXml(route.shellHeading ?? route.title.split(' | ')[0])
  const subtitle = escapeXml(route.description)
  const styles = [
    '#root [data-boot-shell]{box-sizing:border-box;min-height:min(44svh,400px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1rem;padding:2.5rem 1.5rem;margin:0;background:radial-gradient(120% 90% at 50% 0%,#1d160c 0%,#08080a 62%);color:#f4ebd8;text-align:center;font-family:Georgia,Cambria,"Times New Roman",serif}',
    '#root [data-boot-shell] p{margin:0}',
    '#root [data-boot-shell-eyebrow]{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:.6875rem;letter-spacing:.34em;text-transform:uppercase;color:#d4af37}',
    '#root [data-boot-shell-heading]{margin:0;font-weight:400;font-size:clamp(2.25rem,7vw,4.5rem);line-height:1.05;letter-spacing:-.01em}',
    '#root [data-boot-shell-rule]{width:4rem;height:1px;background:#c69c4e;opacity:.7}',
    '#root [data-boot-shell-subtitle]{max-width:34rem;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:clamp(.95rem,1.6vw,1.125rem);line-height:1.6;color:rgba(244,235,216,.62)}',
  ]
  const lines = [
    SHELL_MARKERS.start,
    '      <style data-boot-shell>',
    ...styles.map(style => `        ${style}`),
    '      </style>',
    '      <div data-boot-shell="" aria-hidden="true">',
    '        <p data-boot-shell-eyebrow>A &amp; J · WEDDING ARCHIVE</p>',
    `        <h1 data-boot-shell-heading>${heading}</h1>`,
    '        <span data-boot-shell-rule></span>',
    `        <p data-boot-shell-subtitle>${subtitle}</p>`,
    '      </div>',
    `      ${SHELL_MARKERS.end}`,
  ]
  return lines.join('\n')
}

function bootShellInner(route) {
  if (!BOOT_SHELL_ROUTE_IDS.has(route.id)) return ''
  return `\n${buildBootShell(route)}\n    `
}

function splitTemplate(template, fileLabel) {
  const startCount = template.split(MARKERS.start).length - 1
  const endCount = template.split(MARKERS.end).length - 1
  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `${fileLabel} must contain exactly one "${MARKERS.start}" / "${MARKERS.end}" pair (found ${startCount}/${endCount})`
    )
  }
  return template
}

export function findRootRegion(html) {
  const openIndex = html.indexOf(ROOT_OPEN)
  if (openIndex === -1) throw new Error(`index.html is missing ${ROOT_OPEN}`)
  const innerStart = openIndex + ROOT_OPEN.length
  const shellEnd = html.indexOf(SHELL_MARKERS.end, innerStart)
  const innerEnd =
    shellEnd === -1 ? html.indexOf(ROOT_CLOSE, innerStart) : html.indexOf(ROOT_CLOSE, shellEnd)
  if (innerEnd === -1) throw new Error('index.html #root is not closed')
  return { innerStart, innerEnd, inner: html.slice(innerStart, innerEnd) }
}

function applyBootShell(html, route) {
  const region = findRootRegion(html)
  const hasShellMarkers = region.inner.includes(SHELL_MARKERS.start)
  if (region.inner.trim() !== '' && !hasShellMarkers) {
    throw new Error(
      'index.html #root already has content that was not produced by prerender — refusing to overwrite it'
    )
  }
  return `${html.slice(0, region.innerStart)}${bootShellInner(route)}${html.slice(region.innerEnd)}`
}

function applyHeadBlock(template, route, siteUrl) {
  splitTemplate(template, 'index.html')
  const start = template.indexOf(MARKERS.start)
  const end = template.indexOf(MARKERS.end)
  const before = template.slice(0, start + MARKERS.start.length)
  const after = template.slice(end)
  return `${before}\n${buildSeoBlock(route, siteUrl)}\n${INDENT}${after}`
}

/** Full prerendered document for one route: per-route head + optional boot shell. */
export function prerenderDocument(template, route, siteUrl) {
  return applyBootShell(applyHeadBlock(template, route, siteUrl), route)
}

/** Routes that produce a static HTML file, in deterministic contract order. */
export function prerenderRoutes(meta) {
  return meta.routes.map(route => ({
    id: route.id,
    path: route.path,
    outputPath: route.outputPath,
    title: route.title,
    robots: route.robots,
    canonicalPath: route.canonicalPath,
    hasBootShell: BOOT_SHELL_ROUTE_IDS.has(route.id),
  }))
}

function outputFilePath(distDir, route) {
  return path.join(distDir, ...route.outputPath.split('/'))
}

function firstDiffLine(actual, expected) {
  const actualLines = actual.split('\n')
  const expectedLines = expected.split('\n')
  const index = expectedLines.findIndex((line, lineIndex) => line !== actualLines[lineIndex])
  return {
    index,
    actual: index === -1 ? undefined : actualLines[index],
    expected: index === -1 ? undefined : expectedLines[index],
  }
}

function runCheck(meta, siteUrl, distDir) {
  const homePath = path.join(distDir, 'index.html')
  if (!existsSync(homePath)) {
    console.error(`check failed: ${path.relative(REBUILD_ROOT, homePath)} is missing`)
    return 1
  }
  const homeHtml = readFileSync(homePath, 'utf8')
  try {
    splitTemplate(homeHtml, 'dist/index.html')
    findRootRegion(homeHtml)
  } catch (error) {
    console.error(`check failed: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }

  const drift = []
  for (const route of meta.routes) {
    const filePath = outputFilePath(distDir, route)
    const relative = path.relative(distDir, filePath).split(path.sep).join('/')
    if (!existsSync(filePath)) {
      drift.push(`${relative} is missing`)
      continue
    }
    const actual = readFileSync(filePath, 'utf8')
    // The home document is the build's reference copy: every other route file is
    // that document with only the per-route head block and boot shell swapped.
    const expected = prerenderDocument(homeHtml, route, siteUrl)
    if (actual !== expected) {
      const diff = firstDiffLine(actual, expected)
      drift.push(
        `${relative} differs at line ${diff.index + 1}: expected ${JSON.stringify(diff.expected)} (found ${JSON.stringify(diff.actual)})`
      )
    }
  }
  if (drift.length > 0) {
    console.error('Prerendered HTML is stale:')
    for (const item of drift) console.error(`  - ${item}`)
    console.error(
      'Run `node scripts/prerender.mjs` after the build and commit/redeploy the output.'
    )
    return 1
  }
  console.log(
    `check ok: ${meta.routes.length} prerendered route files match the route table (${siteUrl}); ${meta.routes.filter(route => BOOT_SHELL_ROUTE_IDS.has(route.id)).length} carry the boot shell`
  )
  return 0
}

function main(argv) {
  const options = parseArgs(argv)
  if (options.help) {
    console.log(
      'Usage: node scripts/prerender.mjs [--check] [--dist DIR] [--site-url URL] [--table]'
    )
    return 0
  }

  const meta = readJson(ROUTE_META_PATH)
  const siteUrl = normalizeSiteUrl(options.siteUrl ?? meta.siteUrl ?? DEFAULT_SITE_URL)
  const distDir = path.resolve(REBUILD_ROOT, options.dist)
  const templatePath = path.join(distDir, 'index.html')

  if (options.table) {
    for (const route of prerenderRoutes(meta)) {
      console.log(
        `${route.path.padEnd(16)} -> ${route.outputPath.padEnd(24)} ${route.hasBootShell ? 'shell   ' : 'no-shell'} ${route.robots} :: ${route.title}`
      )
    }
  }

  if (!existsSync(templatePath)) {
    console.error(
      `Cannot prerender: ${path.relative(REBUILD_ROOT, templatePath)} not found.\n` +
        'Run `vite build` first (the Lead owns rebuild builds) or pass --dist <build-dir>.'
    )
    return 2
  }

  const template = readFileSync(templatePath, 'utf8')
  splitTemplate(template, templatePath)

  if (options.check) return runCheck(meta, siteUrl, distDir)

  for (const route of meta.routes) {
    const filePath = outputFilePath(distDir, route)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, prerenderDocument(template, route, siteUrl), 'utf8')
  }
  const shellCount = prerenderRoutes(meta).filter(route => route.hasBootShell).length
  console.log(
    `prerendered ${meta.routes.length} route files (${shellCount} with boot shell) into ${path.relative(REBUILD_ROOT, distDir)}/ using ${siteUrl}`
  )
  if (options.table) console.log('route table printed above')
  return 0
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`prerender failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 2
  }
}
