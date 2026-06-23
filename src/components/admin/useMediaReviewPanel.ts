/**
 * useMediaReviewPanel — orchestrates side effects + handlers for the
 * MediaReviewPanel. Split out so the panel component stays focused on JSX.
 *
 * Responsibilities:
 *  - Load batches on mount
 *  - Load batch details when the selected batch changes
 *  - Load crop previews when selected photo/group changes
 *  - Auto-select the first photo/face/group when nothing is selected
 *  - Provide handlers (refresh, sync, apply, save, reset, navigate, etc.)
 */

import { useEffect, useMemo } from 'react'
import type { MediaReviewBatch, MediaReviewFace } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { useMediaReviewStore } from '@/stores/mediaReviewStore'
import { normalizeFaceDraft, PERSON_GROUP_SAMPLE_LIMIT } from './MediaReviewPanel.helpers'
import {
  handleSyncManifestMetadata,
  handleApplyConfirmedFaces,
} from './ReviewImportManifest'

export function useMediaReviewPanel() {
  const { addToast } = useToast()
  const {
    loading,
    faces,
    photoInspectorOpen,
    setPhotoInspectorOpen,
    loadBatches,
    loadBatchDetails,
    saveFaces,
    handleBatchStatusChange,
    loadCropPreviews,
    faceDrafts,
    cropPreviewUrls,
    updateDraft,
    setSelectedFaceId,
    setSelectedPhotoKey,
    setSelectedGroupFaceId,
    getSelectedBatch,
    getSelectedPhoto,
    getSelectedFace,
    getSelectedGroup,
    getSelectedGroupFace,
  } = useMediaReviewStore()

  const selectedBatch = getSelectedBatch()
  const selectedPhoto = getSelectedPhoto()
  const selectedFace = getSelectedFace()
  const selectedGroup = getSelectedGroup()
  const selectedGroupFace = getSelectedGroupFace()

  // Load batches on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBatches()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadBatches])

  // Load batch details when selected batch changes
  useEffect(() => {
    if (!selectedBatch) return
    const timeoutId = window.setTimeout(() => {
      void loadBatchDetails(selectedBatch)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadBatchDetails, selectedBatch])

  // Load crop previews when needed
  useEffect(() => {
    const state = useMediaReviewStore.getState()
    const open = state.photoInspectorOpen
    const group = state.getSelectedGroup()
    const photo = state.getSelectedPhoto()
    const batch = state.getSelectedBatch()

    const facesToPreview = open
      ? photo?.faces || []
      : group?.faces.slice(0, PERSON_GROUP_SAMPLE_LIMIT) || []

    if (!batch || facesToPreview.length === 0) return

    const timeoutId = window.setTimeout(() => {
      void loadCropPreviews()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadCropPreviews, selectedBatch, selectedGroup, selectedPhoto])

  // Auto-select first photo + face when nothing is selected
  useEffect(() => {
    const photoRecords = useMediaReviewStore.getState().getPhotoRecords()
    if (!selectedPhoto && photoRecords[0]) {
      setSelectedPhotoKey(photoRecords[0].key)
      setSelectedFaceId(photoRecords[0].faces[0]?.id || null)
    }
  }, [selectedPhoto, setSelectedPhotoKey, setSelectedFaceId])

  // Auto-select first group on mount
  useEffect(() => {
    const state = useMediaReviewStore.getState()
    const filteredGroups = state.getFilteredGroups(state.personSearch)
    if (!state.getSelectedGroup() && filteredGroups[0]) {
      state.setSelectedGroupKey(filteredGroups[0].key)
    }
  }, [])

  // Auto-select first group face when needed
  useEffect(() => {
    const state = useMediaReviewStore.getState()
    const group = state.getSelectedGroup()
    const groupFaceId = state.selectedGroupFaceId

    if (!group) {
      setSelectedGroupFaceId(null)
      return
    }

    if (!selectedGroupFace || !group.faces.some(face => face.id === groupFaceId)) {
      setSelectedGroupFaceId(group.faces[0]?.id || null)
    }
  }, [selectedGroup, selectedGroupFace, setSelectedGroupFaceId])

  // Handlers
  const handleRefresh = () => {
    void loadBatches()
  }

  const handleSyncManifest = (batch: MediaReviewBatch) => {
    const importRows = useMediaReviewStore.getState().importRows
    handleSyncManifestMetadata(
      batch,
      importRows,
      message => addToast(message, 'success'),
      message => addToast(message, 'error'),
    )
  }

  const handleApplyFaces = (batch: MediaReviewBatch) => {
    const state = useMediaReviewStore.getState()
    handleApplyConfirmedFaces(
      batch,
      state.faces,
      state.importRows,
      message => addToast(message, 'success'),
      message => addToast(message, 'error'),
    )
  }

  const handleOpenPhotoInspector = (face: MediaReviewFace) => {
    useMediaReviewStore.getState().openFaceInPhotoReview(face)
  }

  const handleSaveFaces = (faceIds: string[]) => {
    void saveFaces(faceIds)
  }

  const handleResetFaces = (faceIds: string[]) => {
    useMediaReviewStore.getState().resetFaces(faceIds)
  }

  const handleSelectFace = (faceId: string) => {
    setSelectedFaceId(faceId)
  }

  const handleNavigateFace = (direction: 'prev' | 'next') => {
    const state = useMediaReviewStore.getState()
    const photo = state.getSelectedPhoto()
    const faceId = state.selectedFaceId
    if (!photo) return

    const currentIndex = photo.faces.findIndex(face => face.id === faceId)
    if (direction === 'prev') {
      const prevFace = photo.faces[Math.max(0, currentIndex - 1)]
      if (prevFace) setSelectedFaceId(prevFace.id)
    } else {
      const nextFace = photo.faces[Math.min(photo.faces.length - 1, currentIndex + 1)]
      if (nextFace) setSelectedFaceId(nextFace.id)
    }
  }

  // Memoized editable copy of the currently selected face
  const selectedFaceDraft = useMemo(() => {
    if (!selectedFace) return null
    return faceDrafts[selectedFace.id] || normalizeFaceDraft(selectedFace)
  }, [selectedFace, faceDrafts])

  return {
    // state
    loading,
    faces,
    photoInspectorOpen,
    cropPreviewUrls,
    selectedBatch,
    selectedPhoto,
    selectedFace,
    selectedGroup,
    selectedGroupFace,
    selectedFaceDraft,
    // setters / store helpers
    setPhotoInspectorOpen,
    handleBatchStatusChange,
    updateDraft,
    // handlers
    handleRefresh,
    handleSyncManifest,
    handleApplyFaces,
    handleOpenPhotoInspector,
    handleSaveFaces,
    handleResetFaces,
    handleSelectFace,
    handleNavigateFace,
  }
}