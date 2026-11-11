import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contract tests for the canonical prerender metadata table.
 *
 * The route table (`routeMeta.json`) is what the generators consume, so these
 * tests lock it to the tracked contracts: any contract change that is not
 * mirrored here fails the suite, and the frozen stale-metadata defects are
 * pinned with their exact old/new values.
 */
const REBUILD_ROOT = resolve(process.cwd())
const REPO_ROOT = resolve(REBUILD_ROOT, '..')

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, ...segments), 'utf8')) as T
}

interface RouteEntry {
  id: string
  path: string
  outputPath: string
  kind: string
  source?: string
  title: string
  description: string
  canonicalPath: string | null
  ogImage?: string
  robots: string
  shellHeading?: string
  structuredData: Record<string, unknown> | null
  frozenStale?: {
    title: string
    description: string
    canonical: string
    ogImage: string
    robots: string
  }
}

interface RouteMeta {
  siteUrl: string
  sitemap: Array<{ path: string; changefreq: string; priority: number }>
  manifest: {
    name: string
    short_name: string
    display: string
    start_url: string
    theme_color: string
    background_color: string
    lang: string
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>
    shortcuts: Array<{ url: string }>
  }
  robots: { allow: string[]; disallow: string[]; sitemapPath: string }
  serviceWorker: {
    version: string
    precache: string[]
    offlineFallback: string
    excludedPathPrefixes: string[]
  }
  routes: RouteEntry[]
}

interface SeoContract {
  siteUrl: string
  routes: Array<{
    id: string
    title: string
    description: string
    canonicalPath: string
    ogImage?: string
    robots: string
  }>
  sitemap: Array<{ path: string; changefreq: string; priority: number }>
  manifest: Record<string, unknown>
}

interface RenderedSnapshot {
  snapshots: {
    desktop: {
      title: string
      meta: {
        description: string
        robots: string
        canonical: string | null
        ogImage: string
        structuredDataCount: number
      }
    }
  }
}

const meta = readJson<RouteMeta>('rebuild', 'src', 'app', 'seo', 'routeMeta.json')
const contract = readJson<SeoContract>('contracts', 'seo-pwa.json')
const routesContract = readJson<{ routes: Array<{ id: string; path: string }> }>(
  'contracts',
  'routes.json'
)
const routeById = new Map(meta.routes.map(route => [route.id, route]))

describe('routeMeta.json — route table', () => {
  it('prerenders exactly the Wave 8 route set', () => {
    expect(meta.routes.map(route => route.id)).toEqual([
      'home',
      'film',
      'gallery',
      'guestbook',
      'upload',
      'guest-photos',
      'print',
      'activity',
      'admin-login',
      'admin',
      'guest-token',
      'not-found',
    ])
    expect(meta.routes.map(route => route.path)).toEqual([
      '/',
      '/film',
      '/gallery',
      '/guestbook',
      '/upload',
      '/guest-photos',
      '/print',
      '/activity',
      '/admin/login',
      '/admin/*',
      '/guest/:token',
      '/people',
    ])
    expect(meta.siteUrl).toBe(contract.siteUrl)
  })

  it('maps every route to a unique, safe dist output path', () => {
    const outputPaths = meta.routes.map(route => route.outputPath)
    expect(new Set(outputPaths).size).toBe(outputPaths.length)
    for (const route of meta.routes) {
      expect(route.outputPath.startsWith('/')).toBe(false)
      expect(route.outputPath.includes('..')).toBe(false)
      expect(route.outputPath).toMatch(/^([\w-]+\/)*index\.html$/)
    }
    expect(routeById.get('not-found')?.outputPath).toBe('people/index.html')
  })

  it('shares the same route vocabulary as contracts/routes.json', () => {
    const contractPaths = new Set(routesContract.routes.map(route => route.path))
    for (const path of ['/', '/film', '/gallery', '/guestbook', '/upload', '/guest-photos']) {
      expect(contractPaths.has(path)).toBe(true)
    }
    for (const path of ['/print', '/activity', '/admin/login', '/admin/*', '/guest/:token']) {
      expect(contractPaths.has(path)).toBe(true)
    }
  })
})

describe('routeMeta.json — metadata parity with contracts/seo-pwa.json', () => {
  it('matches the frozen title/description/robots/og values', () => {
    for (const contractRoute of contract.routes) {
      const route = routeById.get(contractRoute.id)
      expect(route, `missing contract route ${contractRoute.id}`).toBeDefined()
      if (!route) continue
      expect(route.robots).toBe(contractRoute.robots)
      if (route.source === 'wave8-shell') continue // runtime-templated guest token
      expect(route.title).toBe(contractRoute.title)
      expect(route.description).toBe(contractRoute.description)
      expect(route.canonicalPath).toBe(contractRoute.canonicalPath)
      if (contractRoute.ogImage) expect(route.ogImage).toBe(contractRoute.ogImage)
    }
  })

  it('keeps the frozen sitemap entries (no /people, /print, admin or guest routes)', () => {
    expect(meta.sitemap).toEqual(contract.sitemap)
    expect(meta.sitemap.map(entry => entry.path)).toEqual([
      '/',
      '/film',
      '/gallery',
      '/guestbook',
      '/guest-photos',
      '/upload',
    ])
    for (const excluded of ['/people', '/print', '/admin', '/guest/']) {
      expect(meta.sitemap.some(entry => entry.path.startsWith(excluded))).toBe(false)
    }
  })

  it('keeps noindex on every private/print/404 route', () => {
    for (const id of ['print', 'admin-login', 'admin', 'guest-token', 'not-found']) {
      expect(routeById.get(id)?.robots).toBe('noindex, nofollow')
    }
    for (const id of [
      'home',
      'film',
      'gallery',
      'guestbook',
      'upload',
      'guest-photos',
      'activity',
    ]) {
      expect(routeById.get(id)?.robots).toBe('index, follow')
    }
  })

  it('keeps structured data exactly where the frozen render recorded it', () => {
    for (const contractRoute of contract.routes) {
      const snapshot = readJson<RenderedSnapshot>(
        'contracts',
        'content',
        'rendered',
        `${contractRoute.id}.json`
      )
      const route = routeById.get(contractRoute.id)
      if (!route) continue
      if (snapshot.snapshots.desktop.meta.structuredDataCount > 0) {
        expect(route.structuredData, `${contractRoute.id} should carry JSON-LD`).not.toBeNull()
      } else {
        expect(route.structuredData, `${contractRoute.id} should not add JSON-LD`).toBeNull()
      }
    }
  })
})

describe('routeMeta.json — frozen stale-metadata repairs', () => {
  it('repairs /activity and documents the exact frozen values', () => {
    const route = routeById.get('activity')
    const frozen = readJson<RenderedSnapshot>('contracts', 'content', 'rendered', 'activity.json')
    const frozenMeta = frozen.snapshots.desktop.meta
    expect(route?.source).toBe('wave8-fix')
    expect(route?.frozenStale).toEqual({
      title: frozen.snapshots.desktop.title,
      description: frozenMeta.description,
      canonical: frozenMeta.canonical,
      ogImage: frozenMeta.ogImage,
      robots: frozenMeta.robots,
    })
    // The Wave 8 values are the intended per-route metadata, not the inherited defaults.
    expect(route?.title).toBe("Activity | Austin & Jordyn's Wedding")
    expect(route?.canonicalPath).toBe('/activity')
    expect(route?.title).not.toBe(route?.frozenStale?.title)
    expect(route?.canonicalPath).not.toBe('/')
  })

  it('repairs /admin/* (noindex, no inherited public metadata)', () => {
    const route = routeById.get('admin')
    const frozen = readJson<RenderedSnapshot>('contracts', 'content', 'rendered', 'admin.json')
    expect(route?.source).toBe('wave8-fix')
    expect(route?.robots).toBe('noindex, nofollow')
    expect(route?.canonicalPath).toBeNull()
    expect(route?.frozenStale?.robots).toBe(frozen.snapshots.desktop.meta.robots)
    expect(route?.frozenStale?.title).toBe(frozen.snapshots.desktop.title)
    expect(route?.title).not.toBe(route?.frozenStale?.title)
  })

  it('ships a generic noindex shell for the runtime-template /guest/:token route', () => {
    const route = routeById.get('guest-token')
    expect(route?.source).toBe('wave8-shell')
    expect(route?.outputPath).toBe('guest/index.html')
    expect(route?.robots).toBe('noindex, nofollow')
    expect(route?.canonicalPath).toBeNull()
  })
})

describe('routeMeta.json — generated-file inputs', () => {
  it('defines a deterministic robots policy', () => {
    expect(meta.robots.allow).toEqual(['/'])
    expect(meta.robots.disallow).toEqual(['/admin', '/guest/', '/print'])
    expect(meta.robots.sitemapPath).toBe('/sitemap.xml')
  })

  it('defines a versioned, bounded service-worker precache list', () => {
    expect(meta.serviceWorker.version).toMatch(/^v\d+$/)
    expect(meta.serviceWorker.precache).toContain('/')
    expect(meta.serviceWorker.precache).toContain('/activity/')
    expect(meta.serviceWorker.precache).not.toContain('/people/')
    expect(meta.serviceWorker.excludedPathPrefixes).toContain('/admin')
    expect(meta.serviceWorker.excludedPathPrefixes).toContain('/guest/')
    expect(meta.serviceWorker.offlineFallback).toBe('/')
  })

  it('defines a boot-shell heading for public routes only', () => {
    for (const id of [
      'home',
      'film',
      'gallery',
      'guestbook',
      'upload',
      'print',
      'guest-photos',
      'activity',
    ]) {
      expect(routeById.get(id)?.shellHeading, `${id} shell heading`).toBeTruthy()
    }
    for (const id of ['admin', 'admin-login', 'guest-token', 'not-found']) {
      expect(routeById.get(id)?.shellHeading).toBeUndefined()
    }
  })

  it('keeps manifest base fields aligned with the contract', () => {
    for (const key of [
      'name',
      'short_name',
      'display',
      'start_url',
      'theme_color',
      'background_color',
      'lang',
    ] as const) {
      expect(meta.manifest[key]).toBe(contract.manifest[key])
    }
    expect(meta.manifest.icons.length).toBeGreaterThanOrEqual(2)
    expect(meta.manifest.icons.some(icon => icon.sizes === '512x512')).toBe(true)
    expect(meta.manifest.shortcuts.map(shortcut => shortcut.url)).toEqual([
      '/gallery',
      '/guestbook',
    ])
  })
})
