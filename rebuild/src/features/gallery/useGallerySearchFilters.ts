import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CollectionTab } from './constants'
import { matchesGallerySearch, type GalleryPhoto } from './data'

/**
 * Port of the frozen `useGallerySearchFilters` (src/hooks/useGallerySearchFilters.ts):
 * search state + the derived pipeline
 *   album-ordered photos -> collection-scoped photos -> search-filtered photos.
 */
export interface UseGallerySearchFiltersParams {
  photos: GalleryPhoto[]
  selectedCollection: CollectionTab
  /** Initial search term from `?q=` (URL contract handled by the page). */
  initialQuery?: string
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
  initialQuery = '',
}: UseGallerySearchFiltersParams): UseGallerySearchFiltersResult {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
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
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      }),
    [photos]
  )

  const collectionScopedPhotos = useMemo(
    () => albumOrderedPhotos.filter(photo => photo.collection === selectedCollection),
    [albumOrderedPhotos, selectedCollection]
  )

  const filteredPhotos = useMemo(
    () => collectionScopedPhotos.filter(photo => matchesGallerySearch(photo, deferredSearchQuery)),
    [collectionScopedPhotos, deferredSearchQuery]
  )

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    albumOrderedPhotos,
    collectionScopedPhotos,
    filteredPhotos,
    clearAllFilters,
    hasActiveFilters: Boolean(searchQuery),
  }
}
