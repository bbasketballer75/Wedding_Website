/**
 * Saved playback progress, ported verbatim from the frozen
 * `src/utils/videoProgress.ts`.
 *
 * Contract: progress is stored under `video-progress-${storageKey}` in
 * localStorage. The main film uses the storage key `main-film`, i.e. the frozen
 * key `video-progress-main-film` (A4 §7).
 */

/** Frozen `MAIN_FILM_PROGRESS_KEY`. */
export const MAIN_FILM_PROGRESS_KEY = 'main-film'

export function getVideoProgressStorageKey(storageKey: string): string {
  return `video-progress-${storageKey}`
}

/** Read saved progress in seconds; `null` when absent/unparsable/non-positive. */
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

export function writeSavedVideoProgress(storageKey: string, value: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(value) || value < 0) {
    return
  }

  window.localStorage.setItem(getVideoProgressStorageKey(storageKey), value.toString())
}

export function clearSavedVideoProgress(storageKey: string): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getVideoProgressStorageKey(storageKey))
}

/** Human label for a resume CTA (`312 -> "5:12"`). */
export function formatVideoProgressLabel(totalSeconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
