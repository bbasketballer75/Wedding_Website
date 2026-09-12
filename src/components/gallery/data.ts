/**
 * Gallery data layer — pure helpers extracted from src/pages/Gallery.tsx.
 *
 * Why this exists
 * ---------------
 * `src/pages/Gallery.tsx` was a 2143-line monolith. These helpers are the
 * pure data-shaping layer that turns Supabase rows into `GalleryPhoto`,
 * normalizes media paths, formats timestamps, and assigns photos to a
 * `CollectionTab`. They have no React or browser-only globals.
 *
 * Keeping them here means:
 *   1. The page component can shrink to a thin composition layer.
 *   2. Custom hooks (e.g. `useGalleryData`) can import them directly.
 *   3. Tests can target the helpers without mounting React.
 */

import { getMediaPath } from '@/utils/media'
import type { Photo } from '@/lib/supabase'
import type { GalleryPhoto } from '@/components/gallery/constants'
export type { GalleryPhoto }

// ─── Path normalization ────────────────────────────────────────────────────

export const normalizeGalleryMediaPath = (path?: string | null): string => {
  if (!path) {
    return ''
  }
  return getMediaPath(path)
}

export const normalizeGalleryPhoto = (photo: GalleryPhoto): GalleryPhoto => ({
  ...photo,
  url: normalizeGalleryMediaPath(photo.url),
  thumbnail: normalizeGalleryMediaPath(photo.thumbnail || photo.url),
  downloadUrl: normalizeGalleryMediaPath(photo.downloadUrl || photo.url),
})

// ─── Display formatting ───────────────────────────────────────────────────

export const formatPhotoCommentTimestamp = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

// ─── Collection assignment ────────────────────────────────────────────────

// Helper to convert Supabase photo to local Photo type
export const normalizeCollectionValue = (
  value?: string | null
): GalleryPhoto['collection'] | null => {
  const normalized = (value || '').trim().toLowerCase()

  if (normalized === 'engagement' || normalized === 'proposal') {
    return 'Proposal'
  }

  if (
    normalized === 'bach+ette' ||
    normalized === 'bach' ||
    normalized === 'bachelorette' ||
    normalized === 'bachelor'
  ) {
    return 'Bach+ette'
  }

  if (
    normalized === 'wedding day' ||
    normalized === 'wedding-day' ||
    normalized === 'wedding photos' ||
    // All wedding-photo sub-albums map to Wedding Photos collection
    normalized === 'couple' ||
    normalized === 'parents' ||
    normalized === 'rings' ||
    normalized === 'film' ||
    normalized === 'home' ||
    normalized === 'parent-film-cards' ||
    normalized === 'wedding-party' ||
    normalized === 'shared-gallery-new'
  ) {
    return 'Wedding Photos'
  }

  if (
    normalized === 'guest uploads' ||
    normalized === 'guest-upload' ||
    normalized === 'guest' ||
    normalized === 'guest photos'
  ) {
    return 'Guest Photos'
  }

  return null
}

export const deriveCollection = (
  photo: Pick<
    Photo,
    'album' | 'is_professional' | 'category' | 'caption' | 'tags' | 'location' | 'url' | 'thumbnail'
  >
): GalleryPhoto['collection'] => {
  const normalizedAlbum = normalizeCollectionValue(photo.album)
  if (normalizedAlbum) {
    return normalizedAlbum
  }

  const normalizedCategory = normalizeCollectionValue(photo.category)
  if (normalizedCategory) {
    return normalizedCategory
  }

  if (!photo.is_professional) {
    return 'Guest Photos'
  }

  const pathAndTags = [photo.url, photo.thumbnail, ...(photo.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (pathAndTags.includes('engagement') || pathAndTags.includes('proposal')) {
    return 'Proposal'
  }

  if (
    pathAndTags.includes('bach') ||
    pathAndTags.includes('bachelorette') ||
    pathAndTags.includes('bachelor') ||
    pathAndTags.includes('ette')
  ) {
    return 'Bach+ette'
  }

  return 'Wedding Photos'
}

export const mapSupabasePhoto = (photo: Photo): GalleryPhoto =>
  normalizeGalleryPhoto({
    id: photo.id,
    url: photo.url,
    thumbnail: photo.thumbnail,
    downloadUrl: photo.download_url ?? photo.url,
    caption: photo.caption,
    album: photo.album,
    albumSortOrder: photo.album_sort_order ?? undefined,
    category: photo.category || 'Uncategorized',
    likes: photo.likes,
    aspectRatio: 1, // Default, could be calculated from image dimensions
    time: photo.date
      ? new Date(photo.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : undefined,
    location: photo.location,
    photographer: photo.photographer,
    date: photo.date,
    createdAt: photo.created_at,
    created_at: photo.created_at,
    is_professional: photo.is_professional,
    faces: photo.faces || [],
    tags: photo.tags,
    source: photo.is_professional ? 'professional' : 'guest',
    collection: deriveCollection(photo),
  })
