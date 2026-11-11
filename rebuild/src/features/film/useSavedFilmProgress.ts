/**
 * Saved main-film progress, ported from the frozen Film page: read on mount,
 * re-read when the tab becomes visible or the window regains focus so the resume
 * CTA reflects progress made in another tab.
 */
import { useEffect, useState } from 'react'
import { MAIN_FILM_PROGRESS_KEY, readSavedVideoProgress } from './videoProgress'

export function useSavedFilmProgress(storageKey: string = MAIN_FILM_PROGRESS_KEY): number | null {
  const [resumeTime, setResumeTime] = useState<number | null>(null)

  useEffect(() => {
    const syncResume = () => {
      setResumeTime(readSavedVideoProgress(storageKey))
    }

    syncResume()
    document.addEventListener('visibilitychange', syncResume)
    window.addEventListener('focus', syncResume)

    return () => {
      document.removeEventListener('visibilitychange', syncResume)
      window.removeEventListener('focus', syncResume)
    }
  }, [storageKey])

  return resumeTime
}
