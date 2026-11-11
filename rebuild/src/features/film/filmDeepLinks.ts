/**
 * Film-page deep-link parsing, ported from the frozen Film page's use of
 * `useSearchParams` (A4 §7). Three params are part of the contract:
 *
 *   ?moment=<chapter-slug>  jump the main film to a chapter
 *   ?clip=<family-film-id>  open a parent-dance modal
 *   ?resume=1               resume saved playback progress, then clean the URL
 *
 * The parsing is a pure function so it can be unit-tested without a router; the
 * router binding lives in `useFilmDeepLinks`.
 */

export const FILM_SEARCH_PARAMS = ['moment', 'clip', 'resume'] as const
export type FilmSearchParam = (typeof FILM_SEARCH_PARAMS)[number]

export interface FilmSearch {
  /** Parent dance id from `?clip=`; `null` when absent/empty. */
  clip: string | null
  /** Chapter slug from `?moment=`; `null` when absent/empty. */
  moment: string | null
  /** True only for `?resume=1` (frozen comparison). */
  resume: boolean
}

/** Parse `location.searchStr` (`""` or `"?a=b"`). Unknown params are ignored. */
export function parseFilmSearch(searchStr: string): FilmSearch {
  const params = new URLSearchParams(searchStr)
  const clip = params.get('clip')
  const moment = params.get('moment')

  return {
    clip: clip && clip.length > 0 ? clip : null,
    moment: moment && moment.length > 0 ? moment : null,
    resume: params.get('resume') === '1',
  }
}

/** Convert a search string to the plain object TanStack Router `search` wants. */
export function toSearchObject(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr)
  const search: Record<string, string> = {}
  params.forEach((value, key) => {
    search[key] = value
  })
  return search
}

/** Return the same search string with one param removed (`""` when nothing left). */
export function removeSearchParam(searchStr: string, name: string): string {
  const params = new URLSearchParams(searchStr)
  params.delete(name)
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}
