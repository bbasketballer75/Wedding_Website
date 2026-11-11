import { useState } from 'react'
import { Check, CheckCircle2, GitMerge, Inbox, Loader2, RefreshCw, User, Users } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { mediaPaths } from '@/shared/data/media'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { ListSkeleton } from '@/shared/ui/Skeleton'
import {
  clusterDisplayName,
  faceDisplayName,
  type MediaReviewBatchStatus,
  type PeopleReviewData,
} from './media-review-data'
import { usePeopleReview } from './usePeopleReview'

/**
 * `/admin/review` — people review.
 *
 * Reduced port of the frozen `src/components/admin/MediaReviewPanel.tsx` +
 * `BatchList` + `ClusterMergeModal`: batch selection with lifecycle
 * transitions, cluster list, rename/merge modal, and per-face confirm/
 * unconfirm (faces are what populate `media_review_faces.confirmed_name`).
 *
 * The photo-inspector crop overlays and the guest-upload moderation list stay
 * with their owning components (W7-1 / guest-uploads wave); this page owns the
 * batch → cluster → face review flow only.
 */
export interface PeopleReviewPageProps {
  readonly data?: PeopleReviewData
}

const BATCH_STATUS_ACTIONS: { status: MediaReviewBatchStatus; label: string }[] = [
  { status: 'pending', label: 'Mark pending' },
  { status: 'in_review', label: 'Mark in review' },
  { status: 'approved', label: 'Mark approved' },
  { status: 'archived', label: 'Archive batch' },
]

function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'merged':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'ignored':
    case 'archived':
      return 'border-charcoal-200 bg-charcoal-50 text-charcoal-600'
    default:
      return 'border-gold-200 bg-gold-50 text-gold-700'
  }
}

function ClusterMergeDialog({
  open,
  targetOptions,
  targetId,
  updating,
  onSelectTarget,
  onCancel,
  onMerge,
}: {
  open: boolean
  targetOptions: readonly { id: string; label: string }[]
  targetId: string
  updating: boolean
  onSelectTarget: (id: string) => void
  onCancel: () => void
  onMerge: () => void
}) {
  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/60 p-4 backdrop-blur-sm'>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='cluster-merge-title'
        data-testid='cluster-merge-dialog'
        className='w-full max-w-md rounded-[1.25rem] border border-gold-200 bg-white p-6 shadow-2xl'
      >
        <h3 id='cluster-merge-title' className='font-display text-xl text-charcoal-900'>
          Merge this cluster into another
        </h3>
        <p className='mt-2 text-sm leading-6 text-charcoal-500'>
          The selected cluster is marked merged and points at the target cluster. Both clusters keep
          their detected faces; the target keeps the confirmed name.
        </p>

        <label
          htmlFor='cluster-merge-target'
          className='mt-4 block text-xs font-medium text-charcoal-700'
        >
          Target cluster
        </label>
        <select
          id='cluster-merge-target'
          value={targetId}
          onChange={event => onSelectTarget(event.target.value)}
          className='mt-1 h-10 w-full rounded-full border border-gold-200 bg-white px-3 text-sm text-charcoal-700'
        >
          <option value=''>Choose a cluster...</option>
          {targetOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <div className='mt-6 flex justify-end gap-2'>
          <Button variant='secondary' size='sm' onClick={onCancel} disabled={updating}>
            Cancel
          </Button>
          <Button size='sm' onClick={onMerge} disabled={!targetId || updating}>
            {updating ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
            ) : (
              <GitMerge className='mr-2 h-4 w-4' aria-hidden='true' />
            )}
            Merge clusters
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PeopleReviewPage({ data }: PeopleReviewPageProps = {}) {
  const review = usePeopleReview({ data })
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')

  const selectedClusterName = review.selectedCluster
    ? clusterDisplayName(review.selectedCluster)
    : ''
  const canConfirmFaces =
    Boolean(review.selectedCluster?.confirmedName?.trim()) ||
    review.clusterNameDraft.trim().length > 0

  const openMerge = (): void => {
    setMergeTargetId('')
    setMergeOpen(true)
  }

  const closeMerge = (): void => {
    setMergeOpen(false)
    setMergeTargetId('')
  }

  return (
    <div className='space-y-4'>
      <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
              People workflow
            </p>
            <h2 className='mt-1 font-display text-[1.7rem] text-charcoal-900'>
              Turn face detections into a browsable people archive.
            </h2>
            <p className='mt-1 max-w-3xl text-sm leading-6 text-charcoal-500'>
              Use photo-first review for accuracy, then clean up recurring people in bulk so the
              public gallery stays useful instead of noisy.
            </p>
          </div>
          <Button variant='secondary' size='sm' onClick={review.refresh} disabled={review.updating}>
            <RefreshCw className='mr-2 h-4 w-4' aria-hidden='true' />
            Refresh
          </Button>
        </div>

        {review.statusMessage && (
          <p
            role='status'
            className='mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800'
          >
            {review.statusMessage}
          </p>
        )}
        {review.error && (
          <p
            role='alert'
            className='mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700'
          >
            {review.error}
          </p>
        )}
      </section>

      <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
        {review.batchesLoading ? (
          <div role='status' aria-label='Loading review batches'>
            <ListSkeleton count={3} />
          </div>
        ) : review.batches.length === 0 ? (
          <div className='rounded-xl border border-dashed border-gold-200 bg-white'>
            <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
              <Inbox className='h-12 w-12 opacity-30' aria-hidden='true' />
              <p className='font-medium text-charcoal-700'>Guest-upload review queue is empty</p>
              <p className='text-sm'>
                Export and tag approved guest uploads, then push a guest review batch to stage the
                next people-review pass.
              </p>
            </div>
          </div>
        ) : (
          <div className='grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:items-center'>
            <div>
              <label
                htmlFor='review-batch-picker'
                className='mb-2 block text-[11px] uppercase tracking-[0.28em] text-charcoal-500'
              >
                Review batch
              </label>
              <select
                id='review-batch-picker'
                value={review.selectedBatchId ?? ''}
                onChange={event => review.selectBatch(event.target.value)}
                className='h-11 w-full rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-400'
              >
                {review.batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label}
                  </option>
                ))}
              </select>
            </div>

            <div className='grid gap-3 rounded-[1rem] border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm text-charcoal-600 sm:grid-cols-2 xl:grid-cols-4'>
              <div>
                <p className='text-[11px] uppercase tracking-[0.22em] text-charcoal-400'>Status</p>
                <p className='mt-1 font-medium text-charcoal-900'>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      statusBadgeClasses(review.selectedBatch?.status ?? 'pending')
                    )}
                  >
                    {(review.selectedBatch?.status ?? 'pending').replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <p className='text-[11px] uppercase tracking-[0.22em] text-charcoal-400'>
                  Clusters
                </p>
                <p className='mt-1 font-medium text-charcoal-900'>{review.clusters.length}</p>
              </div>
              <div>
                <p className='text-[11px] uppercase tracking-[0.22em] text-charcoal-400'>
                  Detections
                </p>
                <p className='mt-1 font-medium text-charcoal-900'>
                  {review.selectedBatch?.detectionCount ?? 0}
                </p>
              </div>
              <div>
                <p className='text-[11px] uppercase tracking-[0.22em] text-charcoal-400'>
                  Pending faces
                </p>
                <p className='mt-1 font-medium text-charcoal-900'>{review.pendingFaceCount}</p>
              </div>
            </div>
          </div>
        )}

        {review.selectedBatch && (
          <div className='mt-4 flex flex-wrap gap-2'>
            {BATCH_STATUS_ACTIONS.map(action => (
              <Button
                key={action.status}
                size='sm'
                variant={review.selectedBatch?.status === action.status ? 'primary' : 'secondary'}
                onClick={() => void review.changeBatchStatus(action.status)}
                disabled={review.updating || review.selectedBatch?.status === action.status}
              >
                <CheckCircle2 className='mr-2 h-4 w-4' aria-hidden='true' />
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </section>

      {review.reviewLoading ? (
        <div role='status' aria-label='Loading review batches'>
          <ListSkeleton count={4} />
        </div>
      ) : review.clusters.length > 0 ? (
        <div className='grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'>
          <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
            <h3 className='mb-3 flex items-center gap-2 font-display text-lg text-charcoal-900'>
              <Users className='h-4 w-4 text-gold-500' aria-hidden='true' />
              Clusters
            </h3>
            <ul className='space-y-2'>
              {review.clusters.map(cluster => {
                const active = review.selectedClusterId === cluster.id
                return (
                  <li key={cluster.id}>
                    <button
                      type='button'
                      aria-pressed={active}
                      onClick={() => review.selectCluster(cluster.id)}
                      data-testid={`review-cluster-${cluster.id}`}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-[0.9rem] border px-3 py-2.5 text-left text-sm transition-colors',
                        active
                          ? 'border-gold-300 bg-gold-50 text-charcoal-900'
                          : 'border-gold-100 bg-white text-charcoal-600 hover:border-gold-200 hover:bg-cream-50/80'
                      )}
                    >
                      <span className='min-w-0'>
                        <span className='block truncate font-medium'>
                          {clusterDisplayName(cluster)}
                        </span>
                        <span className='text-xs text-charcoal-400'>
                          {cluster.memberCount} face{cluster.memberCount === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                          statusBadgeClasses(cluster.reviewStatus)
                        )}
                      >
                        {cluster.reviewStatus}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {review.selectedCluster && (
            <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
              <div className='flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between'>
                <div>
                  <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
                    Selected cluster
                  </p>
                  <h3 className='mt-1 font-display text-xl text-charcoal-900'>
                    {selectedClusterName}
                  </h3>
                  <p className='mt-1 text-sm text-charcoal-500'>
                    {review.clusterFaces.length} face
                    {review.clusterFaces.length === 1 ? '' : 's'} in this cluster ·{' '}
                    {review.clusterFaces.filter(face => face.reviewStatus === 'confirmed').length}{' '}
                    confirmed
                  </p>
                </div>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={openMerge}
                  disabled={review.updating || review.mergeTargetOptions.length === 0}
                >
                  <GitMerge className='mr-2 h-4 w-4' aria-hidden='true' />
                  Merge into another cluster
                </Button>
              </div>

              <div className='mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end'>
                <div>
                  <label
                    htmlFor='cluster-confirmed-name'
                    className='mb-1 block text-xs font-medium text-charcoal-700'
                  >
                    Confirm this person's name
                  </label>
                  <Input
                    id='cluster-confirmed-name'
                    value={review.clusterNameDraft}
                    onChange={event => review.setClusterNameDraft(event.target.value)}
                    placeholder='e.g. Aunt Patricia'
                    hint='Confirmed names power the public "People in the photo" labels.'
                  />
                </div>
                <Button
                  size='sm'
                  onClick={() => void review.saveClusterName()}
                  disabled={review.updating || !review.unsavedName}
                >
                  {review.updating ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
                  ) : (
                    <Check className='mr-2 h-4 w-4' aria-hidden='true' />
                  )}
                  Save name
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => void review.confirmClusterFaces()}
                  disabled={review.updating || !canConfirmFaces || review.clusterFaces.length === 0}
                >
                  Confirm all faces
                </Button>
              </div>

              <div className='mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4'>
                {review.clusterFaces.map(face => (
                  <article
                    key={face.id}
                    data-testid={`review-face-${face.id}`}
                    className='overflow-hidden rounded-[1rem] border border-gold-100 bg-white shadow-sm'
                  >
                    <div className='flex aspect-square items-center justify-center bg-cream-100'>
                      {face.thumbnailUrl ? (
                        <img
                          src={mediaPaths.getMediaPath(face.thumbnailUrl)}
                          alt={faceDisplayName(face)}
                          loading='lazy'
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <User className='h-10 w-10 text-gold-300' aria-hidden='true' />
                      )}
                    </div>
                    <div className='space-y-2 p-2.5'>
                      <p className='truncate text-xs font-medium text-charcoal-800'>
                        {faceDisplayName(face)}
                      </p>
                      <span
                        className={cn(
                          'inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                          statusBadgeClasses(face.reviewStatus)
                        )}
                      >
                        {face.reviewStatus}
                      </span>
                      <div className='flex gap-1.5'>
                        <button
                          type='button'
                          onClick={() => void review.confirmFace(face)}
                          disabled={review.updating || !canConfirmFaces}
                          aria-label={`Confirm face ${face.faceId}`}
                          className='flex-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          Confirm
                        </button>
                        <button
                          type='button'
                          onClick={() => void review.unconfirmFace(face)}
                          disabled={review.updating || face.reviewStatus !== 'confirmed'}
                          aria-label={`Unconfirm face ${face.faceId}`}
                          className='flex-1 rounded-full border border-charcoal-200 bg-white px-2 py-1 text-[11px] text-charcoal-600 transition-colors hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-40'
                        >
                          Unconfirm
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {review.clusterFaces.length === 0 && (
                <p className='mt-4 text-sm text-charcoal-500'>
                  No faces staged for this cluster. Run the batch export or refresh the review
                  batches.
                </p>
              )}
            </section>
          )}
        </div>
      ) : review.selectedBatch ? (
        <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
          <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
            <Users className='h-12 w-12 opacity-30' aria-hidden='true' />
            <p className='font-medium text-charcoal-700'>No clusters in this batch yet</p>
            <p className='text-sm'>Refresh after the detection export finishes.</p>
          </div>
        </section>
      ) : null}

      <ClusterMergeDialog
        open={mergeOpen}
        targetOptions={review.mergeTargetOptions.map(cluster => ({
          id: cluster.id,
          label: clusterDisplayName(cluster),
        }))}
        targetId={mergeTargetId}
        updating={review.updating}
        onSelectTarget={setMergeTargetId}
        onCancel={closeMerge}
        onMerge={() => {
          void review.mergeSelectedCluster(mergeTargetId)
          closeMerge()
        }}
      />
    </div>
  )
}
