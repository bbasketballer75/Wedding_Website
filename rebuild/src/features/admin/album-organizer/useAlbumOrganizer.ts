import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PHOTO_ALBUMS, type PhotoAlbum } from '@/shared/data/photos'
import {
  albumOrganizerData,
  type AlbumOrganizerData,
  type OrganizerPhoto,
  type StagedAlbumDeletion,
  type StagedAlbumMove,
} from './album-organizer-data'
import {
  buildSaveRequest,
  countReorderedPositions,
  filterOrganizerPhotos,
  hasDirtyChanges,
  movePhotoByOffset,
  moveSelectedAfter,
  moveSelectedToBoundary,
  moveSelectOptions,
  reorderPhotos,
} from './organizer-utils'

/**
 * Album organizer state machine, ported from the frozen
 * `src/components/admin/useAlbumOrganizer.ts`.
 *
 * Behaviour preserved:
 * - all four albums are selectable with exact counts;
 * - the first album (`Engagement`) loads on mount; other albums lazy-load once;
 * - reorder is available for the whole album only while the search box is empty
 *   (`canDrag`), with keyboard and pointer paths sharing `reorderPhotos`;
 * - moves and deletions are staged in the draft (never mutating `saved`) and
 *   only the dirty diff is handed to `saveAlbumOrganization`;
 * - the save summary mirrors the frozen wording.
 *
 * Data is injected through `AlbumOrganizerData`; the default binding is the
 * Wave-3 data layer and tests pass `ALBUM_ORGANIZER_FIXTURES`.
 */

export interface AlbumOrganizerDraft {
  readonly saved: readonly OrganizerPhoto[]
  readonly draft: readonly OrganizerPhoto[]
  readonly moves: readonly StagedAlbumMove[]
  readonly deletes: readonly StagedAlbumDeletion[]
  readonly selectedIds: readonly string[]
}

const EMPTY_DRAFT: AlbumOrganizerDraft = {
  saved: [],
  draft: [],
  moves: [],
  deletes: [],
  selectedIds: [],
}

export interface UseAlbumOrganizerOptions {
  /** Injected data seam; defaults to the typed Wave-3 data layer. */
  readonly data?: AlbumOrganizerData
}

export interface UseAlbumOrganizerResult {
  selectedAlbum: PhotoAlbum
  countsByAlbum: Record<PhotoAlbum, number>
  loadingAlbum: PhotoAlbum | null
  savingAlbum: PhotoAlbum | null
  lastSavedSummary: string
  saveError: string | null
  searchQuery: string
  bulkMoveAlbum: PhotoAlbum | ''
  bulkAfterTargetId: string
  currentSaved: readonly OrganizerPhoto[]
  currentDraft: readonly OrganizerPhoto[]
  pendingMoves: readonly StagedAlbumMove[]
  pendingDeletes: readonly StagedAlbumDeletion[]
  selectedPhotoIds: readonly string[]
  selectedPhotoIdSet: ReadonlySet<string>
  hasUnsavedChanges: boolean
  canDrag: boolean
  reorderCount: number
  filteredDraft: readonly OrganizerPhoto[]
  selectedPhotos: readonly OrganizerPhoto[]
  moveAfterOptions: readonly OrganizerPhoto[]
  moveTargetOptions: readonly PhotoAlbum[]
  selectAlbum: (album: PhotoAlbum) => void
  setSearchQuery: (query: string) => void
  setBulkMoveAlbum: (album: PhotoAlbum | '') => void
  setBulkAfterTargetId: (photoId: string) => void
  toggleSelected: (photoId: string) => void
  selectVisible: () => void
  clearSelection: () => void
  reorder: (activeId: string, overId: string) => void
  movePhotoBy: (photoId: string, offset: -1 | 1) => void
  movePhotoToAlbum: (photoId: string, targetAlbum: PhotoAlbum) => void
  bulkMoveSelected: (targetAlbum: PhotoAlbum) => void
  undoMove: (photoId: string) => void
  deletePhoto: (photoId: string) => void
  bulkDeleteSelected: () => void
  undoDelete: (photoId: string) => void
  moveSelectedToBoundary: (placement: 'top' | 'bottom') => void
  moveSelectedAfterAnchor: (anchorPhotoId: string) => void
  resetDraft: () => void
  save: () => Promise<void>
}

const FIRST_ALBUM: PhotoAlbum = PHOTO_ALBUMS[0] ?? 'Engagement'

function initialCounts(): Record<PhotoAlbum, number> {
  return { Engagement: 0, 'Bach+ette': 0, 'Wedding Day': 0, 'Guest Uploads': 0 }
}

function withSelection(
  draft: AlbumOrganizerDraft,
  selectedIds: readonly string[]
): AlbumOrganizerDraft {
  return { ...draft, selectedIds }
}

export function useAlbumOrganizer(options: UseAlbumOrganizerOptions = {}): UseAlbumOrganizerResult {
  const data = options.data ?? albumOrganizerData

  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum>(FIRST_ALBUM)
  const [draftsByAlbum, setDraftsByAlbum] = useState<
    Partial<Record<PhotoAlbum, AlbumOrganizerDraft>>
  >({})
  const [countsByAlbum, setCountsByAlbum] = useState<Record<PhotoAlbum, number>>(initialCounts)
  const [loadingAlbum, setLoadingAlbum] = useState<PhotoAlbum | null>(FIRST_ALBUM)
  const [savingAlbum, setSavingAlbum] = useState<PhotoAlbum | null>(null)
  const [lastSavedSummary, setLastSavedSummary] = useState('No organizer changes saved yet.')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [bulkMoveAlbum, setBulkMoveAlbum] = useState<PhotoAlbum | ''>('')
  const [bulkAfterTargetId, setBulkAfterTargetId] = useState('')

  const inFlightRef = useRef<Set<PhotoAlbum>>(new Set<PhotoAlbum>())
  const loadedRef = useRef<Set<PhotoAlbum>>(new Set<PhotoAlbum>())

  const refreshCounts = useCallback(async (): Promise<void> => {
    try {
      const counts = await data.fetchAlbumCounts()
      setCountsByAlbum(counts)
    } catch (error) {
      console.error('Album organizer: could not load album counts.', error)
    }
  }, [data])

  const fetchAlbum = useCallback(
    async (album: PhotoAlbum): Promise<void> => {
      if (inFlightRef.current.has(album) || loadedRef.current.has(album)) return
      inFlightRef.current.add(album)

      try {
        const photos = await data.fetchAlbumPhotos(album)
        loadedRef.current.add(album)
        setDraftsByAlbum(previous => ({
          ...previous,
          [album]: {
            saved: photos,
            draft: photos,
            moves: [],
            deletes: [],
            selectedIds: [],
          },
        }))
      } catch (error) {
        console.error(`Album organizer: could not load the ${album} album.`, error)
        setSaveError(`Could not load the ${album} album.`)
      } finally {
        inFlightRef.current.delete(album)
        setLoadingAlbum(current => (current === album ? null : current))
      }
    },
    [data]
  )

  // Initial load: exact counts + the first album. The deferred callbacks keep
  // the first paint free of synchronous state updates (the frozen hook uses the
  // same `setTimeout(…, 0)` deferral); state is only written after the reads
  // resolve.
  useEffect(() => {
    const countsTimer = window.setTimeout(() => {
      void refreshCounts()
    }, 0)
    const albumTimer = window.setTimeout(() => {
      void fetchAlbum(FIRST_ALBUM)
    }, 0)

    return () => {
      window.clearTimeout(countsTimer)
      window.clearTimeout(albumTimer)
    }
  }, [fetchAlbum, refreshCounts])

  const current = draftsByAlbum[selectedAlbum] ?? EMPTY_DRAFT
  const selectedPhotoIdSet = useMemo(() => new Set(current.selectedIds), [current.selectedIds])
  const hasUnsavedChanges = hasDirtyChanges({
    album: selectedAlbum,
    saved: current.saved,
    draft: current.draft,
    pendingMoves: current.moves,
    pendingDeletes: current.deletes,
  })
  const canDrag = searchQuery.trim().length === 0
  const reorderCount = countReorderedPositions(current.saved, current.draft)

  const filteredDraft = useMemo(
    () => filterOrganizerPhotos(current.draft, searchQuery),
    [current.draft, searchQuery]
  )
  const selectedPhotos = useMemo(
    () => current.draft.filter(photo => selectedPhotoIdSet.has(photo.id)),
    [current.draft, selectedPhotoIdSet]
  )
  const moveAfterOptions = useMemo(
    () => current.draft.filter(photo => !selectedPhotoIdSet.has(photo.id)),
    [current.draft, selectedPhotoIdSet]
  )

  // Unsaved-changes guard: warn on a real unload while the draft is dirty.
  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return undefined

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const updateCurrentDraft = useCallback(
    (updater: (draft: AlbumOrganizerDraft) => AlbumOrganizerDraft): void => {
      setDraftsByAlbum(previous => ({
        ...previous,
        [selectedAlbum]: updater(previous[selectedAlbum] ?? EMPTY_DRAFT),
      }))
    },
    [selectedAlbum]
  )

  const clearBulkState = useCallback((): void => {
    setBulkMoveAlbum('')
    setBulkAfterTargetId('')
  }, [])

  const selectAlbum = useCallback(
    (album: PhotoAlbum): void => {
      setSelectedAlbum(album)
      setSearchQuery('')
      clearBulkState()
      if (!loadedRef.current.has(album)) {
        setLoadingAlbum(album)
        void fetchAlbum(album)
      }
    },
    [clearBulkState, fetchAlbum]
  )

  const toggleSelected = useCallback(
    (photoId: string): void => {
      updateCurrentDraft(draft =>
        withSelection(
          draft,
          draft.selectedIds.includes(photoId)
            ? draft.selectedIds.filter(currentId => currentId !== photoId)
            : [...draft.selectedIds, photoId]
        )
      )
    },
    [updateCurrentDraft]
  )

  const selectVisible = useCallback((): void => {
    updateCurrentDraft(draft =>
      withSelection(
        draft,
        filteredDraft.map(photo => photo.id)
      )
    )
  }, [filteredDraft, updateCurrentDraft])

  const clearSelection = useCallback((): void => {
    updateCurrentDraft(draft => withSelection(draft, []))
    clearBulkState()
  }, [clearBulkState, updateCurrentDraft])

  const reorder = useCallback(
    (activeId: string, overId: string): void => {
      if (!canDrag) return
      updateCurrentDraft(draft => ({
        ...draft,
        draft: reorderPhotos(draft.draft, activeId, overId),
      }))
    },
    [canDrag, updateCurrentDraft]
  )

  const movePhotoBy = useCallback(
    (photoId: string, offset: -1 | 1): void => {
      if (!canDrag) return
      updateCurrentDraft(draft => ({
        ...draft,
        draft: movePhotoByOffset(draft.draft, photoId, offset),
      }))
    },
    [canDrag, updateCurrentDraft]
  )

  const stageMoves = useCallback(
    (photoIds: readonly string[], targetAlbum: PhotoAlbum): void => {
      if (photoIds.length === 0) return
      updateCurrentDraft(draft => {
        const moving = draft.draft.filter(photo => photoIds.includes(photo.id))
        if (moving.length === 0) return draft
        return {
          ...draft,
          draft: draft.draft.filter(photo => !photoIds.includes(photo.id)),
          moves: [...draft.moves, ...moving.map(photo => ({ photo, targetAlbum }))],
          selectedIds: draft.selectedIds.filter(id => !photoIds.includes(id)),
        }
      })
      clearBulkState()
    },
    [clearBulkState, updateCurrentDraft]
  )

  const movePhotoToAlbum = useCallback(
    (photoId: string, targetAlbum: PhotoAlbum): void => {
      stageMoves([photoId], targetAlbum)
    },
    [stageMoves]
  )

  const bulkMoveSelected = useCallback(
    (targetAlbum: PhotoAlbum): void => {
      stageMoves(
        selectedPhotos.map(photo => photo.id),
        targetAlbum
      )
    },
    [selectedPhotos, stageMoves]
  )

  const undoMove = useCallback(
    (photoId: string): void => {
      updateCurrentDraft(draft => {
        const move = draft.moves.find(candidate => candidate.photo.id === photoId)
        if (!move) return draft
        return {
          ...draft,
          moves: draft.moves.filter(candidate => candidate.photo.id !== photoId),
          draft: [...draft.draft, move.photo],
        }
      })
    },
    [updateCurrentDraft]
  )

  const deletePhoto = useCallback(
    (photoId: string): void => {
      updateCurrentDraft(draft => {
        const photo = draft.draft.find(candidate => candidate.id === photoId)
        if (!photo) return draft
        return {
          ...draft,
          draft: draft.draft.filter(candidate => candidate.id !== photoId),
          deletes: [...draft.deletes, { photo }],
          selectedIds: draft.selectedIds.filter(id => id !== photoId),
        }
      })
    },
    [updateCurrentDraft]
  )

  const bulkDeleteSelected = useCallback((): void => {
    updateCurrentDraft(draft => {
      const selectedIds = new Set(draft.selectedIds)
      if (selectedIds.size === 0) return draft
      const deleting = draft.draft.filter(photo => selectedIds.has(photo.id))
      return {
        ...draft,
        draft: draft.draft.filter(photo => !selectedIds.has(photo.id)),
        deletes: [...draft.deletes, ...deleting.map(photo => ({ photo }))],
        selectedIds: [],
      }
    })
    clearBulkState()
  }, [clearBulkState, updateCurrentDraft])

  const undoDelete = useCallback(
    (photoId: string): void => {
      updateCurrentDraft(draft => {
        const deletion = draft.deletes.find(candidate => candidate.photo.id === photoId)
        if (!deletion) return draft
        return {
          ...draft,
          deletes: draft.deletes.filter(candidate => candidate.photo.id !== photoId),
          draft: [...draft.draft, deletion.photo],
        }
      })
    },
    [updateCurrentDraft]
  )

  const moveSelectedToBoundaryHandler = useCallback(
    (placement: 'top' | 'bottom'): void => {
      updateCurrentDraft(draft => ({
        ...draft,
        draft: moveSelectedToBoundary(draft.draft, new Set(draft.selectedIds), placement),
      }))
    },
    [updateCurrentDraft]
  )

  const moveSelectedAfterAnchor = useCallback(
    (anchorPhotoId: string): void => {
      updateCurrentDraft(draft => ({
        ...draft,
        draft: moveSelectedAfter(draft.draft, new Set(draft.selectedIds), anchorPhotoId),
      }))
      setBulkAfterTargetId('')
    },
    [updateCurrentDraft]
  )

  const resetDraft = useCallback((): void => {
    updateCurrentDraft(draft => ({
      saved: draft.saved,
      draft: draft.saved,
      moves: [],
      deletes: [],
      selectedIds: [],
    }))
    clearBulkState()
  }, [clearBulkState, updateCurrentDraft])

  const save = useCallback(async (): Promise<void> => {
    if (!hasUnsavedChanges || savingAlbum !== null) return

    const request = buildSaveRequest({
      album: selectedAlbum,
      saved: current.saved,
      draft: current.draft,
      pendingMoves: current.moves,
      pendingDeletes: current.deletes,
    })

    setSavingAlbum(selectedAlbum)
    setSaveError(null)

    try {
      const result = await data.saveAlbumOrganization(request)

      setDraftsByAlbum(previous => {
        const next = { ...previous }
        next[selectedAlbum] = {
          saved: current.draft,
          draft: current.draft,
          moves: [],
          deletes: [],
          selectedIds: [],
        }
        // Target albums gained photos; drop their cache so the next selection
        // re-reads them (frozen hook reloads them eagerly; lazy is equivalent).
        for (const move of request.moves) {
          delete next[move.targetAlbum]
          loadedRef.current.delete(move.targetAlbum)
        }
        return next
      })

      const deletedSuffix =
        result.deletedCount > 0
          ? ` Deleted ${result.deletedCount} photo${result.deletedCount === 1 ? '' : 's'}.`
          : ''
      setLastSavedSummary(
        `Saved ${selectedAlbum} on ${new Date().toLocaleString()}.${deletedSuffix}`
      )

      await refreshCounts()
    } catch (error) {
      console.error('Album organizer: could not save the album arrangement.', error)
      setSaveError(`Could not save the ${selectedAlbum} arrangement.`)
    } finally {
      setSavingAlbum(null)
    }
  }, [current, data, hasUnsavedChanges, refreshCounts, savingAlbum, selectedAlbum])

  return {
    selectedAlbum,
    countsByAlbum,
    loadingAlbum,
    savingAlbum,
    lastSavedSummary,
    saveError,
    searchQuery,
    bulkMoveAlbum,
    bulkAfterTargetId,
    currentSaved: current.saved,
    currentDraft: current.draft,
    pendingMoves: current.moves,
    pendingDeletes: current.deletes,
    selectedPhotoIds: current.selectedIds,
    selectedPhotoIdSet,
    hasUnsavedChanges,
    canDrag,
    reorderCount,
    filteredDraft,
    selectedPhotos,
    moveAfterOptions,
    moveTargetOptions: moveSelectOptions(selectedAlbum),
    selectAlbum,
    setSearchQuery,
    setBulkMoveAlbum,
    setBulkAfterTargetId,
    toggleSelected,
    selectVisible,
    clearSelection,
    reorder,
    movePhotoBy,
    movePhotoToAlbum,
    bulkMoveSelected,
    undoMove,
    deletePhoto,
    bulkDeleteSelected,
    undoDelete,
    moveSelectedToBoundary: moveSelectedToBoundaryHandler,
    moveSelectedAfterAnchor,
    resetDraft,
    save,
  }
}
