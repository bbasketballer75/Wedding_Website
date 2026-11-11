/**
 * Guest-video highlights hook for the Film page.
 *
 * Wave 9 W9-4 wiring: the default loader is the app-layer adapter
 * `fetchFilmGuestClips` (`app/routes/film-clips-adapter.ts`), which reads the
 * typed data layer (`fetchFilmGuestHighlights`) and maps rows through the
 * feature's selection contract (approved-only, video-only, archive-only
 * excluded, featured priority, max 6, badge/trail).
 *
 * The loader stays injectable (`useFilmGuestClips(loadClips)`) so tests and the
 * parity harness can supply deterministic clips without a Supabase client.
 *
 * Render behaviour matches the frozen page (`src/pages/Film.tsx:431`): the
 * section is only rendered when clips exist, so a missing/empty read leaves the
 * page height unchanged (the frozen page did not render the skeleton section
 * either, because the section itself was gated on `guestHighlights.length`).
 */
import { useEffect, useState } from 'react'
import { fetchFilmGuestClips as defaultFetchFilmGuestClips } from '@/app/routes/film-clips-adapter'
import type { FilmGuestClip } from './filmGuestClips'

export interface UseFilmGuestClipsResult {
  clips: readonly FilmGuestClip[]
  isLoading: boolean
}

export type FilmGuestClipsLoader = () => Promise<readonly FilmGuestClip[]>

export const defaultFilmGuestClipsLoader: FilmGuestClipsLoader = () => defaultFetchFilmGuestClips()

export function useFilmGuestClips(
  loadClips: FilmGuestClipsLoader = defaultFilmGuestClipsLoader
): UseFilmGuestClipsResult {
  const [clips, setClips] = useState<readonly FilmGuestClip[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    loadClips()
      .then(loadedClips => {
        if (isActive) {
          setClips(loadedClips)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // A failed highlight read must not break the film page: keep the section
        // hidden exactly like the frozen page's tolerant fetch.
        if (isActive) {
          setClips([])
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [loadClips])

  return { clips, isLoading }
}
