const OFFLOADED_MEDIA_PREFIXES = ['/video/', '/background_audio/', '/media/']
const DEV_MEDIA_PROXY_PREFIX = '/__media_proxy'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function toRemoteMediaPath(path: string): string {
  // Don't modify path segments - preserve special characters like +
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return normalizedPath.split('/').filter(Boolean).join('/')
}

export function getMediaPath(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  // Ensure path starts with a leading slash for checking offload prefixes
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  const mediaBaseUrl = trimTrailingSlash(import.meta.env.VITE_MEDIA_BASE_URL || '')
  const shouldOffload = OFFLOADED_MEDIA_PREFIXES.some(prefix => normalizedPath.startsWith(prefix))

  if (!mediaBaseUrl || !shouldOffload) {
    return normalizedPath
  }

  // Don't sanitize path segments - the + in Bach+ette must be preserved
  // so the Cloudflare Worker can correctly rewrite the URL
  if (import.meta.env.DEV) {
    return `${DEV_MEDIA_PROXY_PREFIX}/${toRemoteMediaPath(normalizedPath)}`
  }

  return `${mediaBaseUrl}/${toRemoteMediaPath(normalizedPath)}`
}

export function getAbsoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const siteUrl = trimTrailingSlash(import.meta.env.VITE_SITE_URL || '')

  if (!siteUrl) {
    return path
  }

  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getAbsoluteMediaUrl(path: string): string {
  return getAbsoluteUrl(getMediaPath(path))
}
