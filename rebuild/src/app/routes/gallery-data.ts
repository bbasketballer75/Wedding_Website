/**
 * App-layer adapter between `shared/data` photo reads and the Gallery feature's
 * `GalleryPhotosSource` seam (Wave 5 data wiring).
 *
 * Mirrors the frozen `mapSupabasePhoto` (`src/components/gallery/data.ts`) field
 * for field so curated + live merging, collection derivation and the masonry
 * aspect ratios stay identical.
 */
import { useMemo } from 'react'
import {
  deriveCollection,
  type GalleryPhoto,
  type GalleryPhotosSource,
} from '@/features/gallery/data'
import type { Photo } from '@/shared/data/photos'
import { useGalleryPhotos } from '@/shared/data/hooks'

const GALLERY_READ_ERROR =
  'The live gallery is taking a moment — the collections below are still ready to explore.'

function mapSupabasePhoto(photo: Photo): GalleryPhoto {
  return {
    id: photo.id,
    url: photo.url,
    thumbnail: photo.thumbnail || photo.url,
    downloadUrl: photo.download_url ?? photo.url,
    caption: photo.caption ?? undefined,
    album: photo.album ?? undefined,
    // The typed data layer defaults a missing album_sort_order to 0; the frozen
    // mapper keeps it undefined so live rows sort after album-ordered curated
    // rows (MAX_SAFE_INTEGER bucket). Treat 0 as "not ordered" to stay identical.
    albumSortOrder: photo.album_sort_order > 0 ? photo.album_sort_order : undefined,
    category: photo.category || 'Uncategorized',
    likes: photo.likes,
    // Frozen default: dimensions are not stored, so live rows render at 1:1.
    aspectRatio: 1,
    time: photo.date
      ? new Date(photo.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : undefined,
    location: photo.location ?? undefined,
    photographer: photo.photographer ?? undefined,
    date: photo.date ?? undefined,
    createdAt: photo.created_at ?? undefined,
    faces: photo.faces.map(face => ({
      id: 'id' in face && typeof face.id === 'string' ? face.id : face.name,
      name: face.name,
      x: face.x,
      y: face.y,
      ...('box' in face && face.box ? { box: face.box } : {}),
    })),
    tags: photo.tags,
    source: photo.isProfessional ? 'professional' : 'guest',
    collection: deriveCollection({
      tags: photo.tags,
      url: photo.url,
      thumbnail: photo.thumbnail || photo.url,
      source: photo.isProfessional ? 'professional' : 'guest',
      album: photo.album,
      category: photo.category,
    }),
  }
}

/**
 * Live half of the gallery source. Curated photos stay the feature's constant
 * (they render even when the live fetch fails, exactly like the frozen page).
 */
export function useLiveGallerySource(): GalleryPhotosSource {
  const query = useGalleryPhotos()

  const rows = useMemo(() => query.data?.pages.flat() ?? [], [query.data])
  const live = useMemo(() => rows.map(mapSupabasePhoto), [rows])

  return {
    live,
    isLoading: query.isLoading,
    loadError: query.isError ? GALLERY_READ_ERROR : null,
  }
}
