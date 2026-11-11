/**
 * Local port of the frozen `src/utils/videoProgress.ts` (only the helpers the
 * Home film CTA needs). Wave 3 moves this into `shared/data`; until then the
 * Home CTA keeps the exact frozen storage key/label semantics so the resume
 * label renders identically.
 */
export const MAIN_FILM_PROGRESS_KEY = 'main-film'

export function getVideoProgressStorageKey(storageKey: string) {
  return `video-progress-${storageKey}`
}

export function readSavedVideoProgress(storageKey: string): number | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.localStorage.getItem(getVideoProgressStorageKey(storageKey))
  if (!rawValue) {
    return null
  }

  const parsedValue = Number.parseFloat(rawValue)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null
  }

  return parsedValue
}

export function formatVideoProgressLabel(totalSeconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
