import { useCallback, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { collectionMeta, collectionTabs, type CollectionTab, type ViewMode } from './constants'

/**
 * Port of the frozen `useGalleryToolbar`: view mode, select mode, active
 * collection tab, collection-switch direction and the frozen empty-state copy.
 * The frozen hook tracked the animation direction in a ref; here it is state
 * (passing a ref's `current` through render is disallowed by react-hooks v7).
 */
export interface UseGalleryToolbarResult {
  viewMode: ViewMode
  setViewMode: (next: ViewMode) => void
  selectMode: boolean
  setSelectMode: (next: boolean) => void
  selectedCollection: CollectionTab
  setSelectedCollection: Dispatch<SetStateAction<CollectionTab>>
  handleCollectionChange: (tab: CollectionTab) => void
  collectionSwitchDirection: number
  emptyStateTitle: string
  emptyStateBody: string
}

export function useGalleryToolbar({
  initialCollection = 'Proposal',
  initialViewMode = 'masonry',
  initialSelectMode = false,
}: {
  initialCollection?: CollectionTab
  initialViewMode?: ViewMode
  initialSelectMode?: boolean
} = {}): UseGalleryToolbarResult {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [selectMode, setSelectMode] = useState(initialSelectMode)
  const [selectedCollection, setSelectedCollection] = useState<CollectionTab>(initialCollection)
  const lastCollectionIndexRef = useRef(collectionTabs.indexOf(initialCollection))
  const [collectionSwitchDirection, setCollectionSwitchDirection] = useState(0)

  const handleCollectionChange = useCallback((tab: CollectionTab) => {
    const newIndex = collectionTabs.indexOf(tab)
    setCollectionSwitchDirection(newIndex > lastCollectionIndexRef.current ? 1 : -1)
    lastCollectionIndexRef.current = newIndex
    setSelectedCollection(tab)
  }, [])

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
    collectionSwitchDirection,
    emptyStateTitle,
    emptyStateBody,
  }
}
