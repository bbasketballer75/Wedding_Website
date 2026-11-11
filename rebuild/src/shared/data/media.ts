/**
 * Media URL resolution — the rebuild's equivalent of the frozen
 * `src/utils/media.ts`, with the same semantics. This is a *frozen contract*:
 *
 * 1. Only `/video/`, `/background_audio/` and `/media/` paths are offloaded to
 *    the media CDN (`VITE_MEDIA_BASE_URL`). `/images/`, `/icons/`, `/captions/`
 *    and every other static asset stay same-origin.
 * 2. With no `VITE_MEDIA_BASE_URL`, every path resolves to its same-origin form
 *    (local dev / offline, and the parity harness which must not hit the CDN).
 * 3. In dev, offloaded paths go through the `/__media_proxy` Vite proxy.
 * 4. Path segments are NEVER decoded or re-encoded: the literal `+` in
 *    `Bach+ette` and the space in `Guest Uploads` must survive so the Cloudflare
 *    Worker can rewrite them to R2 keys. Sanitising them was a production bug.
 * 5. Absolute `http(s)://` URLs pass through untouched (guest uploads already
 *    point at R2).
 *
 * The resolver is a pure factory so it can be unit-tested and so the app can
 * bind it once from its environment boundary (`src/app/env.ts`); no module-level
 * `import.meta.env` reads leak into domain code.
 */

/** Prefixes whose bytes live on the media CDN (frozen contract). */
export const OFFLOADED_MEDIA_PREFIXES = ['/video/', '/background_audio/', '/media/'] as const

/** Dev-only proxy prefix handled by the Vite dev/preview server. */
export const DEV_MEDIA_PROXY_PREFIX = '/__media_proxy'

export interface MediaPathConfig {
  /** `VITE_MEDIA_BASE_URL`; absent means "serve same-origin". */
  readonly mediaBaseUrl?: string | undefined
  /** `VITE_SITE_URL`; absent means absolute helpers return the path as-is. */
  readonly siteUrl?: string | undefined
  /** `import.meta.env.DEV` equivalent. */
  readonly isDev: boolean
}

export interface MediaPaths {
  /** Strip leading `/+` slashes and collapse empty segments; preserves literals. */
  toRemoteMediaPath: (path: string) => string
  /** Resolve an app media path for rendering (local, CDN, or dev proxy). */
  getMediaPath: (path: string) => string
  /** Resolve a root-relative path against the canonical site origin. */
  getAbsoluteUrl: (path: string) => string
  /** Resolve a media path and then make it absolute (OG/meta images). */
  getAbsoluteMediaUrl: (path: string) => string
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function isAbsoluteHttpUrl(path: string): boolean {
  return /^https?:\/\//.test(path)
}

/**
 * Build a media resolver for one environment snapshot.
 *
 * @example
 * const paths = createMediaPaths({ mediaBaseUrl: env.VITE_MEDIA_BASE_URL, siteUrl: env.VITE_SITE_URL, isDev: import.meta.env.DEV })
 */
export function createMediaPaths(config: MediaPathConfig): MediaPaths {
  const mediaBaseUrl = trimTrailingSlash(config.mediaBaseUrl ?? '')
  const siteUrl = trimTrailingSlash(config.siteUrl ?? '')

  const toRemoteMediaPath = (path: string): string => {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path
    return normalizedPath.split('/').filter(Boolean).join('/')
  }

  const getMediaPath = (path: string): string => {
    if (isAbsoluteHttpUrl(path)) return path

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const shouldOffload = OFFLOADED_MEDIA_PREFIXES.some(prefix => normalizedPath.startsWith(prefix))

    if (!mediaBaseUrl || !shouldOffload) return normalizedPath

    if (config.isDev) {
      return `${DEV_MEDIA_PROXY_PREFIX}/${toRemoteMediaPath(normalizedPath)}`
    }

    return `${mediaBaseUrl}/${toRemoteMediaPath(normalizedPath)}`
  }

  const getAbsoluteUrl = (path: string): string => {
    if (isAbsoluteHttpUrl(path)) return path
    if (!siteUrl) return path
    return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
  }

  const getAbsoluteMediaUrl = (path: string): string => getAbsoluteUrl(getMediaPath(path))

  return { toRemoteMediaPath, getMediaPath, getAbsoluteUrl, getAbsoluteMediaUrl }
}

/**
 * App-wide resolver. The app entry point (Wave 4+) may create its own resolver
 * from `readEnv(import.meta.env)`; this default keeps simple call sites terse.
 * Tests inject their own config instead of mutating `import.meta.env`.
 */
export const mediaPaths: MediaPaths = createMediaPaths({
  mediaBaseUrl: import.meta.env.VITE_MEDIA_BASE_URL,
  siteUrl: import.meta.env.VITE_SITE_URL,
  isDev: import.meta.env.DEV,
})
