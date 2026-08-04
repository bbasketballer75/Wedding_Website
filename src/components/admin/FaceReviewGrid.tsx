import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FolderOpen, Keyboard, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'
import { type MediaReviewFace, type MediaReviewFaceStatus } from '@/lib/supabase'
import { useMediaReviewStore, type FaceDraft } from '@/stores/mediaReviewStore'

interface FaceReviewGridProps {
  onSaveFaces: (faceIds: string[]) => void
  onResetFaces: (faceIds: string[]) => void
  onOpenPhotoInspector: (face: MediaReviewFace) => void
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
          Record<string, unknown> | undefined)
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

function getDraftFaceLabel(face: MediaReviewFace, draft?: FaceDraft) {
  return draft?.confirmedName?.trim() || face.confirmed_name || face.cluster_id || face.face_id
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

// High-confidence threshold: groups with averageQuality ≥ this get auto-confirmed
const HIGH_CONFIDENCE_THRESHOLD = 0.8

export function FaceReviewGrid({
  onSaveFaces,
  onResetFaces,
  onOpenPhotoInspector,
}: FaceReviewGridProps) {
  const [showAllGroupSamples, setShowAllGroupSamples] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const {
    faces,
    faceDrafts,
    personSearch,
    cropPreviewUrls,
    setPersonSearch,
    setSelectedGroupKey,
    setSelectedGroupFaceId,
    updateFacesDrafts,
    stageGroupStatus,
  } = useMediaReviewStore()

  const deferredPersonSearch = useDeferredValue(personSearch)

  const personGroups = useMemo(() => {
    return useMediaReviewStore.getState().getPersonGroups()
  }, [])

  const filteredGroups = useMemo(() => {
    const query = deferredPersonSearch.trim().toLowerCase()
    if (!query) return personGroups

    return personGroups.filter(group => {
      return [
        group.label,
        group.key,
        ...group.faces.map(face => face.source_relative_path || ''),
      ].some(value => value.toLowerCase().includes(query))
    })
  }, [deferredPersonSearch, personGroups])

  const selectedGroup = useMemo(() => {
    const { selectedGroupKey } = useMediaReviewStore.getState()
    return (
      filteredGroups.find(group => group.key === selectedGroupKey) ||
      personGroups.find(group => group.key === selectedGroupKey) ||
      null
    )
  }, [filteredGroups, personGroups])

  const selectedGroupFace = useMemo(() => {
    const { selectedGroupFaceId } = useMediaReviewStore.getState()
    return (
      selectedGroup?.faces.find(face => face.id === selectedGroupFaceId) ||
      selectedGroup?.faces[0] ||
      null
    )
  }, [selectedGroup])

  const photoRecordByFaceId = useMemo(() => {
    return useMediaReviewStore.getState().getPhotoRecordByFaceId()
  }, [])

  const selectedGroupPhoto = useMemo(() => {
    if (!selectedGroupFace) return null
    return photoRecordByFaceId.get(selectedGroupFace.id) || null
  }, [selectedGroupFace, photoRecordByFaceId])

  const selectedGroupDraft = useMemo(() => {
    if (!selectedGroup) return null

    const firstFace = selectedGroupFace || selectedGroup.faces[0]
    const firstDraft = faceDrafts[firstFace.id] || normalizeFaceDraft(firstFace)

    return {
      confirmedName: firstDraft.confirmedName,
      personKey:
        firstDraft.personKey ||
        (firstDraft.confirmedName ? slugifyPerson(firstDraft.confirmedName) : ''),
      notes: firstDraft.notes,
    }
  }, [faceDrafts, selectedGroup, selectedGroupFace])

  const changedFaceIds = useMemo(() => {
    return useMediaReviewStore.getState().getChangedFaceIds()
  }, [])

  const changedFaceIdSet = useMemo(() => new Set(changedFaceIds), [changedFaceIds])

  const selectedGroupChangedFaceIds = useMemo(() => {
    if (!selectedGroup) return []
    return selectedGroup.faceIds.filter(faceId => changedFaceIdSet.has(faceId))
  }, [selectedGroup, changedFaceIdSet])

  const groupFacesForDisplay = useMemo(() => {
    if (!selectedGroup) return []
    return showAllGroupSamples ? selectedGroup.faces : selectedGroup.faces.slice(0, 12)
  }, [selectedGroup, showAllGroupSamples])

  const savingKey = useMediaReviewStore.getState().savingKey

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      if (!selectedGroup) return

      switch (event.key.toLowerCase()) {
        case 'y':
          stageGroupStatus('confirmed')
          break
        case 'n':
          stageGroupStatus('ignored')
          break
        case 's':
          event.preventDefault()
          onSaveFaces(selectedGroup.faceIds)
          break
        case 'arrowleft':
        case 'arrowup': {
          event.preventDefault()
          const idx = filteredGroups.findIndex(g => g.key === selectedGroup.key)
          if (idx > 0) {
            const prev = filteredGroups[idx - 1]
            setSelectedGroupKey(prev.key)
            setSelectedGroupFaceId(prev.faces[0]?.id || null)
            setShowAllGroupSamples(false)
          }
          break
        }
        case 'arrowright':
        case 'arrowdown': {
          event.preventDefault()
          const idx = filteredGroups.findIndex(g => g.key === selectedGroup.key)
          if (idx < filteredGroups.length - 1) {
            const next = filteredGroups[idx + 1]
            setSelectedGroupKey(next.key)
            setSelectedGroupFaceId(next.faces[0]?.id || null)
            setShowAllGroupSamples(false)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    selectedGroup,
    filteredGroups,
    stageGroupStatus,
    setSelectedGroupKey,
    setSelectedGroupFaceId,
    onSaveFaces,
  ])

  // ─── Batch confirm high-confidence groups ─────────────────────────────────
  const highConfidenceGroups = useMemo(
    () =>
      filteredGroups.filter(
        g => g.pendingCount > 0 && g.averageQuality >= HIGH_CONFIDENCE_THRESHOLD
      ),
    [filteredGroups]
  )

  const handleBatchConfirmHighConfidence = () => {
    highConfidenceGroups.forEach(group => {
      updateFacesDrafts(group.faceIds, { reviewStatus: 'confirmed' })
    })
  }

  if (faces.length === 0) {
    return null
  }

  return (
    <ComponentErrorBoundary componentName='Face Review Grid'>
      <div className='grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]'>
        {/* Left Panel - People Queue */}
        <div className='rounded-xl border border-gold-100 bg-white p-5 shadow-sm'>
          <div className='space-y-4'>
            <div className='flex items-start justify-between gap-2'>
              <div>
                <h3 className='text-lg font-medium text-charcoal-900'>People Queue</h3>
                <p className='mt-1 text-sm text-charcoal-500'>
                  Start with the biggest pending groups, then open the full photo only when the
                  samples are not enough.
                </p>
              </div>
              <button
                type='button'
                title='Keyboard shortcuts'
                onClick={() => setShowShortcuts(v => !v)}
                className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gold-100 bg-cream-50 text-charcoal-400 transition-colors hover:border-gold-300 hover:text-charcoal-700'
              >
                <Keyboard className='h-4 w-4' />
              </button>
            </div>

            {showShortcuts && (
              <div className='rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-3 text-xs text-charcoal-600'>
                <p className='mb-2 font-medium text-charcoal-800'>Keyboard shortcuts</p>
                <div className='grid grid-cols-2 gap-x-4 gap-y-1.5'>
                  {[
                    ['Y', 'Confirm group'],
                    ['N', 'Ignore group'],
                    ['S', 'Save group'],
                    ['← / ↑', 'Previous group'],
                    ['→ / ↓', 'Next group'],
                  ].map(([key, desc]) => (
                    <div key={key} className='flex items-center gap-2'>
                      <kbd className='rounded border border-charcoal-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-charcoal-700'>
                        {key}
                      </kbd>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
                <p className='mt-2 text-[10px] text-charcoal-400'>
                  Shortcuts inactive when an input is focused.
                </p>
              </div>
            )}

            {highConfidenceGroups.length > 0 && (
              <button
                type='button'
                onClick={handleBatchConfirmHighConfidence}
                className='flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-left text-sm text-emerald-800 transition-colors hover:bg-emerald-100/80'
              >
                <CheckCircle2 className='h-4 w-4 flex-shrink-0 text-emerald-600' />
                <span>
                  Batch confirm {highConfidenceGroups.length} high-confidence group
                  {highConfidenceGroups.length === 1 ? '' : 's'} (≥{HIGH_CONFIDENCE_THRESHOLD * 100}
                  %)
                </span>
              </button>
            )}

            <Input
              value={personSearch}
              onChange={event => setPersonSearch(event.target.value)}
              placeholder='Search person name, cluster, or photo path'
            />
          </div>

          <div className='mt-5 space-y-3'>
            {filteredGroups.map(group => {
              const isActive = selectedGroup?.key === group.key

              return (
                <button
                  key={group.key}
                  type='button'
                  onClick={() => {
                    setSelectedGroupKey(group.key)
                    setSelectedGroupFaceId(group.faces[0]?.id || null)
                    setShowAllGroupSamples(false)
                  }}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    isActive
                      ? 'border-gold-400 bg-gold-50'
                      : 'border-gold-100 bg-white hover:bg-cream-50'
                  )}
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-sm font-medium text-charcoal-900'>{group.label}</p>
                      <p className='mt-1 text-xs text-charcoal-500'>
                        {group.pendingCount} pending · {group.faces.length} faces · quality{' '}
                        {group.averageQuality.toFixed(1)}
                      </p>
                    </div>
                    <FolderOpen className='h-4 w-4 text-charcoal-400' />
                  </div>
                  <div className='mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-charcoal-400'>
                    <span>
                      {group.clusterCount} cluster{group.clusterCount === 1 ? '' : 's'}
                    </span>
                    {group.faceIds.some(faceId => changedFaceIdSet.has(faceId)) ? (
                      <span>unsaved edits</span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Panel - Group Detail */}
        <div className='rounded-xl border border-gold-100 bg-white p-5 shadow-sm'>
          {selectedGroup && selectedGroupDraft ? (
            <div className='space-y-5'>
              <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                  <h3 className='text-lg font-medium text-charcoal-900'>{selectedGroup.label}</h3>
                  <p className='mt-1 text-sm text-charcoal-500'>
                    {selectedGroup.faces.length} faces grouped here across{' '}
                    {selectedGroup.clusterCount} suggested cluster
                    {selectedGroup.clusterCount === 1 ? '' : 's'}.
                  </p>
                </div>

                <div className='flex flex-wrap gap-2'>
                  <Button size='sm' variant='secondary' onClick={() => stageGroupStatus('pending')}>
                    Return To Pending
                  </Button>
                  <Button size='sm' variant='secondary' onClick={() => stageGroupStatus('ignored')}>
                    Ignore
                  </Button>
                  <Button size='sm' onClick={() => stageGroupStatus('confirmed')}>
                    Confirm
                  </Button>
                </div>
              </div>

              <div className='grid gap-6'>
                <div className='space-y-5'>
                  <div className='grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]'>
                    <div className='overflow-hidden rounded-[1.4rem] border border-gold-100 bg-cream-50'>
                      {selectedGroupFace && cropPreviewUrls[selectedGroupFace.id] ? (
                        <img
                          src={cropPreviewUrls[selectedGroupFace.id]}
                          alt={getDraftFaceLabel(
                            selectedGroupFace,
                            faceDrafts[selectedGroupFace.id]
                          )}
                          className='aspect-square h-full w-full object-cover'
                        />
                      ) : (
                        <div className='flex aspect-square items-center justify-center text-xs text-charcoal-400'>
                          No crop
                        </div>
                      )}
                    </div>

                    <div className='space-y-4 rounded-[1.4rem] border border-gold-100 bg-cream-50/70 p-4'>
                      <div className='grid gap-4 md:grid-cols-2'>
                        <div>
                          <label
                            htmlFor='group-name'
                            className='mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500'
                          >
                            Confirmed name
                          </label>
                          <Input
                            id='group-name'
                            list='known-people-options'
                            value={selectedGroupDraft.confirmedName}
                            onChange={event => {
                              const confirmedName = event.target.value
                              updateFacesDrafts(selectedGroup.faceIds, {
                                confirmedName,
                                personKey: confirmedName ? slugifyPerson(confirmedName) : '',
                              })
                            }}
                            placeholder='Austin'
                          />
                        </div>

                        <div className='rounded-xl border border-gold-100 bg-white px-4 py-3 text-sm text-charcoal-500'>
                          <p className='text-xs uppercase tracking-[0.22em] text-charcoal-400'>
                            Unsaved in this group
                          </p>
                          <p className='mt-1 text-lg font-medium text-charcoal-900'>
                            {selectedGroupChangedFaceIds.length}
                          </p>
                        </div>
                      </div>

                      <div className='flex flex-wrap gap-2'>
                        <Button
                          size='sm'
                          onClick={() => onSaveFaces(selectedGroup.faceIds)}
                          disabled={savingKey === selectedGroup.faceIds.join(':')}
                        >
                          <Save className='mr-2 h-4 w-4' />
                          Save Group Changes
                        </Button>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => onResetFaces(selectedGroup.faceIds)}
                          disabled={selectedGroupChangedFaceIds.length === 0}
                        >
                          Reset Unsaved Changes
                        </Button>
                        {selectedGroupFace ? (
                          <Button
                            size='sm'
                            variant='secondary'
                            onClick={() => onOpenPhotoInspector(selectedGroupFace)}
                          >
                            Open Photo Inspector
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className='rounded-[1.4rem] border border-gold-100 bg-white p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div>
                        <h4 className='text-sm font-medium text-charcoal-900'>Sample Faces</h4>
                        <p className='mt-1 text-xs text-charcoal-500'>
                          Review the strongest examples first, then open the full photo only for
                          ambiguous faces.
                        </p>
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => {
                            const { selectedGroupFaceId } = useMediaReviewStore.getState()
                            if (!selectedGroupFace) return
                            const currentIndex = selectedGroup.faces.findIndex(
                              face => face.id === selectedGroupFaceId
                            )
                            const previousFace = selectedGroup.faces[Math.max(0, currentIndex - 1)]
                            if (previousFace) setSelectedGroupFaceId(previousFace.id)
                          }}
                        >
                          Previous
                        </Button>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => {
                            const { selectedGroupFaceId } = useMediaReviewStore.getState()
                            if (!selectedGroupFace) return
                            const currentIndex = selectedGroup.faces.findIndex(
                              face => face.id === selectedGroupFaceId
                            )
                            const nextFace =
                              selectedGroup.faces[
                                Math.min(selectedGroup.faces.length - 1, currentIndex + 1)
                              ]
                            if (nextFace) setSelectedGroupFaceId(nextFace.id)
                          }}
                        >
                          Next
                        </Button>
                        {selectedGroup.faces.length > 12 ? (
                          <Button
                            size='sm'
                            variant='secondary'
                            onClick={() => setShowAllGroupSamples(current => !current)}
                          >
                            {showAllGroupSamples
                              ? 'Show Fewer'
                              : `View More (${selectedGroup.faces.length})`}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className='mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                      {groupFacesForDisplay.map(face => {
                        const draft = faceDrafts[face.id] || normalizeFaceDraft(face)
                        const isActive = selectedGroupFace?.id === face.id
                        const samplePhoto = photoRecordByFaceId.get(face.id) || null

                        return (
                          <button
                            key={face.id}
                            type='button'
                            onClick={() => setSelectedGroupFaceId(face.id)}
                            className={cn(
                              'overflow-hidden rounded-[1.3rem] border text-left transition-colors',
                              isActive
                                ? 'border-gold-400 bg-gold-50'
                                : 'border-gold-100 bg-cream-50/60 hover:bg-cream-50'
                            )}
                          >
                            <div className='aspect-square overflow-hidden bg-white'>
                              {cropPreviewUrls[face.id] ? (
                                <img
                                  src={cropPreviewUrls[face.id]}
                                  alt={getDraftFaceLabel(face, draft)}
                                  className='h-full w-full object-cover'
                                />
                              ) : samplePhoto?.thumbnailUrl || samplePhoto?.photoUrl ? (
                                <img
                                  src={resolveReviewMediaPath(
                                    samplePhoto.thumbnailUrl || samplePhoto.photoUrl
                                  )}
                                  alt={
                                    samplePhoto?.sourceRelativePath ||
                                    getDraftFaceLabel(face, draft)
                                  }
                                  className='h-full w-full object-cover'
                                />
                              ) : (
                                <div className='flex h-full items-center justify-center text-xs text-charcoal-400'>
                                  No preview
                                </div>
                              )}
                            </div>
                            <div className='space-y-2 p-4'>
                              <div className='flex items-start justify-between gap-2'>
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
                              <p className='text-[11px] uppercase tracking-[0.18em] text-charcoal-400'>
                                Face crop from confirmed metadata
                              </p>
                              <p className='truncate text-xs text-charcoal-500'>
                                {face.source_relative_path || 'Unknown source'}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className='space-y-4'>
                  <div className='rounded-[1.4rem] border border-gold-100 bg-cream-50/70 p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h4 className='text-sm font-medium text-charcoal-900'>Source Photo</h4>
                        <p className='mt-1 text-xs text-charcoal-500'>
                          Face metadata stays primary here. Use the larger image only when you need
                          extra context for the selected crop.
                        </p>
                      </div>
                      {selectedGroupFace ? (
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => onOpenPhotoInspector(selectedGroupFace)}
                        >
                          Open Photo Inspector
                        </Button>
                      ) : null}
                    </div>
                    <div className='mt-4 overflow-hidden rounded-[1.2rem] border border-gold-100 bg-charcoal-950'>
                      {selectedGroupPhoto?.photoUrl ? (
                        <div className='relative aspect-[4/3] bg-charcoal-900'>
                          <img
                            src={resolveReviewMediaPath(selectedGroupPhoto.photoUrl)}
                            alt={selectedGroupPhoto.sourceRelativePath}
                            className='h-full w-full object-contain'
                          />
                          {selectedGroupFace ? (
                            <div
                              className='absolute rounded-md border-2 border-gold-400 bg-gold-400/15 ring-2 ring-white/90'
                              style={getOverlayStyle(selectedGroupFace)}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <div className='flex aspect-[4/3] items-center justify-center text-xs text-charcoal-400'>
                          No source preview
                        </div>
                      )}
                    </div>
                  </div>

                  <details className='rounded-[1.4rem] border border-gold-100 bg-white p-4'>
                    <summary className='cursor-pointer list-none text-sm font-medium text-charcoal-900'>
                      Details and notes
                    </summary>
                    <div className='mt-4 space-y-4'>
                      <div>
                        <label
                          htmlFor='group-key'
                          className='mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500'
                        >
                          Person key
                        </label>
                        <Input
                          id='group-key'
                          value={selectedGroupDraft.personKey}
                          onChange={event =>
                            updateFacesDrafts(selectedGroup.faceIds, {
                              personKey: event.target.value,
                            })
                          }
                          placeholder='austin'
                        />
                      </div>

                      <div>
                        <label
                          htmlFor='group-notes'
                          className='mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500'
                        >
                          Shared notes
                        </label>
                        <Textarea
                          id='group-notes'
                          value={selectedGroupDraft.notes}
                          onChange={event =>
                            updateFacesDrafts(selectedGroup.faceIds, { notes: event.target.value })
                          }
                          placeholder='Optional notes for this person group.'
                          className='min-h-[96px]'
                        />
                      </div>

                      {selectedGroupFace ? (
                        <div className='grid gap-2 rounded-xl border border-gold-100 bg-cream-50/70 p-4 text-sm text-charcoal-500'>
                          <p>
                            <span className='font-medium text-charcoal-900'>Cluster:</span>{' '}
                            {selectedGroupFace.cluster_id || 'None'}
                          </p>
                          <p>
                            <span className='font-medium text-charcoal-900'>Quality:</span>{' '}
                            {selectedGroupFace.quality_score ?? 'n/a'}
                          </p>
                          <p>
                            <span className='font-medium text-charcoal-900'>Source:</span>{' '}
                            {selectedGroupFace.source_relative_path || 'Unknown source'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          ) : (
            <div className='rounded-xl border border-dashed border-gold-200 p-6 text-sm text-charcoal-500'>
              Select a person group to rename, confirm, or ignore matching faces in bulk.
            </div>
          )}
        </div>
      </div>
    </ComponentErrorBoundary>
  )
}
