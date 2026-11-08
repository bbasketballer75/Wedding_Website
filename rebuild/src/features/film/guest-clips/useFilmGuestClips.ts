/**
 * W4-2 STUB: guest-video highlights data seam.
 *
 * The page renders this hook's result exactly like the frozen page rendered its
 * Supabase query result (skeletons while loading, self-hide when empty). The
 * rebuild's data layer already exposes the query (`useFilmGuestHighlights` in
 * `@/shared/data/hooks`, which returns six `FilmHighlight` rows with the same
 * badge/trail shape); W4-4 (Lead) wires it in by replacing the body of
 * `useFilmGuestClips` with a map through `selectFilmGuestClips`.
 *
 * Returning empty data now is deliberate: it keeps parity deterministic (the
 * frozen text oracle captured the section self-hidden), avoids a Supabase read
 * from a not-yet-data-bound page, and lets the section/self-hide contract be
 * tested without a QueryClient.
 */
import type { FilmGuestClip } from './filmGuestClips'

export interface UseFilmGuestClipsResult {
  clips: readonly FilmGuestClip[]
  isLoading: boolean
}

export function useFilmGuestClips(): UseFilmGuestClipsResult {
  // W4-4 wiring point:
  //   const query = useFilmGuestHighlights()
  //   return {
  //     clips: query.data ? selectFilmGuestClips(query.data) : [],
  //     isLoading: query.isLoading,
  //   }
  return { clips: [], isLoading: false }
}
