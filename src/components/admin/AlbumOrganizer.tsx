import React from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type PhotoAlbum, PHOTO_ALBUMS } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GallerySkeleton } from '@/components/ui/Skeleton'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { cn } from '@/lib/utils'
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpToLine,
  CheckSquare,
  GripVertical,
  Heart,
  Images,
  Loader2,
  MessageCircle,
  RotateCcw,
  Save,
  Search,
  Square,
  Trash2,
} from 'lucide-react'
import { moveSelectOptions, type OrganizerPhoto } from './organizerUtils'
import { useAlbumOrganizer } from './useAlbumOrganizer'

function SortablePhotoCard({
  album,
  photo,
  canDrag,
  selected,
  onToggleSelect,
  onMove,
  onDelete,
}: {
  album: PhotoAlbum
  photo: OrganizerPhoto
  canDrag: boolean
  selected: boolean
  onToggleSelect: (photoId: string) => void
  onMove: (photoId: string, targetAlbum: PhotoAlbum) => void
  onDelete: (photoId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    disabled: !canDrag,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'group overflow-hidden rounded-[1.1rem] border bg-white shadow-sm transition-all',
        selected ? 'border-gold-300 ring-2 ring-gold-200/70' : 'border-gold-100',
        isDragging && 'shadow-[0_24px_54px_-26px_rgba(46,33,13,0.34)] ring-2 ring-gold-300/60'
      )}
    >
      <div className='relative aspect-square overflow-hidden bg-charcoal-100'>
        <img
          src={photo.resolvedThumbnail || photo.resolvedUrl}
          alt={photo.displayLabel}
          loading='lazy'
          className='h-full w-full object-cover'
        />

        <div className='absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2'>
          <button
            type='button'
            aria-label={canDrag ? `Drag ${photo.displayLabel}` : 'Clear search to drag reorder'}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
              canDrag
                ? 'border-white/40 bg-black/28 text-white hover:bg-black/40'
                : 'cursor-not-allowed border-white/20 bg-black/15 text-white/45'
            )}
            {...attributes}
            {...listeners}
            disabled={!canDrag}
          >
            <GripVertical className='h-4 w-4' />
          </button>

          <button
            type='button'
            aria-label={
              selected ? `Unselect ${photo.displayLabel}` : `Select ${photo.displayLabel}`
            }
            onClick={() => onToggleSelect(photo.id)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
              selected
                ? 'border-gold-300 bg-gold-500 text-white'
                : 'border-white/40 bg-white/88 text-charcoal-700 hover:border-gold-200 hover:bg-white'
            )}
          >
            {selected ? <CheckSquare className='h-4 w-4' /> : <Square className='h-4 w-4' />}
          </button>
        </div>
      </div>

      <div className='space-y-2.5 px-3 py-3'>
        <p className='line-clamp-2 text-sm font-medium leading-5 text-charcoal-800'>
          {photo.displayLabel}
        </p>

        <div className='flex flex-wrap items-center gap-2 text-[11px] text-charcoal-500'>
          <span>{new Date(photo.created_at).toLocaleDateString()}</span>
          <span className='inline-flex items-center gap-1 rounded-full bg-cream-50 px-2 py-1'>
            <Heart className='h-3 w-3 text-gold-600' />
            {photo.likeCount}
          </span>
          <span className='inline-flex items-center gap-1 rounded-full bg-cream-50 px-2 py-1'>
            <MessageCircle className='h-3 w-3 text-gold-600' />
            {photo.commentCount}
          </span>
          {photo.hiddenCommentCount > 0 && (
            <span className='inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700'>
              hidden {photo.hiddenCommentCount}
            </span>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <select
            aria-label={`Move ${photo.displayLabel} to another album`}
            value=''
            onChange={event => {
              const nextAlbum = event.target.value as PhotoAlbum
              if (nextAlbum) {
                onMove(photo.id, nextAlbum)
              }
            }}
            className='h-9 min-w-0 flex-1 rounded-full border border-gold-200 bg-white px-3 text-[11px] text-charcoal-700 outline-none transition-colors hover:border-gold-300 focus:border-gold-400'
          >
            <option value=''>Move to...</option>
            {moveSelectOptions(album).map(targetAlbum => (
              <option key={targetAlbum} value={targetAlbum}>
                {targetAlbum}
              </option>
            ))}
          </select>
          <button
            type='button'
            onClick={() => onDelete(photo.id)}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100'
            aria-label={`Stage ${photo.displayLabel} for deletion`}
          >
            <Trash2 className='h-4 w-4' />
          </button>
        </div>
      </div>
    </article>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
      <Icon className='h-12 w-12 opacity-30' />
      <p className='font-medium text-charcoal-700'>{title}</p>
      <p className='text-sm'>{description}</p>
    </div>
  )
}

export function AlbumOrganizer() {
  const {
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
    moveAfterOptions,
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
  } = useAlbumOrganizer()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  return (
    <ComponentErrorBoundary componentName='Album Organizer'>
      <div className='space-y-4'>
        <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
          <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
            <div>
              <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
                Album organizer
              </p>
              <h2 className='mt-1 font-display text-[1.7rem] text-charcoal-900'>
                Arrange the live gallery albums.
              </h2>
              <p className='mt-1 text-sm leading-6 text-charcoal-500'>
                Drag for fine ordering, use bulk actions for cleanup, and save only when the album
                feels right.
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5 text-xs text-charcoal-600'>
                {lastSavedSummary}
              </span>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleReset}
                disabled={!hasUnsavedChanges || savingAlbum === selectedAlbum}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reset
              </Button>
              <Button
                size='sm'
                onClick={handleSave}
                disabled={!hasUnsavedChanges || savingAlbum === selectedAlbum}
              >
                {savingAlbum === selectedAlbum ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Save className='mr-2 h-4 w-4' />
                )}
                Save live order
              </Button>
            </div>
          </div>

          <div className='mt-4 flex flex-wrap gap-2 text-xs text-charcoal-600'>
            <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
              reorder {reorderCount}
            </span>
            <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
              moves {pendingMoves.length}
            </span>
            <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
              deletes {pendingDeletes.length}
            </span>
            <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
              selected {selectedPhotoIds.length}
            </span>
          </div>
        </section>

        <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
          <div className='flex flex-wrap gap-2'>
            {PHOTO_ALBUMS.map(album => (
              <button
                key={album}
                type='button'
                onClick={() => setSelectedAlbum(album)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                  selectedAlbum === album
                    ? 'cinematic-toggle-active'
                    : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70 hover:text-charcoal-800'
                )}
              >
                <span>{album}</span>
                <span
                  className={cn(
                    'text-xs',
                    selectedAlbum === album ? 'text-charcoal-700/80' : 'text-charcoal-400'
                  )}
                >
                  {countsByAlbum[album] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className='mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center'>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400' />
              <Input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={`Find a photo in ${selectedAlbum}`}
                className='h-11 rounded-full border-gold-200/70 bg-cream-50/85 pl-11 shadow-none'
              />
            </div>

            <div className='inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-cream-50 px-4 py-2 text-sm text-charcoal-600'>
              <Images className='h-4 w-4 text-gold-500' />
              {currentDraft.length} photos
            </div>

            {!canDrag && (
              <div className='justify-self-start rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 xl:justify-self-end'>
                Clear search to drag reorder.
              </div>
            )}
          </div>

          {selectedPhotoIds.length > 0 && (
            <div className='mt-4 rounded-[1rem] border border-gold-200 bg-cream-50/80 p-4'>
              <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
                <div>
                  <p className='text-sm font-medium text-charcoal-900'>
                    {selectedPhotoIds.length} photo{selectedPhotoIds.length === 1 ? '' : 's'}{' '}
                    selected
                  </p>
                  <p className='text-xs text-charcoal-500'>
                    Use bulk tools for cleanup, then save once.
                  </p>
                </div>

                <div className='flex flex-wrap gap-2'>
                  <Button size='sm' variant='secondary' onClick={handleSelectVisible}>
                    Select visible
                  </Button>
                  <Button size='sm' variant='secondary' onClick={handleClearSelection}>
                    Clear selection
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => handleMoveSelectedToBoundary('top')}
                  >
                    <ArrowUpToLine className='mr-2 h-4 w-4' />
                    Move to top
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => handleMoveSelectedToBoundary('bottom')}
                  >
                    <ArrowDownToLine className='mr-2 h-4 w-4' />
                    Move to bottom
                  </Button>
                </div>
              </div>

              <div className='mt-3 grid gap-3 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto_auto] xl:items-center'>
                <select
                  value={bulkMoveAlbum}
                  onChange={event => setBulkMoveAlbum(event.target.value as PhotoAlbum | '')}
                  aria-label='Bulk move selected photos to album'
                  className='h-10 rounded-full border border-gold-200 bg-white px-3 text-sm text-charcoal-700 outline-none transition-colors hover:border-gold-300 focus:border-gold-400'
                >
                  <option value=''>Bulk move to album...</option>
                  {moveSelectOptions(selectedAlbum).map(album => (
                    <option key={album} value={album}>
                      {album}
                    </option>
                  ))}
                </select>

                <select
                  value={bulkAfterTargetId}
                  onChange={event => setBulkAfterTargetId(event.target.value)}
                  aria-label='Place selected photos after another photo'
                  className='h-10 rounded-full border border-gold-200 bg-white px-3 text-sm text-charcoal-700 outline-none transition-colors hover:border-gold-300 focus:border-gold-400'
                >
                  <option value=''>Place after...</option>
                  {moveAfterOptions.map(photo => (
                    <option key={photo.id} value={photo.id}>
                      {photo.displayLabel}
                    </option>
                  ))}
                </select>

                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => {
                    if (bulkMoveAlbum) {
                      handleBulkMove(bulkMoveAlbum)
                    }
                  }}
                  disabled={!bulkMoveAlbum}
                >
                  <ArrowRightLeft className='mr-2 h-4 w-4' />
                  Move selected
                </Button>

                <Button size='sm' variant='danger' onClick={handleBulkDelete}>
                  <Trash2 className='mr-2 h-4 w-4' />
                  Remove selected
                </Button>
              </div>

              <div className='mt-3 flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => handleMoveSelectedAfter(bulkAfterTargetId)}
                  disabled={!bulkAfterTargetId}
                >
                  Place after selected photo
                </Button>
              </div>
            </div>
          )}

          {pendingMoves.length > 0 && (
            <div className='mt-4 rounded-[1rem] border border-gold-100 bg-cream-50/80 p-4'>
              <div className='flex items-center gap-2 text-sm font-medium text-charcoal-800'>
                <ArrowRightLeft className='h-4 w-4 text-gold-600' />
                {pendingMoves.length} photo{pendingMoves.length === 1 ? '' : 's'} will move when you
                save
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                {pendingMoves.map(move => (
                  <button
                    key={move.photo.id}
                    type='button'
                    onClick={() => handleUndoMove(move.photo.id)}
                    className='inline-flex items-center gap-2 rounded-full border border-gold-200 bg-white px-3 py-1.5 text-xs text-charcoal-600 transition-colors hover:border-gold-300 hover:bg-gold-50'
                  >
                    <span className='max-w-[14rem] truncate'>{move.photo.displayLabel}</span>
                    <span className='text-charcoal-400'>to {move.targetAlbum}</span>
                    <span className='text-gold-700'>Undo</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {pendingDeletes.length > 0 && (
            <div className='mt-4 rounded-[1rem] border border-rose-200 bg-rose-50/80 p-4'>
              <div className='flex items-center gap-2 text-sm font-medium text-rose-800'>
                <Trash2 className='h-4 w-4 text-rose-600' />
                {pendingDeletes.length} photo{pendingDeletes.length === 1 ? '' : 's'} will be
                removed from the live gallery when you save
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                {pendingDeletes.map(deletion => (
                  <button
                    key={deletion.photo.id}
                    type='button'
                    onClick={() => handleUndoDelete(deletion.photo.id)}
                    className='inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700 transition-colors hover:bg-rose-100'
                  >
                    <span className='max-w-[14rem] truncate'>{deletion.photo.displayLabel}</span>
                    <span>Undo</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className='rounded-[1.25rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
          {loadingAlbum === selectedAlbum && currentSaved.length === 0 ? (
            <div className='min-h-[22rem] p-6'>
              <GallerySkeleton count={12} />
            </div>
          ) : filteredDraft.length === 0 ? (
            <EmptyState
              icon={Images}
              title={
                searchQuery.trim()
                  ? 'No photos match that search.'
                  : `No photos in ${selectedAlbum} yet.`
              }
              description={
                searchQuery.trim()
                  ? 'Try a different search term or clear the filter.'
                  : 'Add photos to this album to get started.'
              }
            />
          ) : (
            <div className='h-[72vh] min-h-[32rem] overflow-y-auto pr-1'>
              {canDrag ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={currentDraft.map(photo => photo.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className='grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'>
                      {currentDraft.map(photo => (
                        <SortablePhotoCard
                          key={photo.id}
                          album={selectedAlbum}
                          photo={photo}
                          canDrag={canDrag}
                          selected={selectedPhotoIdSet.has(photo.id)}
                          onToggleSelect={handleToggleSelected}
                          onMove={handleMovePhoto}
                          onDelete={handleDeletePhoto}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'>
                  {filteredDraft.map(photo => (
                    <SortablePhotoCard
                      key={photo.id}
                      album={selectedAlbum}
                      photo={photo}
                      canDrag={false}
                      selected={selectedPhotoIdSet.has(photo.id)}
                      onToggleSelect={handleToggleSelected}
                      onMove={handleMovePhoto}
                      onDelete={handleDeletePhoto}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </ComponentErrorBoundary>
  )
}
