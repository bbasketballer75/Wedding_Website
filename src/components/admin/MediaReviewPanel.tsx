import { Inbox } from 'lucide-react'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'

import { BatchList } from './BatchList'
import { ClusterMergeModal } from './ClusterMergeModal'
import { GuestUploadModerationList } from './GuestUploadModerationList'
import { useMediaReviewStore } from '@/stores/mediaReviewStore'
import { useMediaReviewPanel } from './useMediaReviewPanel'
import { EmptyState } from './MediaReviewPanel.EmptyState'

// Re-export types for use by other components (preserves the public API).
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

export function MediaReviewPanel() {
  const {
    loading,
    photoInspectorOpen,
    cropPreviewUrls,
    selectedPhoto,
    selectedFace,
    selectedFaceDraft,
    setPhotoInspectorOpen,
    handleBatchStatusChange,
    updateDraft,
    handleRefresh,
    handleSyncManifest,
    handleApplyFaces,
    handleSaveFaces,
    handleResetFaces,
    handleSelectFace,
    handleNavigateFace,
  } = useMediaReviewPanel()

  if (loading) {
    return (
      <div className='rounded-xl border border-gold-100 bg-white p-8'>
        <ListSkeleton count={5} />
      </div>
    )
  }

  const hasSelectedBatch = useMediaReviewStore.getState().selectedBatchId !== null

  return (
    <ComponentErrorBoundary componentName='Media Review Panel'>
      <div className='space-y-4'>
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
          <>
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
          <div className='rounded-xl border border-dashed border-gold-200 bg-white'>
            <EmptyState
              icon={Inbox}
              title='Guest-upload review queue is empty'
              description='Export and tag approved guest uploads, then push a guest review batch to stage the next people-review pass.'
            />
          </div>
        )}

        {/* Guest Upload Moderation section */}
        <section className='rounded-[1.4rem] border border-gold-100 bg-white p-4 shadow-sm'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='font-display text-lg text-charcoal-900'>Guest Upload Moderation</h2>
          </div>
          <GuestUploadModerationList />
        </section>

        {/* Known people datalist for autocomplete */}
        <datalist id='known-people-options'>
          {useMediaReviewStore.getState().knownPeople.map(person => (
            <option key={person} value={person} />
          ))}
        </datalist>
      </div>
    </ComponentErrorBoundary>
  )
}

export default MediaReviewPanel
