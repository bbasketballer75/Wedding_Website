import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Byte-level contract tests for the committed generated artifacts and the
 * deploy surface. The generators (`--check`) enforce the same invariants; these
 * tests additionally pin them to `contracts/seo-pwa.json` so a manual edit or a
 * contract update that skips the generator fails CI.
 */
const REBUILD_ROOT = resolve(process.cwd())
const REPO_ROOT = resolve(REBUILD_ROOT, '..')
const PUBLIC = resolve(REBUILD_ROOT, 'public')
const DIST = resolve(REBUILD_ROOT, 'dist')

function read(...segments: string[]): string {
  return readFileSync(resolve(REBUILD_ROOT, ...segments), 'utf8')
}

function readJson<T>(root: string, ...segments: string[]): T {
  return JSON.parse(readFileSync(resolve(root, ...segments), 'utf8')) as T
}

interface Manifest {
  name: string
  short_name: string
  start_url: string
  theme_color: string
  background_color: string
  icons: Array<{ src: string; sizes: string; purpose: string }>
  shortcuts: Array<{ url: string }>
}

interface SeoContract {
  siteUrl: string
  sitemap: Array<{ path: string; changefreq: string; priority: number }>
  manifest: Record<string, unknown>
  headers: Array<{ pattern: string; headers: Record<string, string> }>
}

const meta = readJson<{
  siteUrl: string
  sitemap: Array<{ path: string; changefreq: string; priority: number }>
  manifest: Manifest
  robots: { disallow: string[] }
  serviceWorker: { version: string; precache: string[]; excludedPathPrefixes: string[] }
}>(REBUILD_ROOT, 'src', 'app', 'seo', 'routeMeta.json')
const contract = readJson<SeoContract>(REPO_ROOT, 'contracts', 'seo-pwa.json')

const indexHtml = read('index.html')

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  return source.slice(startIndex + start.length, endIndex)
}

describe('index.html — frozen parity head + prerender markers', () => {
  it('root-relative link tags match the frozen head', () => {
    for (const href of [
      '/favicon-custom.svg',
      '/apple-touch-icon.png',
      '/favicon-32x32.png',
      '/favicon-16x16.png',
    ]) {
      expect(indexHtml).toContain(`href="${href}"`)
      expect(existsSync(resolve(PUBLIC, href.slice(1)))).toBe(true)
    }
    // The unresolved env placeholder hint was dropped; the frozen app resolved it
    // at build time and it is not parity-visible.
    expect(indexHtml).not.toContain('%VITE_SUPABASE_URL%')
  })

  it('keeps the frozen meta-tag vocabulary (property twitter, msapplication, PWA tags)', () => {
    expect(indexHtml).toContain('<meta property="twitter:card" content="summary_large_image" />')
    expect(indexHtml).toContain('<meta property="twitter:title"')
    expect(indexHtml).toContain('<meta name="msapplication-config" content="/browserconfig.xml" />')
    expect(indexHtml).toContain('<meta name="mobile-web-app-capable" content="yes" />')
    expect(indexHtml).toContain('<meta name="application-name" content="A&amp;J Wedding" />')
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    // Twitter tags must not be name= (the frozen head uses property=).
    expect(indexHtml).not.toMatch(/<meta name="twitter:/)
    // These are NOT in the frozen head and stay runtime-gated behind VITE_ENABLE_PWA.
    expect(indexHtml).not.toContain('apple-mobile-web-app-capable')
    expect(indexHtml).not.toContain('data-ga-id')
  })

  it('has exactly one seo marker pair wrapping the runtime-mutable metadata', () => {
    expect(indexHtml.match(/<!-- seo:start -->/g)).toHaveLength(1)
    expect(indexHtml.match(/<!-- seo:end -->/g)).toHaveLength(1)
    const block = between(indexHtml, '<!-- seo:start -->', '<!-- seo:end -->')
    expect(block).toContain('<title>Austin &amp; Jordyn | Wedding Archive</title>')
    expect(block).toContain('<meta name="robots" content="index, follow" />')
    expect(block).toContain('<link rel="canonical" href="https://www.theporadas.com/" />')
    expect(block).toContain('<!-- PWA Meta Tags -->')
    // Marker order: start before end.
    expect(indexHtml.indexOf('<!-- seo:start -->')).toBeLessThan(
      indexHtml.indexOf('<!-- seo:end -->')
    )
  })

  it('keeps the Vite entry and root mounted (shell is prerender-only, never the source)', () => {
    expect(indexHtml).toContain('<div id="root"></div>')
    expect(indexHtml).toContain('src="/src/main.tsx"')
    expect(indexHtml).not.toContain('boot-shell')
  })
})

describe('robots.txt', () => {
  const robots = read('public', 'robots.txt')

  it('serves allow-all except the private, guest-token and noindex print routes', () => {
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    for (const disallow of meta.robots.disallow) {
      expect(robots).toContain(`Disallow: ${disallow}`)
    }
    expect(robots).not.toContain('Disallow: /film')
  })

  it('references the generated sitemap with the production origin', () => {
    expect(robots).toContain(`Sitemap: ${contract.siteUrl}/sitemap.xml`)
  })

  it('is marked as generated', () => {
    expect(robots.startsWith('# Generated by scripts/generate-sitemap.mjs')).toBe(true)
  })
})

describe('sitemap.xml', () => {
  const sitemap = read('public', 'sitemap.xml')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])

  it('lists exactly the contract sitemap entries under the production origin', () => {
    expect(locs).toEqual(contract.sitemap.map(entry => `${contract.siteUrl}${entry.path}`))
    expect(locs).not.toContain(`${contract.siteUrl}/people`)
    expect(locs).not.toContain(`${contract.siteUrl}/print`)
  })

  it('carries changefreq/priority and no volatile lastmod', () => {
    for (const entry of contract.sitemap) {
      expect(sitemap).toContain(
        `<changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority.toFixed(1)}</priority>`
      )
    }
    expect(sitemap).not.toContain('<lastmod>')
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  })
})

describe('manifest.webmanifest', () => {
  const manifest = JSON.parse(read('public', 'manifest.webmanifest')) as Manifest

  it('matches the contract manifest fields', () => {
    expect(manifest).toEqual(meta.manifest)
    expect(manifest.name).toBe(contract.manifest.name)
    expect(manifest.short_name).toBe(contract.manifest.short_name)
    expect(manifest.start_url).toBe(contract.manifest.start_url)
    expect(manifest.theme_color).toBe(contract.manifest.theme_color)
    expect(manifest.background_color).toBe(contract.manifest.background_color)
  })

  it('references real, correctly-sized PNG icons', () => {
    const androidIcons = manifest.icons.filter(icon => icon.sizes === '512x512')
    expect(androidIcons.length).toBeGreaterThanOrEqual(1)
    for (const icon of manifest.icons) {
      const filePath = resolve(PUBLIC, icon.src.replace(/^\//, ''))
      expect(existsSync(filePath), `${icon.src} should exist`).toBe(true)
      expect(statSync(filePath).size).toBeGreaterThan(0)
      const bytes = readFileSync(filePath)
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
      const [width, height] = icon.sizes.split('x').map(Number)
      expect(width).toBe(bytes.readUInt32BE(16))
      expect(height).toBe(bytes.readUInt32BE(20))
      expect(icon.purpose).toBe('maskable any')
    }
    for (const shortcut of manifest.shortcuts) {
      expect(['/gallery', '/guestbook']).toContain(shortcut.url)
      for (const icon of (shortcut as { icons?: Array<{ src: string }> }).icons ?? []) {
        expect(existsSync(resolve(PUBLIC, icon.src.replace(/^\//, '')))).toBe(true)
      }
    }
  })
})

describe('sw.js', () => {
  const sw = read('public', 'sw.js')

  it('is versioned and precaches exactly the route table shell list', () => {
    expect(sw).toContain(`const CACHE_VERSION = '${meta.serviceWorker.version}'`)
    expect(sw).toContain("const CACHE_PREFIX = 'aj-archive-'")
    const precacheBlock = between(sw, 'const PRECACHE_URLS = [', ']')
    const urls = [...precacheBlock.matchAll(/'([^']+)'/g)].map(match => match[1])
    expect(urls).toEqual(meta.serviceWorker.precache)
    expect(urls).toContain('/')
    expect(urls).not.toContain('/admin/')
    expect(urls).not.toContain('/guest/')
  })

  it('excludes private/auth/API paths and offline-falls back to the cached shell', () => {
    const excludedBlock = between(sw, 'const EXCLUDED_PATH_PREFIXES = [', ']')
    const excluded = [...excludedBlock.matchAll(/'([^']+)'/g)].map(match => match[1])
    expect(excluded).toEqual(meta.serviceWorker.excludedPathPrefixes)
    for (const path of ['/admin', '/guest/', '/sw.js', '/manifest.webmanifest']) {
      expect(excluded).toContain(path)
    }
    expect(sw).not.toMatch(/supabase/i)
    expect(sw).toContain("request.mode === 'navigate'")
    expect(sw).toContain("const RUNTIME_CACHEABLE_PREFIXES = ['/assets/', '/images/', '/fonts/']")
    expect(sw).toContain("const OFFLINE_FALLBACK_URL = '/'")
    expect(sw).not.toContain('session')
    expect(sw).not.toContain('Authorization')
  })

  it('caches only same-origin GET requests', () => {
    expect(sw).toContain("if (request.method !== 'GET') return")
    expect(sw).toContain('if (url.origin !== self.location.origin) return')
  })
})

describe('dist copies', () => {
  const buildAvailable = existsSync(resolve(DIST, 'index.html'))

  it('are byte-identical to the committed public artifacts when a build exists', () => {
    if (!buildAvailable) return
    for (const name of ['robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'sw.js']) {
      expect(read('dist', name)).toBe(read('public', name))
    }
  })
})

describe('netlify.toml deploy surface', () => {
  const toml = read('netlify.toml')

  it('configures the build/publish directory and production PWA flag', () => {
    expect(toml).toContain('[build]')
    expect(toml).toContain('publish = "dist"')
    expect(toml).toContain('NODE_VERSION = "22"')
    expect(toml).toContain('VITE_ENABLE_PWA = "1"')
    expect(toml).toContain('command = "npm run build:prod"')
  })

  it('has the SPA fallback in the correct order after the private shells', () => {
    const adminIndex = toml.indexOf('from = "/admin/*"')
    const guestIndex = toml.indexOf('from = "/guest/*"')
    const fallback = toml.lastIndexOf('to = "/index.html"')
    expect(adminIndex).toBeGreaterThan(-1)
    expect(guestIndex).toBeGreaterThan(adminIndex)
    expect(fallback).toBeGreaterThan(guestIndex)
  })

  it('mirrors the frozen security headers and cache policy from the contract', () => {
    const headers = read('public/_headers')
    const security = contract.headers.find(entry => entry.pattern === '/*')?.headers ?? {}
    for (const [name, value] of Object.entries(security)) {
      expect(headers).toContain(`${name}: ${value}`)
    }
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable')
    expect(headers).toContain('Cache-Control: no-cache, no-store, must-revalidate')
    expect(headers).toContain('Content-Type: application/manifest+json')
  })

  it('keeps CSP free of unsafe-eval and documents the Sentry connect-only path', () => {
    const csp = read('public/_headers').match(/Content-Security-Policy: ([^\n]+)/)?.[1] ?? ''
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com")
    expect(csp).toContain('https://o4511356027011072.ingest.us.sentry.io')
    expect(csp).toContain('https://*.supabase.co')
    expect(csp).toContain('https://*.r2.dev')
  })
})
