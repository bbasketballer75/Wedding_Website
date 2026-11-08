/**
 * Chapter loading + parsing, ported from the frozen `src/data/film.ts`
 * (`parseMainFilmChapters`, `slugifyFilmMoment`, `loadMainFilmChapters`).
 *
 * Anti-HTML guard (A4 §7): the SPA catch-all serves `index.html` for a missing
 * VTT, so the loader rejects anything that is not a real `WEBVTT` document. The
 * page then keeps the ten-chapter fallback from `contracts/content/film.json`.
 */
import { MAIN_FILM, MAIN_FILM_CHAPTERS_FALLBACK, type FilmChapter } from './filmContent'
import { mediaPaths } from '@/shared/data/media'

/** Pure timecode parser: `"00:01:23.500" -> 83.5`. */
export function parseTimecode(value: string): number {
  const segments = value
    .trim()
    .split(':')
    .map(segment => Number.parseFloat(segment))

  return segments.reduce((total, segment) => total * 60 + segment, 0)
}

/** Parse a WebVTT chapter track into ordered chapters. */
export function parseMainFilmChapters(vttText: string): FilmChapter[] {
  return vttText
    .split(/\r?\n\r?\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block =>
      block
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
    )
    .flatMap(lines => {
      const timeLine = lines.find(line => line.includes('-->'))
      const labelLine = lines.find(line => !line.includes('-->') && line !== 'WEBVTT')

      if (!timeLine || !labelLine) {
        return []
      }

      const [start] = timeLine.split('-->')

      return [
        {
          label: labelLine,
          time: parseTimecode(start ?? ''),
        },
      ]
    })
}

/** Frozen URL slug for a chapter label (`"The Ceremony" -> "the-ceremony"`). */
export function slugifyFilmMoment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface LoadMainFilmChaptersDeps {
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
  /** Injectable media resolver for tests; defaults to `mediaPaths.getMediaPath`. */
  resolveMediaPath?: (path: string) => string
}

/**
 * Fetch and parse the live chapter track.
 *
 * Throws when the response is not ok or not a real VTT document, exactly like
 * the frozen loader; the caller keeps `MAIN_FILM_CHAPTERS_FALLBACK`.
 */
export async function loadMainFilmChapters(
  deps: LoadMainFilmChaptersDeps = {}
): Promise<FilmChapter[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const resolveMediaPath = deps.resolveMediaPath ?? mediaPaths.getMediaPath

  const response = await fetchImpl(resolveMediaPath(MAIN_FILM.chaptersSource))

  if (!response.ok) {
    throw new Error(`Unable to load main film chapters: ${response.status}`)
  }

  const text = await response.text()

  // Guard against the SPA catch-all returning HTML instead of VTT (the exact
  // failure this check was added for in the frozen app).
  if (!text.trimStart().startsWith('WEBVTT')) {
    throw new Error('Response is not a valid VTT file')
  }

  const parsed = parseMainFilmChapters(text)

  return parsed.length > 0 ? parsed : [...MAIN_FILM_CHAPTERS_FALLBACK]
}
