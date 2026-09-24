/**
 * useGallerySearchFilters — extracted from src/pages/Gallery.tsx.
 *
 * Owns the search filter state and the pure-derived pipelines:
 *   album-ordered photos → collection-scoped photos → search-filtered photos.
 *
 * Returns:
 *   searchQuery / setSearchQuery:   controlled filter state
 *   deferredSearchQuery:            useDeferredValue(searchQuery) — kept here
 *                                   because consumers (infinite scroll, auto-scroll)
 *                                   want it grouped with the filter state
 *   albumOrderedPhotos:             full photos, sorted by albumSortOrder / createdAt
 *   collectionScopedPhotos:         album-ordered, filtered to the active collection
 *   filteredPhotos:                 collection-scoped, filtered by search
 *   clearAllFilters:                clear the search filter
 *   hasActiveFilters:               true if search is active
 *
 * NOTE: this hook is intentionally read-only on `photos` and `selectedCollection`.
 * The page wires `selectedCollection` from useGalleryToolbar. Splitting like this
 * keeps the hooks single-purpose and independently testable.
 */
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CollectionTab, GalleryPhoto } from '@/components/gallery/constants'
import type { PhotoFace } from '@/lib/supabase'

export interface UseGallerySearchFiltersParams {
  photos: GalleryPhoto[]
  selectedCollection: CollectionTab
}

export interface UseGallerySearchFiltersResult {
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  deferredSearchQuery: string
  albumOrderedPhotos: GalleryPhoto[]
  collectionScopedPhotos: GalleryPhoto[]
  filteredPhotos: GalleryPhoto[]
  clearAllFilters: () => void
  hasActiveFilters: boolean
}

export function useGallerySearchFilters({
  photos,
  selectedCollection,
}: UseGallerySearchFiltersParams): UseGallerySearchFiltersResult {
  const [searchQuery, setSearchQuery] = useState('')
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

      return !normalizedQuery || searchableText.includes(normalizedQuery)
    })
  }, [collectionScopedPhotos, deferredSearchQuery])

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
  }, [])

  const hasActiveFilters = Boolean(searchQuery)

  return {
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    albumOrderedPhotos,
    collectionScopedPhotos,
    filteredPhotos,
    clearAllFilters,
    hasActiveFilters,
  }
}
