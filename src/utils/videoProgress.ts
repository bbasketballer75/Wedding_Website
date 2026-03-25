export const MAIN_FILM_PROGRESS_KEY = 'main-film'

export function getVideoProgressStorageKey(storageKey: string) {
  return `video-progress-${storageKey}`
}

export function readSavedVideoProgress(storageKey: string) {
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

export function writeSavedVideoProgress(storageKey: string, value: number) {
  if (typeof window === 'undefined' || !Number.isFinite(value) || value < 0) {
    return
  }

  window.localStorage.setItem(getVideoProgressStorageKey(storageKey), value.toString())
}

export function clearSavedVideoProgress(storageKey: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getVideoProgressStorageKey(storageKey))
}

export function formatVideoProgressLabel(totalSeconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
