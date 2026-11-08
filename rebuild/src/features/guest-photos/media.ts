/**
 * Media-path helper for public media URLs.
 *
 * Ported from the frozen `src/utils/media.ts:14-36` (parity: the oracle rewrites
 * offloaded media through `VITE_MEDIA_BASE_URL`, with a dev proxy prefix).
 *
 * TODO(Wave3): replace with `getMediaPath` from `shared/data/media` once the
 * typed data layer owns media URL normalization.
 */

const OFFLOADED_MEDIA_PREFIXES = ['/video/', '/background_audio/', '/media/'] as const
const DEV_MEDIA_PROXY_PREFIX = '/__media_proxy'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function joinRemotePath(path: string): string {
  // Don't modify path segments — `Bach+ette` must survive the CDN rewrite.
  return path.split('/').filter(Boolean).join('/')
}

/** Frozen `getMediaPath`: prefix offloaded media with the CDN base (or dev proxy). */
export function getMediaPath(path: string): string {
  if (/^https?:\/\//.test(path)) return path

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const mediaBaseUrl = trimTrailingSlash(import.meta.env.VITE_MEDIA_BASE_URL || '')
  const shouldOffload = OFFLOADED_MEDIA_PREFIXES.some(prefix => normalizedPath.startsWith(prefix))

  if (!mediaBaseUrl || !shouldOffload) return normalizedPath

  if (import.meta.env.DEV) {
    return `${DEV_MEDIA_PROXY_PREFIX}/${joinRemotePath(normalizedPath)}`
  }

  return `${mediaBaseUrl}/${joinRemotePath(normalizedPath)}`
}
