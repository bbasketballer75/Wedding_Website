/**
 * Loads the live chapter track for the main film.
 *
 * Frozen behaviour: render the fallback chapters immediately, then replace them
 * with the parsed VTT when it loads; if the load fails or returns HTML, keep the
 * fallback (A4 §7 anti-HTML guard).
 */
import { useEffect, useState } from 'react'
import { loadMainFilmChapters } from './chapters'
import { MAIN_FILM_CHAPTERS_FALLBACK, type FilmChapter } from './filmContent'

export interface UseMainFilmChaptersResult {
  chapters: readonly FilmChapter[]
  isLoading: boolean
}

export function useMainFilmChapters(): UseMainFilmChaptersResult {
  const [chapters, setChapters] = useState<readonly FilmChapter[]>(MAIN_FILM_CHAPTERS_FALLBACK)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      try {
        const loaded = await loadMainFilmChapters()
        if (isActive) {
          setChapters(loaded)
          setIsLoading(false)
        }
      } catch {
        // Keep the contract fallback chapters; the page shows them.
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [])

  return { chapters, isLoading }
}
