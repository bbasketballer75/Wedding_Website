import { Heart, CheckCircle2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { GalleryPhoto } from './data'
import type { ViewMode } from './constants'

export interface PhotoTileProps {
  photo: GalleryPhoto
  index: number
  selectMode?: boolean
  isSelected?: boolean
  onPhotoClick?: (photo: GalleryPhoto, index: number) => void
  onLike?: (photoId: string) => void
  onToggleSelect?: (photoId: string) => void
}

/**
 * One gallery tile. Ported from the frozen `VirtualizedPhotoItem`
 * (`src/components/gallery/VirtualizedPhotoGrid.tsx`) with the same DOM/classes
 * and keyboard/ARIA contract. Deltas (documented in the task report): the
 * rebuild has no virtualization dependency yet, so the parent lays tiles out
 * with CSS instead of `@tanstack/react-virtual`; long-press select and adjacent
 * image prefetch are deferred with the virtualization pass.
 */
export function PhotoTile({
  photo,
  index,
  selectMode = false,
  isSelected = false,
  onPhotoClick,
  onLike,
  onToggleSelect,
}: PhotoTileProps) {
  const label = photo.caption || 'photo'
  const ariaLabel = selectMode
    ? isSelected
      ? `Deselect ${label}`
      : `Select ${label}`
    : photo.caption
      ? `Open photo: ${photo.caption}`
      : 'Open photo'

  const handleActivate = () => {
    if (selectMode) {
      onToggleSelect?.(photo.id)
    } else {
      onPhotoClick?.(photo, index)
    }
  }

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selectMode ? isSelected : undefined}
      onClick={handleActivate}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleActivate()
        }
      }}
      className={cn(
        'group relative h-full overflow-hidden rounded-[1.8rem] border bg-white p-1 text-left transition-shadow duration-300',
        selectMode ? 'cursor-default' : 'cursor-pointer',
        isSelected ? 'border-gold-400/80' : 'border-white/80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2'
      )}
      style={{ boxShadow: '0 26px 60px -42px rgba(46,33,13,0.24)' }}
    >
      <div
        className='relative h-full overflow-hidden rounded-[1.45rem] bg-charcoal-200'
        style={{ aspectRatio: String(photo.aspectRatio || 1) }}
      >
        <img
          src={photo.thumbnail || photo.url}
          alt={photo.caption || 'Wedding photo'}
          className='h-full w-full object-cover'
          loading='lazy'
        />
        {/* Gradient overlay on hover */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
        {selectMode ? (
          <SelectOverlay
            selected={isSelected}
            onToggle={() => onToggleSelect?.(photo.id)}
            label={label}
          />
        ) : (
          <PhotoLikeButton photo={photo} onLike={onLike} />
        )}
      </div>
    </div>
  )
}

function PhotoLikeButton({
  photo,
  onLike,
}: {
  photo: GalleryPhoto
  onLike?: (photoId: string) => void
}) {
  return (
    <button
      type='button'
      onClick={event => {
        event.stopPropagation()
        onLike?.(photo.id)
      }}
      aria-label={photo.liked ? 'Unlike photo' : 'Like photo'}
      className={cn(
        'absolute bottom-3 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all',
        photo.liked
          ? 'border-rose-300/80 bg-rose-500 text-white shadow-[0_14px_35px_-20px_rgba(244,63,94,0.9)]'
          : 'border-white/35 bg-black/28 text-white/92 hover:bg-black/42'
      )}
    >
      <Heart className={cn('h-4 w-4', photo.liked && 'fill-current')} aria-hidden='true' />
    </button>
  )
}

function SelectOverlay({
  selected,
  onToggle,
  label,
}: {
  selected: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type='button'
      onClick={event => {
        event.stopPropagation()
        onToggle()
      }}
      aria-label={selected ? `Deselect ${label}` : `Select ${label}`}
      className='absolute inset-0 z-20 flex items-start justify-end p-3'
    >
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
          selected
            ? 'border-gold-500 bg-gold-500 text-white'
            : 'border-white/80 bg-black/30 text-transparent hover:border-gold-300'
        )}
      >
        <CheckCircle2 className='h-4 w-4' aria-hidden='true' />
      </span>

      {selected && (
        <span className='absolute inset-0 rounded-[inherit] ring-2 ring-gold-400 ring-offset-1' />
      )}
    </button>
  )
}

export interface PhotoGridProps extends Omit<PhotoTileProps, 'photo' | 'index' | 'isSelected'> {
  photos: GalleryPhoto[]
  viewMode: ViewMode
  selectedIds?: ReadonlySet<string>
}

/**
 * CSS-layout replacement for the frozen `VirtualizedPhotoGrid`:
 * masonry = balanced columns, grid = responsive grid. Timeline reuses the grid
 * (the frozen `GalleryGrid` did the same; `TimelineView` is a dead module).
 */
export function PhotoGrid({
  photos,
  viewMode,
  selectMode,
  selectedIds,
  onPhotoClick,
  onLike,
  onToggleSelect,
}: PhotoGridProps) {
  const layoutClass =
    viewMode === 'masonry'
      ? 'columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid'
      : 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'

  return (
    <div className={cn('w-full', layoutClass)} data-testid='gallery-photo-grid'>
      {photos.map((photo, index) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          index={index}
          selectMode={selectMode}
          isSelected={selectedIds?.has(photo.id) ?? false}
          onPhotoClick={onPhotoClick}
          onLike={onLike}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )
}
