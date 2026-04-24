import { useCallback } from 'react'
import { CheckCircle2, Eye, RefreshCw, Tags } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import {
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
} from '@/lib/supabase'
import { useMediaReviewStore } from '@/stores/mediaReviewStore'

interface BatchListProps {
  onRefresh: () => void
  onBatchStatusChange: (batch: MediaReviewBatch, status: MediaReviewBatchStatus) => void
  onSyncManifest: (batch: MediaReviewBatch) => void
  onApplyConfirmedFaces: (batch: MediaReviewBatch) => void
}

export function BatchList({
  onRefresh,
  onBatchStatusChange,
  onSyncManifest,
  onApplyConfirmedFaces,
}: BatchListProps) {
  const {
    batches,
    faces,
    faceDrafts,
    selectedBatchId,
    syncingBatchId,
    lastSavedSummary,
    loading,
    setSelectedBatchId,
  } = useMediaReviewStore()

  const changedFaceIds = faces
    .filter((face) => {
      const draft = faceDrafts[face.id]
      if (!draft) return false
      return (
        draft.reviewStatus !== face.review_status ||
        draft.confirmedName !== (face.confirmed_name || '') ||
        draft.personKey !== (face.person_key || '') ||
        draft.notes !== (face.notes || '')
      )
    })
    .map((face) => face.id)

  const changedGroupCount = (() => {
    const personGroups = useMediaReviewStore.getState().getPersonGroups()
    const changedFaceIdSet = new Set(changedFaceIds)
    return personGroups.filter((group) => group.faceIds.some((faceId) => changedFaceIdSet.has(faceId))).length
  })()

  const pendingFaceCount = faces.filter((face) => face.review_status === 'pending').length
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) || null

  const handleSelectBatch = useCallback((batchId: string | null) => {
    setSelectedBatchId(batchId)
    // Reset selections when batch changes
    useMediaReviewStore.getState().setSelectedPhotoKey(null)
    useMediaReviewStore.getState().setSelectedFaceId(null)
    useMediaReviewStore.getState().setSelectedGroupKey(null)
    useMediaReviewStore.getState().setSelectedGroupFaceId(null)
    useMediaReviewStore.getState().setCropPreviewUrls({})
    useMediaReviewStore.getState().setPhotoInspectorOpen(false)
  }, [setSelectedBatchId])

  if (loading) {
    return (
      <div className="rounded-xl border border-gold-100 bg-white p-8">
        <ListSkeleton count={5} />
      </div>
    )
  }

  if (!selectedBatch) {
    return null
  }

  return (
    <ComponentErrorBoundary componentName="Batch List">
      <section className="rounded-[1.4rem] border border-gold-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:min-w-0 xl:flex-1">
            <div>
              <label htmlFor="review-batch-picker" className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-charcoal-500">
                Review batch
              </label>
              <div className="flex gap-2">
                <select
                  id="review-batch-picker"
                  value={selectedBatchId || ''}
                  onChange={(event) => handleSelectBatch(event.target.value || null)}
                  className="h-11 min-w-0 flex-1 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                >
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.label}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={onRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1rem] border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm text-charcoal-600 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Status</p>
                <p className="mt-1 font-medium text-charcoal-900">{selectedBatch.status.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Pending faces</p>
                <p className="mt-1 font-medium text-charcoal-900">{pendingFaceCount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Groups touched</p>
                <p className="mt-1 font-medium text-charcoal-900">{changedGroupCount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Last save</p>
                <p className="mt-1 font-medium text-charcoal-900">{lastSavedSummary || 'No changes saved yet'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="rounded-full border border-gold-200 bg-white px-4 py-2 text-sm text-charcoal-600">
              {changedFaceIds.length} unsaved face change{changedFaceIds.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <details
          className="mt-4 rounded-[1rem] border border-gold-100 bg-cream-50/70 p-4"
          open={useMediaReviewStore.getState().showAdvancedTools}
          onToggle={(event) => useMediaReviewStore.getState().setShowAdvancedTools(event.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none text-sm font-medium text-charcoal-900">
            Advanced batch tools
          </summary>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onBatchStatusChange(selectedBatch, 'pending')}>
              <Eye className="mr-2 h-4 w-4" />
              Mark Pending
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSyncManifest(selectedBatch)}
              disabled={syncingBatchId === selectedBatch.id}
            >
              <Tags className="mr-2 h-4 w-4" />
              Sync Metadata
            </Button>
            <Button
              size="sm"
              onClick={() => onApplyConfirmedFaces(selectedBatch)}
              disabled={syncingBatchId === selectedBatch.id}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Apply Confirmed Faces
            </Button>
          </div>
        </details>
      </section>
    </ComponentErrorBoundary>
  )
}
