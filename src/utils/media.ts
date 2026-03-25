const OFFLOADED_MEDIA_PREFIXES = ['/video/', '/background_audio/', '/media/']
const STORAGE_MEDIA_PREFIX = '/media/'
const DEFAULT_MEDIA_BUCKET = 'wedding-media'
const DEV_MEDIA_PROXY_PREFIX = '/__media_proxy'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function hashString(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function sanitizePathSegment(segment: string): string {
  const lastDotIndex = segment.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0
  const baseName = hasExtension ? segment.slice(0, lastDotIndex) : segment
  const extension = hasExtension ? segment.slice(lastDotIndex) : ''
  const safeBaseName = baseName.replace(/[^A-Za-z0-9._-]/g, '_')

  if (safeBaseName === baseName) {
    return `${safeBaseName}${extension}`
  }

  return `${safeBaseName}__${hashString(segment)}${extension}`
}

export function toRemoteMediaPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  return normalizedPath
    .split('/')
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/')
}

export function getMediaPath(path: string): string {
  if (!path.startsWith('/')) {
    return path
  }

  const supabaseUrl = trimTrailingSlash(import.meta.env.VITE_SUPABASE_URL || '')
  const supabaseMediaBucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || DEFAULT_MEDIA_BUCKET
  if (supabaseUrl && path.startsWith(STORAGE_MEDIA_PREFIX)) {
    return `${supabaseUrl}/storage/v1/object/public/${supabaseMediaBucket}/${toRemoteMediaPath(path)}`
  }

  const mediaBaseUrl = trimTrailingSlash(import.meta.env.VITE_MEDIA_BASE_URL || '')
  const shouldOffload = OFFLOADED_MEDIA_PREFIXES.some(prefix => path.startsWith(prefix))

  if (!mediaBaseUrl || !shouldOffload) {
    return path
  }

  if (import.meta.env.DEV) {
    return `${DEV_MEDIA_PROXY_PREFIX}/${toRemoteMediaPath(path)}`
  }

  return `${mediaBaseUrl}/${toRemoteMediaPath(path)}`
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
