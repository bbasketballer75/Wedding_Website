const OFFLOADED_MEDIA_PREFIXES = ['/video/', '/background_audio/', '/media/']

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getMediaPath(path: string): string {
  if (!path.startsWith('/')) {
    return path
  }

  const mediaBaseUrl = trimTrailingSlash(import.meta.env.VITE_MEDIA_BASE_URL || '')
  const shouldOffload = OFFLOADED_MEDIA_PREFIXES.some(prefix => path.startsWith(prefix))

  if (!mediaBaseUrl || !shouldOffload) {
    return path
  }

  return `${mediaBaseUrl}${path}`
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
