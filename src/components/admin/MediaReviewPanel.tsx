import { useEffect, useMemo } from 'react'
import React from 'react'
import { Inbox, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { useToast } from '@/context/ToastContext'
import { type MediaReviewBatch, type MediaReviewBatchStatus, type MediaReviewFace } from '@/lib/supabase'
import { useMediaReviewStore, type FaceDraft } from '@/stores/mediaReviewStore'

import { BatchList } from './BatchList'
import { FaceReviewGrid } from './FaceReviewGrid'
import { ClusterMergeModal } from './ClusterMergeModal'
import { handleSyncManifestMetadata, handleApplyConfirmedFaces } from './ReviewImportManifest'

// Re-export types for use by other components
export interface ReviewImportManifestRow {
  sourceRecordId: string | null
  sourceRelativePath: string
  collection: string
  category: string
  storyLaneSuggestion: string | null
  duplicateGroupId: string | null
  tags: string[]
  photoRowDraft: {
    url: string
    thumbnail: string
    category: string
    location: string | null
    date: string | null
    photographer?: string | null
    is_professional?: boolean
    tags: string[]
    faces: Array<{
      id: string
      name: string
      x: number
      y: number
      box?: {
        left: number
        top: number
        width: number
        height: number
      } | null
    }>
  }
}

// Constants
const PERSON_GROUP_SAMPLE_LIMIT = 60

// Shared utility functions (kept here for now, could be moved to a utils file)
function normalizeFaceDraft(face: MediaReviewFace): FaceDraft {
  const confirmedName = face.confirmed_name || ''
  return {
    reviewStatus: face.review_status,
    confirmedName,
    personKey: face.person_key || (confirmedName ? slugifyPerson(confirmedName) : ''),
    notes: face.notes || '',
  }
}

function slugifyPerson(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function EmptyState({ icon: Icon, title, description }: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-charcoal-500">
      <Icon className="h-12 w-12 opacity-30" />
      <p className="font-medium text-charcoal-700">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}

export function MediaReviewPanel() {
  const { addToast } = useToast()
  const {
    loading,
    faces,
    selectedBatch,
    photoInspectorOpen,
    setPhotoInspectorOpen,
    loadBatches,
    loadBatchDetails,
    saveFaces,
    handleBatchStatusChange,
    loadCropPreviews,
    selectedPhoto,
    selectedFace,
    selectedGroup,
    selectedGroupFace,
    faceDrafts,
    cropPreviewUrls,
    updateDraft,
    setSelectedFaceId,
    setSelectedPhotoKey,
    setSelectedGroupFaceId,
  } = useMediaReviewStore()

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
    const photoInspectorOpen = useMediaReviewStore.getState().photoInspectorOpen
    const selectedGroup = useMediaReviewStore.getState().getSelectedGroup()
    const selectedPhoto = useMediaReviewStore.getState().getSelectedPhoto()
    const selectedBatch = useMediaReviewStore.getState().getSelectedBatch()

    const facesToPreview = photoInspectorOpen
      ? selectedPhoto?.faces || []
      : selectedGroup?.faces.slice(0, PERSON_GROUP_SAMPLE_LIMIT) || []

    if (!selectedBatch || facesToPreview.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadCropPreviews()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCropPreviews, selectedBatch, selectedGroup, selectedPhoto])

  // Sync with selected photo/face changes
  useEffect(() => {
    const photoRecords = useMediaReviewStore.getState().getPhotoRecords()
    if (!selectedPhoto && photoRecords[0]) {
      setSelectedPhotoKey(photoRecords[0].key)
      setSelectedFaceId(photoRecords[0].faces[0]?.id || null)
    }
  }, [selectedPhoto, setSelectedPhotoKey, setSelectedFaceId])

  useEffect(() => {
    const filteredGroups = useMediaReviewStore.getState().getFilteredGroups(useMediaReviewStore.getState().personSearch)
    const selectedGroup = useMediaReviewStore.getState().getSelectedGroup()
    const setSelectedGroupKey = useMediaReviewStore.getState().setSelectedGroupKey
    if (!selectedGroup && filteredGroups[0]) {
      setSelectedGroupKey(filteredGroups[0].key)
    }
  }, [])

  useEffect(() => {
    const selectedGroup = useMediaReviewStore.getState().getSelectedGroup()
    const selectedGroupFaceId = useMediaReviewStore.getState().selectedGroupFaceId

    if (!selectedGroup) {
      setSelectedGroupFaceId(null)
      return
    }

    if (!selectedGroupFace || !selectedGroup.faces.some((face) => face.id === selectedGroupFaceId)) {
      setSelectedGroupFaceId(selectedGroup.faces[0]?.id || null)
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
      (message) => addToast(message, 'success'),
      (message) => addToast(message, 'error'),
    )
  }

  const handleApplyFaces = (batch: MediaReviewBatch) => {
    const faces = useMediaReviewStore.getState().faces
    const importRows = useMediaReviewStore.getState().importRows
    handleApplyConfirmedFaces(
      batch,
      faces,
      importRows,
      (message) => addToast(message, 'success'),
      (message) => addToast(message, 'error'),
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
    const currentSelectedPhoto = useMediaReviewStore.getState().getSelectedPhoto()
    const currentSelectedFaceId = useMediaReviewStore.getState().selectedFaceId

    if (!currentSelectedPhoto) return

    const currentIndex = currentSelectedPhoto.faces.findIndex((face) => face.id === currentSelectedFaceId)
    if (direction === 'prev') {
      const previousFace = currentSelectedPhoto.faces[Math.max(0, currentIndex - 1)]
      if (previousFace) setSelectedFaceId(previousFace.id)
    } else {
      const nextFace = currentSelectedPhoto.faces[Math.min(currentSelectedPhoto.faces.length - 1, currentIndex + 1)]
      if (nextFace) setSelectedFaceId(nextFace.id)
    }
  }

  // Selected face draft
  const selectedFaceDraft = useMemo(() => {
    if (!selectedFace) return null
    return faceDrafts[selectedFace.id] || normalizeFaceDraft(selectedFace)
  }, [selectedFace, faceDrafts])

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-gold-100 bg-white p-8">
        <ListSkeleton count={5} />
      </div>
    )
  }

  const hasSelectedBatch = useMediaReviewStore.getState().selectedBatchId !== null
  const hasFaces = faces.length > 0

  return (
    <ComponentErrorBoundary componentName="Media Review Panel">
      <div className="space-y-4">
        {/* Batch selector and status */}
        {hasSelectedBatch && (
          <BatchList
            onRefresh={handleRefresh}
            onBatchStatusChange={handleBatchStatusChange}
            onSyncManifest={handleSyncManifest}
            onApplyConfirmedFaces={handleApplyFaces}
          />
        )}

        {/* Main content based on state */}
        {hasSelectedBatch ? (
          hasFaces ? (
            <>
              <FaceReviewGrid
                onSaveFaces={handleSaveFaces}
                onResetFaces={handleResetFaces}
                onOpenPhotoInspector={handleOpenPhotoInspector}
              />

              <ClusterMergeModal
                isOpen={photoInspectorOpen}
                onClose={() => setPhotoInspectorOpen(false)}
                selectedPhoto={selectedPhoto}
                selectedFace={selectedFace}
                selectedFaceDraft={selectedFaceDraft}
                onUpdateDraft={updateDraft}
                onSaveFaces={handleSaveFaces}
                onResetFaces={handleResetFaces}
                cropPreviewUrls={cropPreviewUrls}
                onSelectFace={handleSelectFace}
                onNavigateFace={handleNavigateFace}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-200 bg-white">
              <EmptyState
                icon={Users}
                title="No face review rows staged"
                description="This batch does not have staged per-face review rows yet. Re-run the review push after exporting the manifest so the people queue has real faces to review."
              />
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-gold-200 bg-white">
            <EmptyState
              icon={Inbox}
              title="Guest-upload review queue is empty"
              description="Export and tag approved guest uploads, then push a guest review batch to stage the next people-review pass."
            />
          </div>
        )}

        {/* Known people datalist for autocomplete */}
        <datalist id="known-people-options">
          {useMediaReviewStore.getState().knownPeople.map((person) => (
            <option key={person} value={person} />
          ))}
        </datalist>
      </div>
    </ComponentErrorBoundary>
  )
}
