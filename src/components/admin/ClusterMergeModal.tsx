import { useMemo } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'
import { type MediaReviewFace, type MediaReviewFaceStatus } from '@/lib/supabase'
import { useMediaReviewStore, type FaceDraft } from '@/stores/mediaReviewStore'

interface ClusterMergeModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPhoto: {
    key: string
    sourceRelativePath: string
    photoUrl: string
    faces: MediaReviewFace[]
  } | null
  selectedFace: MediaReviewFace | null
  selectedFaceDraft: FaceDraft | null
  onUpdateDraft: (faceId: string, patch: Partial<FaceDraft>) => void
  onSaveFaces: (faceIds: string[]) => void
  onResetFaces: (faceIds: string[]) => void
  cropPreviewUrls: Record<string, string>
  onSelectFace: (faceId: string) => void
  onNavigateFace: (direction: 'prev' | 'next') => void
}

function getStatusBadgeClasses(status: MediaReviewFaceStatus) {
  switch (status) {
    case 'confirmed':
      return 'border-green-200 bg-green-50 text-green-700'
    case 'ignored':
      return 'border-charcoal-200 bg-charcoal-50 text-charcoal-600'
    default:
      return 'border-gold-200 bg-gold-50 text-gold-700'
  }
}

function getOverlayStyle(face: MediaReviewFace) {
  const dimensions =
    face.metadata && typeof face.metadata === 'object'
      ? ((face.metadata as Record<string, unknown>)['detectionDimensions'] as
          | Record<string, unknown>
          | undefined)
      : undefined
  const width = typeof dimensions?.width === 'number' ? dimensions.width : null
  const height = typeof dimensions?.height === 'number' ? dimensions.height : null
  const box = face.box || {}
  const left = typeof box.left === 'number' ? box.left : null
  const top = typeof box.top === 'number' ? box.top : null
  const boxWidth = typeof box.width === 'number' ? box.width : null
  const boxHeight = typeof box.height === 'number' ? box.height : null

  if (width && height && left != null && top != null && boxWidth != null && boxHeight != null) {
    return {
      left: `${(left / width) * 100}%`,
      top: `${(top / height) * 100}%`,
      width: `${(boxWidth / width) * 100}%`,
      height: `${(boxHeight / height) * 100}%`,
      transform: 'none',
    }
  }

  return {
    left: `${face.x}%`,
    top: `${face.y}%`,
    width: '1.25rem',
    height: '1.25rem',
    transform: 'translate(-50%, -50%)',
  }
}

function resolveReviewMediaPath(path: string | null | undefined) {
  if (!path) return ''
  return getMediaPath(path)
}

function getFaceLabel(face: MediaReviewFace) {
  return face.confirmed_name || face.cluster_id || face.face_id
}

function getDraftFaceLabel(face: MediaReviewFace, draft?: FaceDraft) {
  return draft?.confirmedName?.trim() || getFaceLabel(face)
}

function slugifyPerson(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeFaceDraft(face: MediaReviewFace): FaceDraft {
  const confirmedName = face.confirmed_name || ''
  return {
    reviewStatus: face.review_status,
    confirmedName,
    personKey: face.person_key || (confirmedName ? slugifyPerson(confirmedName) : ''),
    notes: face.notes || '',
  }
}

/**
 * FaceTaggingConfirmation - Face detail form embedded within ClusterMergeModal
 */
interface FaceTaggingConfirmationProps {
  face: MediaReviewFace
  draft: FaceDraft
  onUpdateDraft: (faceId: string, patch: Partial<FaceDraft>) => void
  onSave: (faceIds: string[]) => void
  onReset: (faceIds: string[]) => void
  isSaving: boolean
  savingKey: string | null
  saveKey: string | null
}

function FaceTaggingConfirmation({
  face,
  draft,
  onUpdateDraft,
  onSave,
  onReset,
  isSaving,
  savingKey,
  saveKey,
}: FaceTaggingConfirmationProps) {
  const changedFaceIds = useMemo(() => {
    return useMediaReviewStore.getState().getChangedFaceIds()
  }, [])

  const selectedPhoto = useMemo(() => {
    return useMediaReviewStore.getState().getSelectedPhoto()
  }, [])

  const selectedPhotoChangedFaceIds = useMemo(() => {
    if (!selectedPhoto) return []
    return selectedPhoto.faces.map(f => f.id).filter(faceId => changedFaceIds.includes(faceId))
  }, [selectedPhoto, changedFaceIds])

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-[11px] uppercase tracking-[0.28em] text-charcoal-500'>Selected face</p>
        <h4 className='mt-2 text-lg font-medium text-charcoal-900'>
          {getDraftFaceLabel(face, draft)}
        </h4>
        <p className='mt-1 text-sm text-charcoal-500'>
          {face.cluster_id || 'No cluster'} · quality {face.quality_score ?? 'n/a'}
        </p>
      </div>

      <div className='overflow-hidden rounded-[1.1rem] border border-gold-100 bg-white'>
        {useMediaReviewStore.getState().cropPreviewUrls[face.id] ? (
          <img
            src={useMediaReviewStore.getState().cropPreviewUrls[face.id]}
            alt={getDraftFaceLabel(face, draft)}
            className='aspect-square h-full w-full object-cover'
          />
        ) : (
          <div className='flex aspect-square items-center justify-center text-xs text-charcoal-400'>
            No crop
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor={`face-name-${face.id}`}
          className='mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500'
        >
          Person name
        </label>
        <Input
          id={`face-name-${face.id}`}
          list='known-people-options'
          value={draft.confirmedName}
          onChange={event => {
            const confirmedName = event.target.value
            onUpdateDraft(face.id, {
              confirmedName,
              personKey: confirmedName ? slugifyPerson(confirmedName) : '',
              reviewStatus: confirmedName ? 'confirmed' : draft.reviewStatus,
            })
          }}
          placeholder='Austin'
        />
      </div>

      <div className='flex flex-wrap gap-2'>
        {(
          [
            ['pending', 'Pending'],
            ['confirmed', 'Confirm'],
            ['ignored', 'Ignore'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type='button'
            onClick={() => onUpdateDraft(face.id, { reviewStatus: value })}
            className={cn(
              'rounded-full px-3 py-2 text-sm transition-colors',
              draft.reviewStatus === value
                ? 'bg-gold-500 text-white'
                : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          size='sm'
          onClick={() => onSave(selectedPhoto?.faces.map(f => f.id) || [])}
          disabled={isSaving || savingKey === saveKey || selectedPhotoChangedFaceIds.length === 0}
        >
          <Save className='mr-2 h-4 w-4' />
          Save Photo Changes
        </Button>
        <Button
          size='sm'
          variant='secondary'
          onClick={() => onReset(selectedPhoto?.faces.map(f => f.id) || [])}
          disabled={selectedPhotoChangedFaceIds.length === 0}
        >
          Reset Photo Changes
        </Button>
      </div>

      <details className='rounded-[1rem] border border-gold-100 bg-white p-4'>
        <summary className='cursor-pointer list-none text-sm font-medium text-charcoal-900'>
          Details and notes
        </summary>
        <div className='mt-4 space-y-4'>
          <div>
            <label
              htmlFor={`face-person-key-${face.id}`}
              className='mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500'
            >
              Group key
            </label>
            <Input
              id={`face-person-key-${face.id}`}
              value={draft.personKey}
              onChange={event => onUpdateDraft(face.id, { personKey: event.target.value })}
              placeholder='austin'
            />
          </div>

          <div>
            <label
              htmlFor={`face-notes-${face.id}`}
              className='mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500'
            >
              Notes
            </label>
            <Textarea
              id={`face-notes-${face.id}`}
              value={draft.notes}
              onChange={event => onUpdateDraft(face.id, { notes: event.target.value })}
              placeholder='Optional review notes for this face.'
              className='min-h-[96px]'
            />
          </div>
        </div>
      </details>
    </div>
  )
}

export function ClusterMergeModal({
  isOpen,
  onClose,
  selectedPhoto,
  selectedFace,
  selectedFaceDraft,
  onUpdateDraft,
  onSaveFaces,
  onResetFaces,
  cropPreviewUrls,
  onSelectFace,
  onNavigateFace,
}: ClusterMergeModalProps) {
  const { faceDrafts, savingKey } = useMediaReviewStore()

  const getFacePhotoStatus = (face: MediaReviewFace, draft?: FaceDraft) => {
    return draft?.reviewStatus || face.review_status
  }

  if (!isOpen || !selectedPhoto) return null

  const selectedPhotoSaveKey = selectedPhoto.faces.map(face => face.id).join(':') || null

  return (
    <ComponentErrorBoundary componentName='Cluster Merge Modal'>
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/60 p-4 backdrop-blur-sm'>
        <div className='flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.6rem] border border-gold-100 bg-white shadow-2xl'>
          {/* Header */}
          <div className='flex items-center justify-between gap-3 border-b border-gold-100 px-5 py-4'>
            <div className='min-w-0'>
              <p className='text-[11px] uppercase tracking-[0.28em] text-charcoal-500'>
                Photo inspector
              </p>
              <h3 className='mt-1 truncate text-lg font-medium text-charcoal-900'>
                {selectedPhoto.sourceRelativePath}
              </h3>
            </div>
            <Button size='sm' variant='secondary' onClick={onClose}>
              Close
            </Button>
          </div>

          {/* Body */}
          <div className='grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]'>
            {/* Left Panel - Photo with face overlays */}
            <div className='min-h-0 overflow-y-auto border-b border-gold-100 p-5 xl:border-b-0 xl:border-r'>
              <div className='space-y-4'>
                {/* Main photo with overlays */}
                <div className='overflow-hidden rounded-[1.4rem] border border-gold-100 bg-charcoal-950'>
                  <div className='relative aspect-[4/3] bg-charcoal-900'>
                    {selectedPhoto.photoUrl ? (
                      <img
                        src={resolveReviewMediaPath(selectedPhoto.photoUrl)}
                        alt={selectedPhoto.sourceRelativePath}
                        className='h-full w-full object-contain'
                        loading='lazy'
                      />
                    ) : null}

                    {selectedPhoto.faces.map(face => {
                      const status = getFacePhotoStatus(face, faceDrafts[face.id])
                      const isSelected = selectedFace?.id === face.id

                      return (
                        <button
                          key={face.id}
                          type='button'
                          onClick={() => onSelectFace(face.id)}
                          className={cn(
                            'absolute rounded-md border-2 transition-all',
                            status === 'confirmed'
                              ? 'border-green-300 bg-green-500/10'
                              : status === 'ignored'
                                ? 'border-charcoal-300 bg-charcoal-100/10'
                                : 'border-gold-300 bg-gold-400/10',
                            isSelected && 'ring-2 ring-white/90'
                          )}
                          style={getOverlayStyle(face)}
                          aria-label={`Review ${getFaceLabel(face)}`}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Navigation buttons */}
                <div className='flex flex-wrap gap-2'>
                  <Button size='sm' variant='secondary' onClick={() => onNavigateFace('prev')}>
                    Previous Face
                  </Button>
                  <Button size='sm' variant='secondary' onClick={() => onNavigateFace('next')}>
                    Next Face
                  </Button>
                </div>

                {/* Face selector grid */}
                <div className='grid gap-3 sm:grid-cols-3 xl:grid-cols-4'>
                  {selectedPhoto.faces.map(face => {
                    const draft = faceDrafts[face.id] || normalizeFaceDraft(face)
                    const isSelected = selectedFace?.id === face.id

                    return (
                      <button
                        key={face.id}
                        type='button'
                        onClick={() => onSelectFace(face.id)}
                        className={cn(
                          'overflow-hidden rounded-[1rem] border text-left transition-colors',
                          isSelected
                            ? 'border-gold-400 bg-gold-50'
                            : 'border-gold-100 bg-cream-50/50 hover:bg-cream-50'
                        )}
                      >
                        <div className='aspect-square overflow-hidden bg-white'>
                          {cropPreviewUrls[face.id] ? (
                            <img
                              src={cropPreviewUrls[face.id]}
                              alt={getDraftFaceLabel(face, draft)}
                              className='h-full w-full object-cover'
                            />
                          ) : (
                            <div className='flex h-full items-center justify-center text-xs text-charcoal-400'>
                              No crop
                            </div>
                          )}
                        </div>
                        <div className='space-y-1 p-3'>
                          <p className='truncate text-sm font-medium text-charcoal-900'>
                            {getDraftFaceLabel(face, draft)}
                          </p>
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]',
                              getStatusBadgeClasses(draft.reviewStatus)
                            )}
                          >
                            {draft.reviewStatus}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel - Face detail form (FaceTaggingConfirmation) */}
            <div className='min-h-0 overflow-y-auto bg-cream-50/70 p-5'>
              {selectedFace && selectedFaceDraft ? (
                <FaceTaggingConfirmation
                  face={selectedFace}
                  draft={selectedFaceDraft}
                  onUpdateDraft={onUpdateDraft}
                  onSave={onSaveFaces}
                  onReset={onResetFaces}
                  isSaving={savingKey !== null}
                  savingKey={savingKey}
                  saveKey={selectedPhotoSaveKey}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  )
}
