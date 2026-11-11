/**
 * App-layer adapter between `shared/data/claims.ts` (+ photos/guestbook reads)
 * and the Guest Share feature's typed `GuestShareApi` seam (Wave 9 W9-3).
 *
 * Mirrors the frozen `src/pages/GuestShare.tsx` load path exactly:
 *
 *   1. `fetchGuestContributionsByToken(token)` — `null` => invalid link
 *   2. upload photo urls -> `fetchPhotosByUrls(...)` (full `photos` rows so the
 *      lightbox gets thumbnails/captions/likes)
 *   3. merge upload photos first, then approved claimed photos, dedupe by id
 *      (first occurrence wins — frozen merge order)
 *   4. guestbook rows -> note view models (order preserved)
 *
 * A rejected promise is the frozen "network" signal; the page owns that split.
 */
import type {
  GuestShareAlbum,
  GuestShareApi,
  GuestShareNote,
  GuestSharePhoto,
} from '@/features/guest-share'
import type { TypedSupabaseClient } from '@/shared/data/client'
import { fetchGuestContributionsByToken } from '@/shared/data/claims'
import type { GuestbookMessage } from '@/shared/data/guestbook'
import { mediaPaths } from '@/shared/data/media'
import { fetchPhotosByUrls, type Photo } from '@/shared/data/photos'

/** Normalised `Photo` -> the feature's photo view model (subset of `ViewerPhoto`). */
export function mapSharedPhoto(photo: Photo): GuestSharePhoto {
  return {
    id: photo.id,
    // DB rows store `media/...` without a leading slash; normalise before render.
    url: mediaPaths.getMediaPath(photo.url),
    thumbnail: mediaPaths.getMediaPath(photo.thumbnail || photo.url),
    caption: photo.caption ?? null,
    likes: photo.likes,
  }
}

/** `GuestbookMessage` -> the frozen note card model. */
export function mapSharedNote(message: GuestbookMessage): GuestShareNote {
  return {
    id: message.id,
    name: message.name,
    content: message.content,
    createdAt: message.createdAt,
  }
}

/**
 * Frozen merge order + dedupe: uploaded photos first, then claimed photos;
 * rows with an id already seen are dropped (first occurrence wins).
 */
export function mergeSharedPhotos(
  uploadPhotos: readonly Photo[],
  claimedPhotos: readonly Photo[]
): GuestSharePhoto[] {
  const seenIds = new Set<string>()
  const merged: GuestSharePhoto[] = []
  for (const photo of [...uploadPhotos, ...claimedPhotos]) {
    if (!photo.id || seenIds.has(photo.id)) continue
    seenIds.add(photo.id)
    merged.push(mapSharedPhoto(photo))
  }
  return merged
}

/** Full frozen load path; exported for the adapter tests. */
export async function loadGuestShareAlbum(
  token: string,
  client?: TypedSupabaseClient
): Promise<GuestShareAlbum | null> {
  const contributions =
    client === undefined
      ? await fetchGuestContributionsByToken(token)
      : await fetchGuestContributionsByToken(token, client)
  if (!contributions) return null

  const uploadUrls = contributions.uploads.flatMap(upload => upload.photoUrls)
  const uploadPhotos =
    uploadUrls.length === 0
      ? []
      : client === undefined
        ? await fetchPhotosByUrls(uploadUrls)
        : await fetchPhotosByUrls(uploadUrls, client)

  return {
    guestName: contributions.guestName,
    photos: mergeSharedPhotos(uploadPhotos, contributions.claimedPhotos),
    notes: contributions.guestbook.map(mapSharedNote),
  }
}

export function createGuestShareApi(client?: TypedSupabaseClient): GuestShareApi {
  return {
    loadAlbum: (token: string) => loadGuestShareAlbum(token, client),
  }
}

/** Default wiring used by the router; tests inject the structural mock client. */
export const guestShareApi: GuestShareApi = createGuestShareApi()
