import { useEffect, useMemo, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  fetchAlbumPhotos,
  fetchPhotoAlbumCounts,
  fetchPhotoEngagementSummary,
  saveAlbumOrganization,
  type AlbumOrganizerMoveInput,
  type PhotoAlbum,
} from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import {
  EMPTY_ORGANIZER_PHOTOS,
  EMPTY_PENDING_DELETIONS,
  EMPTY_PENDING_MOVES,
  EMPTY_SELECTED_IDS,
  countReorderedPositions,
  hydratePhotoEngagement,
  normalizeOrganizerPhoto,
  photosHaveSameOrder,
  type OrganizerPhoto,
  type PendingAlbumDeletion,
  type PendingAlbumMove,
} from './organizerUtils'

export interface UseAlbumOrganizerResult {
  // selection
  selectedAlbum: PhotoAlbum
  setSelectedAlbum: (album: PhotoAlbum) => void
  // data
  countsByAlbum: Record<PhotoAlbum, number>
  loadingAlbum: PhotoAlbum | null
  savingAlbum: PhotoAlbum | null
  lastSavedSummary: string
  searchQuery: string
  setSearchQuery: (q: string) => void
  bulkMoveAlbum: PhotoAlbum | ''
  setBulkMoveAlbum: (a: PhotoAlbum | '') => void
  bulkAfterTargetId: string
  setBulkAfterTargetId: (id: string) => void
  // derived
  currentSaved: OrganizerPhoto[]
  currentDraft: OrganizerPhoto[]
  pendingMoves: PendingAlbumMove[]
  pendingDeletes: PendingAlbumDeletion[]
  selectedPhotoIds: string[]
  selectedPhotoIdSet: Set<string>
  hasUnsavedChanges: boolean
  canDrag: boolean
  reorderCount: number
  filteredDraft: OrganizerPhoto[]
  selectedPhotos: OrganizerPhoto[]
  moveAfterOptions: OrganizerPhoto[]
  // actions
  setSelectedPhotoIds: (ids: string[]) => void
  handleToggleSelected: (photoId: string) => void
  handleSelectVisible: () => void
  handleClearSelection: () => void
  handleDragEnd: (event: DragEndEvent) => void
  handleMovePhoto: (photoId: string, targetAlbum: PhotoAlbum) => void
  handleBulkMove: (targetAlbum: PhotoAlbum) => void
  handleUndoMove: (photoId: string) => void
  handleDeletePhoto: (photoId: string) => void
  handleBulkDelete: () => void
  handleUndoDelete: (photoId: string) => void
  handleMoveSelectedToBoundary: (placement: 'top' | 'bottom') => void
  handleMoveSelectedAfter: (anchorPhotoId: string) => void
  handleReset: () => void
  handleSave: () => Promise<void>
}

export function useAlbumOrganizer(): UseAlbumOrganizerResult {
  const { addToast } = useToast()
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum>('Engagement')
  const [savedByAlbum, setSavedByAlbum] = useState<Partial<Record<PhotoAlbum, OrganizerPhoto[]>>>(
    {}
  )
  const [draftByAlbum, setDraftByAlbum] = useState<Partial<Record<PhotoAlbum, OrganizerPhoto[]>>>(
    {}
  )
  const [pendingMovesByAlbum, setPendingMovesByAlbum] = useState<
    Partial<Record<PhotoAlbum, PendingAlbumMove[]>>
  >({})
  const [pendingDeletesByAlbum, setPendingDeletesByAlbum] = useState<
    Partial<Record<PhotoAlbum, PendingAlbumDeletion[]>>
  >({})
  const [selectedPhotoIdsByAlbum, setSelectedPhotoIdsByAlbum] = useState<
    Partial<Record<PhotoAlbum, string[]>>
  >({})
  const [bulkMoveAlbum, setBulkMoveAlbum] = useState<PhotoAlbum | ''>('')
  const [bulkAfterTargetId, setBulkAfterTargetId] = useState('')
  const [countsByAlbum, setCountsByAlbum] = useState<Record<PhotoAlbum, number>>({
    Engagement: 0,
    'Bach+ette': 0,
    'Wedding Day': 0,
    'Guest Uploads': 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingAlbum, setLoadingAlbum] = useState<PhotoAlbum | null>(null)
  const [savingAlbum, setSavingAlbum] = useState<PhotoAlbum | null>(null)
  const [lastSavedSummary, setLastSavedSummary] = useState('No organizer changes saved yet.')

  const refreshCounts = async () => {
    const nextCounts = await fetchPhotoAlbumCounts()
    setCountsByAlbum(nextCounts)
  }

  const loadAlbum = async (album: PhotoAlbum, force = false) => {
    if (!force && savedByAlbum[album]) {
      return
    }

    setLoadingAlbum(album)
    const { data, error } = await fetchAlbumPhotos(album)

    if (error) {
      addToast(`Could not load the ${album} album.`, 'error')
      setLoadingAlbum(null)
      return
    }

    const normalizedPhotos = (data || []).map(normalizeOrganizerPhoto)
    const { data: summaryRows } =
      normalizedPhotos.length > 0
        ? await fetchPhotoEngagementSummary(normalizedPhotos.map(photo => photo.id))
        : { data: [] }

    const hydratedPhotos = hydratePhotoEngagement(
      normalizedPhotos,
      Array.isArray(summaryRows) ? summaryRows : []
    )

    setSavedByAlbum(prev => ({ ...prev, [album]: hydratedPhotos }))
    setDraftByAlbum(prev => ({ ...prev, [album]: hydratedPhotos }))
    setPendingMovesByAlbum(prev => ({ ...prev, [album]: [] }))
    setPendingDeletesByAlbum(prev => ({ ...prev, [album]: [] }))
    setSelectedPhotoIdsByAlbum(prev => ({ ...prev, [album]: [] }))
    setLoadingAlbum(null)
  }

  useEffect(() => {
    void refreshCounts()
    void loadAlbum(selectedAlbum)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadAlbum(selectedAlbum)
    setSearchQuery('')
    setBulkMoveAlbum('')
    setBulkAfterTargetId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum])

  const currentSaved = savedByAlbum[selectedAlbum] ?? EMPTY_ORGANIZER_PHOTOS
  const currentDraft = draftByAlbum[selectedAlbum] ?? EMPTY_ORGANIZER_PHOTOS
  const pendingMoves = pendingMovesByAlbum[selectedAlbum] ?? EMPTY_PENDING_MOVES
  const pendingDeletes = pendingDeletesByAlbum[selectedAlbum] ?? EMPTY_PENDING_DELETIONS
  const selectedPhotoIds = selectedPhotoIdsByAlbum[selectedAlbum] ?? EMPTY_SELECTED_IDS
  const selectedPhotoIdSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds])
  const hasUnsavedChanges =
    pendingMoves.length > 0 ||
    pendingDeletes.length > 0 ||
    !photosHaveSameOrder(currentSaved, currentDraft)
  const canDrag = searchQuery.trim().length === 0
  const reorderCount = countReorderedPositions(currentSaved, currentDraft)

  const filteredDraft = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) {
      return currentDraft
    }

    return currentDraft.filter(photo => {
      const haystack = [
        photo.displayLabel,
        photo.location,
        photo.photographer,
        ...(photo.tags || []),
        photo.url,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [currentDraft, searchQuery])

  const selectedPhotos = useMemo(
    () => currentDraft.filter(photo => selectedPhotoIdSet.has(photo.id)),
    [currentDraft, selectedPhotoIdSet]
  )

  const moveAfterOptions = useMemo(
    () => currentDraft.filter(photo => !selectedPhotoIdSet.has(photo.id)),
    [currentDraft, selectedPhotoIdSet]
  )

  const setSelectedPhotoIds = (nextIds: string[]) => {
    setSelectedPhotoIdsByAlbum(prev => ({ ...prev, [selectedAlbum]: nextIds }))
  }

  const handleToggleSelected = (photoId: string) => {
    setSelectedPhotoIds(
      selectedPhotoIds.includes(photoId)
        ? selectedPhotoIds.filter(currentId => currentId !== photoId)
        : [...selectedPhotoIds, photoId]
    )
  }

  const handleSelectVisible = () => {
    setSelectedPhotoIds(filteredDraft.map(photo => photo.id))
  }

  const handleClearSelection = () => {
    setSelectedPhotoIds([])
    setBulkMoveAlbum('')
    setBulkAfterTargetId('')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !canDrag) {
      return
    }

    const oldIndex = currentDraft.findIndex(photo => photo.id === active.id)
    const newIndex = currentDraft.findIndex(photo => photo.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: arrayMove(currentDraft, oldIndex, newIndex),
    }))
  }

  const handleMovePhoto = (photoId: string, targetAlbum: PhotoAlbum) => {
    const photoToMove = currentDraft.find(photo => photo.id === photoId)
    if (!photoToMove) {
      return
    }

    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: currentDraft.filter(photo => photo.id !== photoId),
    }))
    setPendingMovesByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: [...(prev[selectedAlbum] || []), { photo: photoToMove, targetAlbum }],
    }))
    setSelectedPhotoIds(selectedPhotoIds.filter(currentId => currentId !== photoId))
  }

  const handleBulkMove = (targetAlbum: PhotoAlbum) => {
    if (selectedPhotos.length === 0) {
      return
    }

    const selectedIds = new Set(selectedPhotos.map(photo => photo.id))

    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: currentDraft.filter(photo => !selectedIds.has(photo.id)),
    }))
    setPendingMovesByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: [
        ...(prev[selectedAlbum] || []),
        ...selectedPhotos.map(photo => ({ photo, targetAlbum })),
      ],
    }))
    handleClearSelection()
  }

  const handleUndoMove = (photoId: string) => {
    const moveToUndo = pendingMoves.find(move => move.photo.id === photoId)
    if (!moveToUndo) {
      return
    }

    setPendingMovesByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: (prev[selectedAlbum] || []).filter(move => move.photo.id !== photoId),
    }))
    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: [...(prev[selectedAlbum] || []), moveToUndo.photo],
    }))
  }

  const handleDeletePhoto = (photoId: string) => {
    const photoToDelete = currentDraft.find(photo => photo.id === photoId)
    if (!photoToDelete) {
      return
    }

    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: currentDraft.filter(photo => photo.id !== photoId),
    }))
    setPendingDeletesByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: [...(prev[selectedAlbum] || []), { photo: photoToDelete }],
    }))
    setSelectedPhotoIds(selectedPhotoIds.filter(currentId => currentId !== photoId))
  }

  const handleBulkDelete = () => {
    if (selectedPhotos.length === 0) {
      return
    }

    const selectedIds = new Set(selectedPhotos.map(photo => photo.id))

    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: currentDraft.filter(photo => !selectedIds.has(photo.id)),
    }))
    setPendingDeletesByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: [
        ...(prev[selectedAlbum] || []),
        ...selectedPhotos.map(photo => ({ photo })),
      ],
    }))
    handleClearSelection()
  }

  const handleUndoDelete = (photoId: string) => {
    const deletionToUndo = pendingDeletes.find(deletion => deletion.photo.id === photoId)
    if (!deletionToUndo) {
      return
    }

    setPendingDeletesByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: (prev[selectedAlbum] || []).filter(
        deletion => deletion.photo.id !== photoId
      ),
    }))
    setDraftByAlbum(prev => ({
      ...prev,
      [selectedAlbum]: [...(prev[selectedAlbum] || []), deletionToUndo.photo],
    }))
  }

  const handleMoveSelectedToBoundary = (placement: 'top' | 'bottom') => {
    if (selectedPhotos.length === 0) {
      return
    }

    const selectedIds = new Set(selectedPhotos.map(photo => photo.id))
    const remainingPhotos = currentDraft.filter(photo => !selectedIds.has(photo.id))
    const nextDraft =
      placement === 'top'
        ? [...selectedPhotos, ...remainingPhotos]
        : [...remainingPhotos, ...selectedPhotos]

    setDraftByAlbum(prev => ({ ...prev, [selectedAlbum]: nextDraft }))
  }

  const handleMoveSelectedAfter = (anchorPhotoId: string) => {
    if (selectedPhotos.length === 0 || !anchorPhotoId) {
      return
    }

    const selectedIds = new Set(selectedPhotos.map(photo => photo.id))
    const remainingPhotos = currentDraft.filter(photo => !selectedIds.has(photo.id))
    const anchorIndex = remainingPhotos.findIndex(photo => photo.id === anchorPhotoId)

    if (anchorIndex < 0) {
      return
    }

    const nextDraft = [
      ...remainingPhotos.slice(0, anchorIndex + 1),
      ...selectedPhotos,
      ...remainingPhotos.slice(anchorIndex + 1),
    ]

    setDraftByAlbum(prev => ({ ...prev, [selectedAlbum]: nextDraft }))
    setBulkAfterTargetId('')
  }

  const handleReset = () => {
    setDraftByAlbum(prev => ({ ...prev, [selectedAlbum]: currentSaved }))
    setPendingMovesByAlbum(prev => ({ ...prev, [selectedAlbum]: [] }))
    setPendingDeletesByAlbum(prev => ({ ...prev, [selectedAlbum]: [] }))
    handleClearSelection()
  }

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      return
    }

    setSavingAlbum(selectedAlbum)
    const movesPayload: AlbumOrganizerMoveInput[] = pendingMoves.map(move => ({
      photoId: move.photo.id,
      targetAlbum: move.targetAlbum,
    }))

    const { data, error } = await saveAlbumOrganization(
      selectedAlbum,
      currentDraft.map(photo => photo.id),
      movesPayload,
      pendingDeletes.map(deletion => deletion.photo.id)
    )

    if (error) {
      addToast(`Could not save the ${selectedAlbum} arrangement.`, 'error')
      setSavingAlbum(null)
      return
    }

    const nowLabel = new Date().toLocaleString()
    setLastSavedSummary(
      `Saved ${selectedAlbum} on ${nowLabel}.${data?.deleted_count ? ` Deleted ${data.deleted_count} photo${data.deleted_count === 1 ? '' : 's'}.` : ''}`
    )

    const touchedTargets = Array.from(new Set(movesPayload.map(move => move.targetAlbum)))

    const applySaved = (prev: Partial<Record<PhotoAlbum, OrganizerPhoto[]>>) => {
      const next = { ...prev }
      next[selectedAlbum] = currentDraft.map((photo, index) => ({
        ...photo,
        album: selectedAlbum,
        album_sort_order: index + 1,
      }))

      for (const move of pendingMoves) {
        if (!next[move.targetAlbum]) {
          continue
        }

        next[move.targetAlbum] = [
          ...(next[move.targetAlbum] || []),
          {
            ...move.photo,
            album: move.targetAlbum,
            category: move.targetAlbum,
            album_sort_order: (next[move.targetAlbum] || []).length + 1,
          },
        ]
      }

      return next
    }

    setSavedByAlbum(applySaved)
    setDraftByAlbum(applySaved)
    setPendingMovesByAlbum(prev => ({ ...prev, [selectedAlbum]: [] }))
    setPendingDeletesByAlbum(prev => ({ ...prev, [selectedAlbum]: [] }))
    setSelectedPhotoIdsByAlbum(prev => ({ ...prev, [selectedAlbum]: [] }))

    if (touchedTargets.length > 0) {
      await Promise.all(touchedTargets.map(album => loadAlbum(album, true)))
    }

    await loadAlbum(selectedAlbum, true)
    await refreshCounts()

    addToast(
      data
        ? `Saved ${selectedAlbum}.${data.moved_count > 0 ? ` ${data.moved_count} photo${data.moved_count === 1 ? '' : 's'} moved.` : ''}${data.deleted_count > 0 ? ` ${data.deleted_count} photo${data.deleted_count === 1 ? '' : 's'} deleted.` : ''}`
        : `Saved ${selectedAlbum}.`,
      'success'
    )
    setSavingAlbum(null)
  }

  return {
    selectedAlbum,
    setSelectedAlbum,
    countsByAlbum,
    loadingAlbum,
    savingAlbum,
    lastSavedSummary,
    searchQuery,
    setSearchQuery,
    bulkMoveAlbum,
    setBulkMoveAlbum,
    bulkAfterTargetId,
    setBulkAfterTargetId,
    currentSaved,
    currentDraft,
    pendingMoves,
    pendingDeletes,
    selectedPhotoIds,
    selectedPhotoIdSet,
    hasUnsavedChanges,
    canDrag,
    reorderCount,
    filteredDraft,
    selectedPhotos,
    moveAfterOptions,
    setSelectedPhotoIds,
    handleToggleSelected,
    handleSelectVisible,
    handleClearSelection,
    handleDragEnd,
    handleMovePhoto,
    handleBulkMove,
    handleUndoMove,
    handleDeletePhoto,
    handleBulkDelete,
    handleUndoDelete,
    handleMoveSelectedToBoundary,
    handleMoveSelectedAfter,
    handleReset,
    handleSave,
  }
}
