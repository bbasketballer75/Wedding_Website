import { useCallback, useState } from 'react'
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
import { cn } from '@/shared/lib/cn'
import type { PhotoAlbum } from '@/shared/data/photos'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { GallerySkeleton } from '@/shared/ui/Skeleton'
import type { AlbumOrganizerData, OrganizerPhoto } from './album-organizer-data'
import { organizerLabel, resolveOrganizerMediaPath } from './album-organizer-data'
import { useAlbumOrganizer } from './useAlbumOrganizer'

/**
 * `/admin/albums` — album organizer.
 *
 * Ported from the frozen `src/components/admin/AlbumOrganizer.tsx`. The drag
 * interaction is rebuilt without `@dnd-kit` (no new deps): each card is an
 * HTML5-draggable tile for the pointer path, and every card carries explicit
 * "Move earlier"/"Move later" buttons so reordering is fully keyboard-operable
 * (mandatory acceptance path).
 *
 * Data is injected (`AlbumOrganizerData`); the default binding is the Wave-3
 * data layer. All staged changes are dirty-diff only and are handed to the
 * injected `saveAlbumOrganization` on save.
 */
export interface AlbumOrganizerPageProps {
  /** Injected data seam; defaults to the typed data layer. */
  readonly data?: AlbumOrganizerData
}

function PhotoCard({
  photo,
  canDrag,
  selected,
  index,
  isFirst,
  isLast,
  dragging,
  moveTargetOptions,
  onToggleSelect,
  onMove,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveEarlier,
  onMoveLater,
}: {
  photo: OrganizerPhoto
  canDrag: boolean
  selected: boolean
  index: number
  isFirst: boolean
  isLast: boolean
  dragging: boolean
  moveTargetOptions: readonly PhotoAlbum[]
  onToggleSelect: (photoId: string) => void
  onMove: (photoId: string, targetAlbum: PhotoAlbum) => void
  onDelete: (photoId: string) => void
  onDragStart: (photoId: string) => void
  onDragOver: (event: React.DragEvent<HTMLElement>) => void
  onDrop: (overId: string) => void
  onMoveEarlier: (photoId: string) => void
  onMoveLater: (photoId: string) => void
}) {
  const label = organizerLabel(photo)

  return (
    <article
      draggable={canDrag}
      onDragStart={event => {
        event.dataTransfer?.setData('text/plain', photo.id)
        onDragStart(photo.id)
      }}
      onDragOver={onDragOver}
      onDrop={event => {
        event.preventDefault()
        onDrop(photo.id)
      }}
      data-testid={`organizer-photo-${photo.id}`}
      className={cn(
        'group overflow-hidden rounded-[1.1rem] border bg-white shadow-sm transition-all',
        selected ? 'border-gold-300 ring-2 ring-gold-200/70' : 'border-gold-100',
        dragging && 'opacity-60 ring-2 ring-gold-300/60'
      )}
    >
      <div className='relative aspect-square overflow-hidden bg-charcoal-100'>
        <img
          src={resolveOrganizerMediaPath(photo.thumbnail || photo.url)}
          alt={label}
          loading='lazy'
          className='h-full w-full object-cover'
        />
        <div className='absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2'>
          <span
            aria-hidden='true'
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm',
              canDrag
                ? 'border-white/40 bg-black/28 text-white'
                : 'cursor-not-allowed border-white/20 bg-black/15 text-white/45'
            )}
          >
            <GripVertical className='h-4 w-4' />
          </span>
          <button
            type='button'
            aria-label={selected ? `Unselect ${label}` : `Select ${label}`}
            aria-pressed={selected}
            onClick={() => onToggleSelect(photo.id)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
              selected
                ? 'border-gold-300 bg-gold-500 text-white'
                : 'border-white/40 bg-white/88 text-charcoal-700 hover:border-gold-200 hover:bg-white'
            )}
          >
            {selected ? (
              <CheckSquare className='h-4 w-4' aria-hidden='true' />
            ) : (
              <Square className='h-4 w-4' aria-hidden='true' />
            )}
          </button>
        </div>
      </div>

      <div className='space-y-2.5 px-3 py-3'>
        <p className='line-clamp-2 text-sm font-medium leading-5 text-charcoal-800'>{label}</p>

        <div className='flex flex-wrap items-center gap-2 text-[11px] text-charcoal-500'>
          <span>{photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : '—'}</span>
          <span className='inline-flex items-center gap-1 rounded-full bg-cream-50 px-2 py-1'>
            <Heart className='h-3 w-3 text-gold-600' aria-hidden='true' />
            {photo.likeCount}
          </span>
          <span className='inline-flex items-center gap-1 rounded-full bg-cream-50 px-2 py-1'>
            <MessageCircle className='h-3 w-3 text-gold-600' aria-hidden='true' />
            {photo.commentCount}
          </span>
          {photo.hiddenCommentCount > 0 && (
            <span className='inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700'>
              hidden {photo.hiddenCommentCount}
            </span>
          )}
        </div>

        <div className='flex items-center gap-2 text-[11px]'>
          <button
            type='button'
            onClick={() => onMoveEarlier(photo.id)}
            disabled={!canDrag || isFirst}
            aria-label={`Move ${label} earlier`}
            className='flex-1 rounded-full border border-gold-200 bg-white px-2 py-1.5 text-charcoal-700 transition-colors hover:border-gold-300 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-40'
          >
            ← Earlier
          </button>
          <button
            type='button'
            onClick={() => onMoveLater(photo.id)}
            disabled={!canDrag || isLast}
            aria-label={`Move ${label} later`}
            className='flex-1 rounded-full border border-gold-200 bg-white px-2 py-1.5 text-charcoal-700 transition-colors hover:border-gold-300 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-40'
          >
            Later →
          </button>
          <span className='sr-only'>Position {index + 1}</span>
        </div>

        <div className='flex items-center gap-2'>
          <select
            aria-label={`Move ${label} to another album`}
            value=''
            onChange={event => {
              const nextAlbum = event.target.value as PhotoAlbum
              if (nextAlbum) onMove(photo.id, nextAlbum)
            }}
            className='h-9 min-w-0 flex-1 rounded-full border border-gold-200 bg-white px-3 text-[11px] text-charcoal-700 outline-none transition-colors hover:border-gold-300 focus:border-gold-400'
          >
            <option value=''>Move to...</option>
            {moveTargetOptions.map(targetAlbum => (
              <option key={targetAlbum} value={targetAlbum}>
                {targetAlbum}
              </option>
            ))}
          </select>
          <button
            type='button'
            onClick={() => onDelete(photo.id)}
            className='flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100'
            aria-label={`Stage ${label} for deletion`}
          >
            <Trash2 className='h-4 w-4' aria-hidden='true' />
          </button>
        </div>
      </div>
    </article>
  )
}

function OrganizerEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
      <Images className='h-12 w-12 opacity-30' aria-hidden='true' />
      <p className='font-medium text-charcoal-700'>{title}</p>
      <p className='text-sm'>{description}</p>
    </div>
  )
}

export function AlbumOrganizerPage({ data }: AlbumOrganizerPageProps = {}) {
  const organizer = useAlbumOrganizer({ data })
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (overId: string) => {
      if (draggingId) organizer.reorder(draggingId, overId)
      setDraggingId(null)
    },
    [draggingId, organizer]
  )

  const isLoading = organizer.loadingAlbum === organizer.selectedAlbum

  return (
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
              {organizer.lastSavedSummary}
            </span>
            <Button
              variant='secondary'
              size='sm'
              onClick={organizer.resetDraft}
              disabled={!organizer.hasUnsavedChanges || organizer.savingAlbum !== null}
            >
              <RotateCcw className='mr-2 h-4 w-4' aria-hidden='true' />
              Reset
            </Button>
            <Button
              size='sm'
              onClick={() => void organizer.save()}
              disabled={!organizer.hasUnsavedChanges || organizer.savingAlbum !== null}
            >
              {organizer.savingAlbum !== null ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
              ) : (
                <Save className='mr-2 h-4 w-4' aria-hidden='true' />
              )}
              Save live order
            </Button>
          </div>
        </div>

        <div className='mt-4 flex flex-wrap gap-2 text-xs text-charcoal-600'>
          <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
            reorder {organizer.reorderCount}
          </span>
          <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
            moves {organizer.pendingMoves.length}
          </span>
          <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
            deletes {organizer.pendingDeletes.length}
          </span>
          <span className='rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5'>
            selected {organizer.selectedPhotoIds.length}
          </span>
          {organizer.hasUnsavedChanges && (
            <span className='rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700'>
              unsaved changes
            </span>
          )}
        </div>
        {organizer.saveError && (
          <p
            role='alert'
            className='mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700'
          >
            {organizer.saveError}
          </p>
        )}
      </section>

      <section className='rounded-[1.2rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
        <div className='flex flex-wrap gap-2' role='tablist' aria-label='Album selector'>
          {(['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads'] as const).map(album => (
            <button
              key={album}
              type='button'
              role='tab'
              aria-selected={organizer.selectedAlbum === album}
              onClick={() => organizer.selectAlbum(album)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                organizer.selectedAlbum === album
                  ? 'bg-gold-500 text-charcoal-900 shadow-sm'
                  : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70 hover:text-charcoal-800'
              )}
            >
              <span>{album}</span>
              <span className='text-xs opacity-70'>{organizer.countsByAlbum[album] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className='mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center'>
          <div className='relative'>
            <Search
              className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400'
              aria-hidden='true'
            />
            <Input
              value={organizer.searchQuery}
              onChange={event => organizer.setSearchQuery(event.target.value)}
              placeholder={`Find a photo in ${organizer.selectedAlbum}`}
              aria-label={`Find a photo in ${organizer.selectedAlbum}`}
              className='h-11 rounded-full border-gold-200/70 bg-cream-50/85 pl-11 shadow-none'
            />
          </div>

          <div className='inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-cream-50 px-4 py-2 text-sm text-charcoal-600'>
            <Images className='h-4 w-4 text-gold-500' aria-hidden='true' />
            {organizer.currentDraft.length} photos
          </div>

          {!organizer.canDrag && (
            <div className='justify-self-start rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 xl:justify-self-end'>
              Clear search to drag reorder.
            </div>
          )}
        </div>

        {organizer.selectedPhotoIds.length > 0 && (
          <div className='mt-4 rounded-[1rem] border border-gold-200 bg-cream-50/80 p-4'>
            <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
              <div>
                <p className='text-sm font-medium text-charcoal-900'>
                  {organizer.selectedPhotoIds.length} photo
                  {organizer.selectedPhotoIds.length === 1 ? '' : 's'} selected
                </p>
                <p className='text-xs text-charcoal-500'>
                  Use bulk tools for cleanup, then save once.
                </p>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button size='sm' variant='secondary' onClick={organizer.selectVisible}>
                  Select visible
                </Button>
                <Button size='sm' variant='secondary' onClick={organizer.clearSelection}>
                  Clear selection
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => organizer.moveSelectedToBoundary('top')}
                >
                  <ArrowUpToLine className='mr-2 h-4 w-4' aria-hidden='true' />
                  Move to top
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => organizer.moveSelectedToBoundary('bottom')}
                >
                  <ArrowDownToLine className='mr-2 h-4 w-4' aria-hidden='true' />
                  Move to bottom
                </Button>
              </div>
            </div>

            <div className='mt-3 grid gap-3 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto_auto] xl:items-center'>
              <select
                value={organizer.bulkMoveAlbum}
                onChange={event =>
                  organizer.setBulkMoveAlbum(event.target.value as PhotoAlbum | '')
                }
                aria-label='Bulk move selected photos to album'
                className='h-10 rounded-full border border-gold-200 bg-white px-3 text-sm text-charcoal-700 outline-none transition-colors hover:border-gold-300 focus:border-gold-400'
              >
                <option value=''>Bulk move to album...</option>
                {organizer.moveTargetOptions.map(album => (
                  <option key={album} value={album}>
                    {album}
                  </option>
                ))}
              </select>

              <select
                value={organizer.bulkAfterTargetId}
                onChange={event => organizer.setBulkAfterTargetId(event.target.value)}
                aria-label='Place selected photos after another photo'
                className='h-10 rounded-full border border-gold-200 bg-white px-3 text-sm text-charcoal-700 outline-none transition-colors hover:border-gold-300 focus:border-gold-400'
              >
                <option value=''>Place after...</option>
                {organizer.moveAfterOptions.map(photo => (
                  <option key={photo.id} value={photo.id}>
                    {organizerLabel(photo)}
                  </option>
                ))}
              </select>

              <Button
                size='sm'
                variant='secondary'
                onClick={() => {
                  if (organizer.bulkMoveAlbum) organizer.bulkMoveSelected(organizer.bulkMoveAlbum)
                }}
                disabled={!organizer.bulkMoveAlbum}
              >
                <ArrowRightLeft className='mr-2 h-4 w-4' aria-hidden='true' />
                Move selected
              </Button>

              <Button size='sm' variant='danger' onClick={organizer.bulkDeleteSelected}>
                <Trash2 className='mr-2 h-4 w-4' aria-hidden='true' />
                Remove selected
              </Button>
            </div>

            <div className='mt-3 flex flex-wrap gap-2'>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => organizer.moveSelectedAfterAnchor(organizer.bulkAfterTargetId)}
                disabled={!organizer.bulkAfterTargetId}
              >
                Place after selected photo
              </Button>
            </div>
          </div>
        )}

        {organizer.pendingMoves.length > 0 && (
          <div className='mt-4 rounded-[1rem] border border-gold-100 bg-cream-50/80 p-4'>
            <div className='flex items-center gap-2 text-sm font-medium text-charcoal-800'>
              <ArrowRightLeft className='h-4 w-4 text-gold-600' aria-hidden='true' />
              {organizer.pendingMoves.length} photo
              {organizer.pendingMoves.length === 1 ? '' : 's'} will move when you save
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
              {organizer.pendingMoves.map(move => (
                <button
                  key={move.photo.id}
                  type='button'
                  onClick={() => organizer.undoMove(move.photo.id)}
                  className='inline-flex items-center gap-2 rounded-full border border-gold-200 bg-white px-3 py-1.5 text-xs text-charcoal-600 transition-colors hover:border-gold-300 hover:bg-gold-50'
                >
                  <span className='max-w-[14rem] truncate'>{organizerLabel(move.photo)}</span>
                  <span className='text-charcoal-400'>to {move.targetAlbum}</span>
                  <span className='text-gold-700'>Undo</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {organizer.pendingDeletes.length > 0 && (
          <div className='mt-4 rounded-[1rem] border border-rose-200 bg-rose-50/80 p-4'>
            <div className='flex items-center gap-2 text-sm font-medium text-rose-800'>
              <Trash2 className='h-4 w-4 text-rose-600' aria-hidden='true' />
              {organizer.pendingDeletes.length} photo
              {organizer.pendingDeletes.length === 1 ? '' : 's'} will be removed from the live
              gallery when you save
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
              {organizer.pendingDeletes.map(deletion => (
                <button
                  key={deletion.photo.id}
                  type='button'
                  onClick={() => organizer.undoDelete(deletion.photo.id)}
                  className='inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700 transition-colors hover:bg-rose-100'
                >
                  <span className='max-w-[14rem] truncate'>{organizerLabel(deletion.photo)}</span>
                  <span>Undo</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className='rounded-[1.25rem] border border-gold-100 bg-white/95 p-4 shadow-sm'>
        {isLoading && organizer.currentSaved.length === 0 ? (
          <div className='min-h-[22rem] p-6' role='status' aria-label='Loading album photos'>
            <GallerySkeleton count={12} />
          </div>
        ) : organizer.filteredDraft.length === 0 ? (
          <OrganizerEmptyState
            title={
              organizer.searchQuery.trim()
                ? 'No photos match that search.'
                : `No photos in ${organizer.selectedAlbum} yet.`
            }
            description={
              organizer.searchQuery.trim()
                ? 'Try a different search term or clear the filter.'
                : 'Add photos to this album to get started.'
            }
          />
        ) : (
          <div className='h-[72vh] min-h-[32rem] overflow-y-auto pr-1'>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
              {organizer.filteredDraft.map((photo, index) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  canDrag={organizer.canDrag}
                  selected={organizer.selectedPhotoIdSet.has(photo.id)}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === organizer.filteredDraft.length - 1}
                  dragging={draggingId === photo.id}
                  moveTargetOptions={organizer.moveTargetOptions}
                  onToggleSelect={organizer.toggleSelected}
                  onMove={organizer.movePhotoToAlbum}
                  onDelete={organizer.deletePhoto}
                  onDragStart={setDraggingId}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onMoveEarlier={photoId => organizer.movePhotoBy(photoId, -1)}
                  onMoveLater={photoId => organizer.movePhotoBy(photoId, 1)}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
