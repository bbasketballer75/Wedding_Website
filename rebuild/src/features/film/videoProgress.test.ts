import { afterEach, describe, expect, it } from 'vitest'
import {
  MAIN_FILM_PROGRESS_KEY,
  clearSavedVideoProgress,
  formatVideoProgressLabel,
  getVideoProgressStorageKey,
  readSavedVideoProgress,
  writeSavedVideoProgress,
} from './videoProgress'

const MAIN_FILM_STORAGE_KEY = getVideoProgressStorageKey(MAIN_FILM_PROGRESS_KEY)

afterEach(() => {
  window.localStorage.clear()
})

describe('videoProgress', () => {
  it('uses the frozen main-film storage key video-progress-main-film', () => {
    expect(MAIN_FILM_PROGRESS_KEY).toBe('main-film')
    expect(MAIN_FILM_STORAGE_KEY).toBe('video-progress-main-film')
  })

  it('round-trips saved progress', () => {
    writeSavedVideoProgress(MAIN_FILM_PROGRESS_KEY, 312.5)
    expect(window.localStorage.getItem(MAIN_FILM_STORAGE_KEY)).toBe('312.5')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBe(312.5)
  })

  it('returns null for absent, unparsable or non-positive progress', () => {
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()

    window.localStorage.setItem(MAIN_FILM_STORAGE_KEY, 'not-a-number')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()

    window.localStorage.setItem(MAIN_FILM_STORAGE_KEY, '0')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()

    window.localStorage.setItem(MAIN_FILM_STORAGE_KEY, '-5')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()
  })

  it('ignores non-finite or negative writes', () => {
    writeSavedVideoProgress(MAIN_FILM_PROGRESS_KEY, Number.NaN)
    writeSavedVideoProgress(MAIN_FILM_PROGRESS_KEY, -1)
    expect(window.localStorage.getItem(MAIN_FILM_STORAGE_KEY)).toBeNull()
  })

  it('clears saved progress', () => {
    writeSavedVideoProgress(MAIN_FILM_PROGRESS_KEY, 90)
    clearSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)
    expect(window.localStorage.getItem(MAIN_FILM_STORAGE_KEY)).toBeNull()
  })

  it('formats the progress label for a resume CTA', () => {
    expect(formatVideoProgressLabel(0)).toBe('0:00')
    expect(formatVideoProgressLabel(312)).toBe('5:12')
  })
})
