/**
 * useGalleryToolbar — extracted from src/pages/Gallery.tsx.
 *
 * Owns the toolbar state: viewMode (masonry/grid/timeline), selectMode (the
 * "I'm curating photos to download" toggle), and selectedCollection (which
 * album tab is active). Also owns the collection-switch direction tracking
 * and the empty-state copy derived from the selected collection's metadata.
 *
 * Returns:
 *   viewMode / setViewMode:                    layout toggle
 *   selectMode / setSelectMode:                download-selection toggle
 *   selectedCollection / setSelectedCollection: collection tab (consumed by useGallerySearchFilters)
 *   handleCollectionChange(tab):               setter that also tracks direction
 *   collectionSwitchDirection:                 +1 / -1 for framer-motion animation direction
 *   emptyStateTitle / emptyStateBody:          copy used when a collection has no photos
 *
 * NOTE: this hook intentionally does not own the scroll behavior or the URL-sync
 * effect — those stay in the page because they compose state from multiple hooks.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { collectionMeta, collectionTabs, type CollectionTab } from '@/components/gallery/constants'

export type ViewMode = 'masonry' | 'grid' | 'timeline'

export interface UseGalleryToolbarParams {
  initialCollection?: CollectionTab
}

export interface UseGalleryToolbarResult {
  viewMode: ViewMode
  setViewMode: (next: ViewMode) => void
  selectMode: boolean
  setSelectMode: (next: boolean) => void
  selectedCollection: CollectionTab
  setSelectedCollection: Dispatch<SetStateAction<CollectionTab>>
  handleCollectionChange: (tab: CollectionTab) => void
  collectionSwitchDirectionRef: React.MutableRefObject<number>
  emptyStateTitle: string
  emptyStateBody: string
}

export function useGalleryToolbar({
  initialCollection = 'Proposal',
}: UseGalleryToolbarParams = {}): UseGalleryToolbarResult {
  const [viewMode, setViewMode] = useState<ViewMode>('masonry')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<CollectionTab>(initialCollection)
  const collectionSwitchDirectionRef = useRef(0)

  const handleCollectionChange = useCallback(
    (tab: CollectionTab) => {
      const newIndex = collectionTabs.indexOf(tab)
      const currentIndex = collectionTabs.indexOf(selectedCollection)
      collectionSwitchDirectionRef.current = newIndex > currentIndex ? 1 : -1
      setSelectedCollection(tab)
    },
    [selectedCollection]
  )

  const emptyStateTitle = useMemo(
    () => `${collectionMeta[selectedCollection].title} is waiting for the next upload`,
    [selectedCollection]
  )

  const emptyStateBody = useMemo(
    () =>
      `${collectionMeta[selectedCollection].description} ${collectionMeta[selectedCollection].supporting}`,
    [selectedCollection]
  )

  return {
    viewMode,
    setViewMode,
    selectMode,
    setSelectMode,
    selectedCollection,
    setSelectedCollection,
    handleCollectionChange,
    collectionSwitchDirectionRef,
    emptyStateTitle,
    emptyStateBody,
  }
}
