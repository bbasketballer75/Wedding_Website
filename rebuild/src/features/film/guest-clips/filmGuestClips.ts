/**
 * Guest-video highlight view model + selector.
 *
 * This is the typed seam where the data layer will be wired (W4-2 delivers the
 * stub hook `useFilmGuestClips`; the Lead binds the real query in W4-4).
 *
 * The selection rules are the frozen Film page's (A4 §7 / `src/pages/Film.tsx`
 * lines 87-143):
 *   - approved uploads only (the frozen query filtered `status = approved`);
 *   - only rows with at least one video URL;
 *   - `archive_only` rows are excluded;
 *   - `guest_highlights` / `featured` sort first;
 *   - at most 6 clips;
 *   - badge "From your phones", trail label from the memory-trail id (falling
 *     back to "Guest point of view").
 */
import { getMemoryTrailById } from '../filmContent'

export const FILM_GUEST_CLIP_LIMIT = 6
export const FILM_GUEST_CLIP_BADGE = 'From your phones'
export const FILM_GUEST_CLIP_DEFAULT_TRAIL = 'Guest point of view'
export const FILM_GUEST_CLIP_DEFAULT_DESCRIPTION =
  'A little handheld piece of the day, straight from the room and exactly how it felt to be there.'

/** Minimal row shape the selector accepts (Supabase `guest_uploads` subset). */
export interface FilmGuestUploadRecord {
  id: string
  guest_name: string
  message: string | null
  video_urls: readonly string[] | null
  created_at: string | null
  status: string | null
  video_visibility: string | null
  memory_trail: string | null
}

/** One card/modal view model (frozen `GuestVideoHighlight`). */
export interface FilmGuestClip {
  id: string
  uploadId: string
  guestName: string
  title: string
  description: string
  videoUrl: string
  createdAt: string
  badge: string
  trail: string
}

function visibilityScore(record: FilmGuestUploadRecord): number {
  return record.video_visibility === 'guest_highlights' || record.video_visibility === 'featured'
    ? 1
    : 0
}

/** Map one approved guest upload to a film highlight, or `null` when it has no usable video. */
export function toFilmGuestClip(record: FilmGuestUploadRecord): FilmGuestClip | null {
  if (record.status !== 'approved') return null
  if (record.video_visibility === 'archive_only') return null

  const videoUrls = record.video_urls ?? []
  const videoUrl = videoUrls[0]
  if (!videoUrl) return null

  const trimmedMessage = record.message?.trim() ?? ''
  const trail = record.memory_trail ? getMemoryTrailById(record.memory_trail) : null

  return {
    id: record.id,
    uploadId: record.id,
    guestName: record.guest_name,
    title: trimmedMessage || `A moment from ${record.guest_name}`,
    description: trimmedMessage || FILM_GUEST_CLIP_DEFAULT_DESCRIPTION,
    videoUrl,
    createdAt: record.created_at ?? '',
    badge: FILM_GUEST_CLIP_BADGE,
    trail: trail?.label ?? FILM_GUEST_CLIP_DEFAULT_TRAIL,
  }
}

/** Frozen selection: filter, priority-sort, cap at six, then map to view models. */
export function selectFilmGuestClips(
  records: readonly FilmGuestUploadRecord[],
  limit = FILM_GUEST_CLIP_LIMIT
): FilmGuestClip[] {
  const eligible = records
    .map(record => ({ record }))
    .filter(({ record }) => toFilmGuestClip(record) !== null)
    .sort((left, right) => visibilityScore(right.record) - visibilityScore(left.record))
    .slice(0, limit)

  return eligible
    .map(({ record }, videoIndex) => {
      const clip = toFilmGuestClip(record)
      return clip ? { ...clip, id: `${record.id}-${videoIndex}` } : null
    })
    .filter((clip): clip is FilmGuestClip => clip !== null)
}
