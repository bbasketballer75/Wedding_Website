/**
 * App-layer adapter: `shared/data` film highlights → the Film feature's clip
 * view model (Wave 9 W9-4).
 *
 * Frozen behaviour (`src/pages/Film.tsx:87-143`) is already implemented by the
 * typed data layer:
 *   - `fetchFilmGuestHighlights()` reads `guest_uploads` filtered to
 *     `status = 'approved'`, 12 rows newest-first;
 *   - `selectFilmHighlights()` keeps only rows with a video URL, excludes
 *     `archive_only`, prioritises `guest_highlights`/`featured`, caps at 6;
 *   - `mapFilmHighlights()` produces the reel view model (badge, trail id,
 *     title/description fallbacks).
 *
 * This module maps that output onto the Film feature's `FilmGuestUploadRecord` →
 * `FilmGuestClip` contract (`selectFilmGuestClips`/`toFilmGuestClip`) so the page
 * renders exactly the same DOM the frozen page did, and re-applies the contract
 * as an idempotent guard for callers that hand the adapter unfiltered data.
 *
 * The feature hook imports `fetchFilmGuestClips` as its default loader and keeps
 * an injectable loader parameter for tests (see `useFilmGuestClips`).
 */
import { fetchFilmGuestHighlights, type FilmHighlight } from '@/shared/data/guestUploads'
import {
  FILM_GUEST_CLIP_BADGE,
  FILM_GUEST_CLIP_DEFAULT_DESCRIPTION,
  FILM_GUEST_CLIP_LIMIT,
  selectFilmGuestClips,
  type FilmGuestClip,
  type FilmGuestUploadRecord,
} from '@/features/film/guest-clips/filmGuestClips'

/** Loader seam for tests/alternate data sources. */
export type FilmHighlightsLoader = () => Promise<readonly FilmHighlight[]>

/**
 * Map a data-layer `FilmHighlight` (already selected/mapped) to the film
 * feature's raw record shape.
 *
 * `message` recovery: `FilmHighlight.title` is the trimmed message, or the
 * frozen fallback `"A moment from <guest>"`; the description tells the two apart
 * (fallbacks use the frozen default description). Recovering the original
 * message keeps `toFilmGuestClip`'s title/description fallbacks identical.
 */
export function toFilmGuestUploadRecord(highlight: FilmHighlight): FilmGuestUploadRecord {
  const isFallbackDescription = highlight.description === FILM_GUEST_CLIP_DEFAULT_DESCRIPTION
  return {
    id: highlight.uploadId,
    guest_name: highlight.guestName,
    message: isFallbackDescription ? null : highlight.title,
    video_urls: [highlight.videoUrl],
    created_at: highlight.createdAt,
    status: 'approved',
    // The data layer has already applied the visibility selection; the sentinel
    // keeps the feature contract's archive-only exclusion idempotent.
    video_visibility: 'guest_highlights',
    memory_trail: highlight.memoryTrail,
  }
}

/**
 * Map data-layer highlights to the final clip view models through the feature
 * contract (filters + priority + 6 cap are re-applied, idempotently).
 */
export function mapFilmHighlightsToGuestClips(
  highlights: readonly FilmHighlight[]
): FilmGuestClip[] {
  return selectFilmGuestClips(highlights.map(toFilmGuestUploadRecord), FILM_GUEST_CLIP_LIMIT)
}

/**
 * Exposed for adapter-level tests and for consumers that already hold raw
 * upload rows: runs the documented selection contract unchanged.
 */
export function selectFilmClipsFromUploadRecords(
  records: readonly FilmGuestUploadRecord[],
  limit = FILM_GUEST_CLIP_LIMIT
): FilmGuestClip[] {
  return selectFilmGuestClips(records, limit)
}

/**
 * Read approved guest video highlights through the typed data layer and map
 * them to the film feature's clip contract.
 *
 * The loader is injectable so tests (and the parity harness) can supply
 * deterministic rows without a Supabase client.
 */
export async function fetchFilmGuestClips(
  loadHighlights: FilmHighlightsLoader = () => fetchFilmGuestHighlights()
): Promise<FilmGuestClip[]> {
  const highlights = await loadHighlights()
  return mapFilmHighlightsToGuestClips(highlights)
}

/** Hero badge used when the data layer omits it (frozen default). */
export { FILM_GUEST_CLIP_BADGE }
