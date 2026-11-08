import { afterEach, describe, expect, it } from 'vitest'
import {
  formatVideoProgressLabel,
  getVideoProgressStorageKey,
  MAIN_FILM_PROGRESS_KEY,
  readSavedVideoProgress,
} from './videoProgress'

afterEach(() => {
  window.localStorage.clear()
})

describe('video progress helpers (frozen utils/videoProgress contract)', () => {
  it('builds the frozen storage key', () => {
    expect(getVideoProgressStorageKey(MAIN_FILM_PROGRESS_KEY)).toBe('video-progress-main-film')
  })

  it('reads a saved progress value', () => {
    window.localStorage.setItem('video-progress-main-film', '125.4')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBe(125.4)
  })

  it('ignores missing, invalid, zero and negative values', () => {
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()

    window.localStorage.setItem('video-progress-main-film', 'not-a-number')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()

    window.localStorage.setItem('video-progress-main-film', '0')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()

    window.localStorage.setItem('video-progress-main-film', '-12')
    expect(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)).toBeNull()
  })

  it('formats the frozen mm:ss resume label', () => {
    expect(formatVideoProgressLabel(125.4)).toBe('2:05')
    expect(formatVideoProgressLabel(65)).toBe('1:05')
    expect(formatVideoProgressLabel(5)).toBe('0:05')
    expect(formatVideoProgressLabel(-3)).toBe('0:00')
    expect(formatVideoProgressLabel(3600)).toBe('60:00')
  })
})
