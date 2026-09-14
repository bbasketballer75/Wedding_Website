/**
 * useGallerySearchFilters — extracted from src/pages/Gallery.tsx.
 *
 * Owns the search / face filter state and the pure-derived pipelines:
 *   album-ordered photos → collection-scoped photos → search+face filtered photos.
 * Also derives the detected-faces widget data from the full photo list.
 *
 * Returns:
 *   searchQuery / faceFilter / setters:   controlled filter state
 *   setSearchQuery / setFaceFilter:        setters exposed for URL sync
 *   deferredSearchQuery:                   useDeferredValue(searchQuery) — kept here
 *                                          because consumers (infinite scroll, auto-scroll)
 *                                          want it grouped with the filter state
 *   albumOrderedPhotos:                    full photos, sorted by albumSortOrder / createdAt
 *   collectionScopedPhotos:                album-ordered, filtered to the active collection
 *   filteredPhotos:                        collection-scoped, filtered by search + face
 *   detectedFaces:                         aggregated face metadata for FaceRecognition widget
 *   handleFaceFilter(name):                set face + clear search (the "click a face" gesture)
 *   clearFaceFilter:                       clear the face chip
 *   clearAllFilters:                       clear both search and face
 *   hasActiveFilters:                      true if either search or face is active
 *
 * NOTE: this hook is intentionally read-only on `photos` and `selectedCollection`.
 * The page wires `selectedCollection` from useGalleryToolbar. Splitting like this
 * keeps the hooks single-purpose and independently testable.
 */
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { resolveAlias, type CollectionTab, type GalleryPhoto } from '@/components/gallery/constants'
import type { PhotoFace } from '@/lib/supabase'

export interface DetectedFace {
  id: string
  name: string
  photoCount: number
  confidence?: number
  thumbnail?: string
  latestMoment?: string
  collections?: CollectionTab[]
  professionalCount?: number
  guestCount?: number
}

export interface UseGallerySearchFiltersParams {
  photos: GalleryPhoto[]
  selectedCollection: CollectionTab
}

export interface UseGallerySearchFiltersResult {
  searchQuery: string
  faceFilter: string | null
  setSearchQuery: Dispatch<SetStateAction<string>>
  setFaceFilter: Dispatch<SetStateAction<string | null>>
  deferredSearchQuery: string
  albumOrderedPhotos: GalleryPhoto[]
  collectionScopedPhotos: GalleryPhoto[]
  filteredPhotos: GalleryPhoto[]
  detectedFaces: DetectedFace[]
  handleFaceFilter: (faceName: string) => void
  clearFaceFilter: () => void
  clearAllFilters: () => void
  hasActiveFilters: boolean
}

export function useGallerySearchFilters({
  photos,
  selectedCollection,
}: UseGallerySearchFiltersParams): UseGallerySearchFiltersResult {
  const [searchQuery, setSearchQuery] = useState('')
  const [faceFilter, setFaceFilter] = useState<string | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const albumOrderedPhotos = useMemo(
    () =>
      [...photos].sort((a, b) => {
        const leftOrder = Number.isFinite(a.albumSortOrder)
          ? Number(a.albumSortOrder)
          : Number.MAX_SAFE_INTEGER
        const rightOrder = Number.isFinite(b.albumSortOrder)
          ? Number(b.albumSortOrder)
          : Number.MAX_SAFE_INTEGER

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      }),
    [photos]
  )

  const collectionScopedPhotos = useMemo(() => {
    return albumOrderedPhotos.filter(photo => photo.collection === selectedCollection)
  }, [albumOrderedPhotos, selectedCollection])

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    return collectionScopedPhotos.filter(photo => {
      const searchableText = [
        photo.caption,
        photo.location,
        photo.photographer,
        photo.collection,
        photo.source,
        ...(photo.faces || []).map((face: PhotoFace) => face.name),
        ...(photo.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery)
      const matchesFace =
        !faceFilter ||
        photo.faces?.some((f: PhotoFace) => resolveAlias(f.name) === resolveAlias(faceFilter))

      return matchesSearch && matchesFace
    })
  }, [collectionScopedPhotos, deferredSearchQuery, faceFilter])

  const detectedFaces = useMemo<DetectedFace[]>(
    () =>
      Array.from(
        photos
          .reduce<Map<string, DetectedFace>>((acc, photo) => {
            for (const face of photo.faces || []) {
              const resolvedName = resolveAlias(face.name)
              const existing = acc.get(resolvedName)
              if (existing) {
                existing.photoCount += 1
                if (!existing.thumbnail) {
                  existing.thumbnail = photo.thumbnail || photo.url
                }
                if (!existing.latestMoment && photo.caption) {
                  existing.latestMoment = photo.caption
                }
                if (!existing.collections?.includes(photo.collection)) {
                  existing.collections = [...(existing.collections || []), photo.collection]
                }
                if (photo.source === 'professional') {
                  existing.professionalCount = (existing.professionalCount || 0) + 1
                } else {
                  existing.guestCount = (existing.guestCount || 0) + 1
                }
              } else {
                acc.set(resolvedName, {
                  id: face.id || resolvedName.toLowerCase().replace(/\s+/g, '-'),
                  name: resolvedName,
                  photoCount: 1,
                  thumbnail: photo.thumbnail || photo.url,
                  latestMoment: photo.caption,
                  collections: [photo.collection],
                  professionalCount: photo.source === 'professional' ? 1 : 0,
                  guestCount: photo.source === 'guest' ? 1 : 0,
                })
              }
            }

            return acc
          }, new Map())
          .values()
      ).sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name)),
    [photos]
  )

  const handleFaceFilter = useCallback((faceName: string) => {
    setFaceFilter(faceName)
    setSearchQuery('')
  }, [])

  const clearFaceFilter = useCallback(() => {
    setFaceFilter(null)
  }, [])

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
    setFaceFilter(null)
  }, [])

  const hasActiveFilters = Boolean(searchQuery || faceFilter)

  return {
    searchQuery,
    faceFilter,
    setSearchQuery,
    setFaceFilter,
    deferredSearchQuery,
    albumOrderedPhotos,
    collectionScopedPhotos,
    filteredPhotos,
    detectedFaces,
    handleFaceFilter,
    clearFaceFilter,
    clearAllFilters,
    hasActiveFilters,
  }
}
