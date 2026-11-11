import { Heart, CheckCircle2 } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/shared/lib/cn'
import type { GalleryPhoto } from './data'
import type { ViewMode } from './constants'
import { INTRINSIC_RATIOS } from './intrinsic-ratios'

export interface PhotoTileProps {
  /**
   * Grid/timeline tiles need an aspect-ratio box; the frozen masonry sizes tiles
   * from the image's intrinsic ratio at a fixed row height, so an inline
   * aspect-ratio there would overflow a narrow portrait tile.
   */
  lockedAspect?: boolean
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
  lockedAspect = true,
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
        style={lockedAspect ? { aspectRatio: String(photo.aspectRatio || 1) } : undefined}
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
 * Port of the frozen virtualized masonry PACKING (not the virtualization):
 * `useVirtualizedMasonry` packs photos into rows using each photo's aspect ratio
 * at a 280px row height, gap 8, target width `innerWidth - 32`, capped at the
 * base/sm/md/lg column count. Tiles are flex-shrink-0, height 280 with an image
 * area of 270px (p-1 + border). CSS `columns-*` and index-distributed flex
 * columns both produced different geometry/DOM order and failed pixel parity.
 */
const MASONRY_COLUMNS = { base: 1, sm: 2, md: 3, lg: 4 } as const
const MASONRY_ROW_HEIGHT = 280
const MASONRY_IMAGE_HEIGHT = MASONRY_ROW_HEIGHT - 10

interface MasonryRow {
  startIndex: number
  photos: GalleryPhoto[]
}

function getMasonryColumnCount(): number {
  if (typeof window === 'undefined') return MASONRY_COLUMNS.lg
  const width = window.innerWidth
  if (width >= 1024) return MASONRY_COLUMNS.lg
  if (width >= 768) return MASONRY_COLUMNS.md
  if (width >= 640) return MASONRY_COLUMNS.sm
  return MASONRY_COLUMNS.base
}

function useMasonryLayout(): {
  columnCount: number
  targetWidth: number
  containerRef: RefObject<HTMLDivElement | null>
} {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState(() => ({
    columnCount: getMasonryColumnCount(),
    targetWidth: 0,
  }))

  useEffect(() => {
    const element = containerRef.current
    const update = () => {
      const measured = element?.clientWidth ?? 0
      setLayout({
        columnCount: getMasonryColumnCount(),
        targetWidth: measured > 0 ? measured : window.innerWidth - 32,
      })
    }
    update()
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && element) {
      observer = new ResizeObserver(update)
      observer.observe(element)
    }
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return { ...layout, containerRef }
}

function packMasonryRows(
  photos: readonly GalleryPhoto[],
  columnCount: number,
  targetWidth: number
): MasonryRow[] {
  const rows: MasonryRow[] = []
  let current: MasonryRow = { startIndex: 0, photos: [] }
  let currentWidth = 0

  photos.forEach((photo, index) => {
    const aspectRatio = photo.aspectRatio || 1.5
    const scaledWidth = MASONRY_IMAGE_HEIGHT * aspectRatio

    if (current.photos.length > 0 && currentWidth + scaledWidth > targetWidth) {
      rows.push(current)
      current = { startIndex: index, photos: [] }
      currentWidth = 0
    }

    current.photos.push(photo)
    currentWidth += scaledWidth

    if (current.photos.length >= columnCount) {
      rows.push(current)
      current = { startIndex: index + 1, photos: [] }
      currentWidth = 0
    }
  })

  if (current.photos.length > 0) rows.push(current)

  return rows
}

export function PhotoGrid({
  photos,
  viewMode,
  selectMode,
  selectedIds,
  onPhotoClick,
  onLike,
  onToggleSelect,
}: PhotoGridProps) {
  const { columnCount, targetWidth, containerRef } = useMasonryLayout()

  const renderTile = (photo: GalleryPhoto, index: number, lockedAspect = true) => (
    <PhotoTile
      key={photo.id}
      photo={photo}
      index={index}
      lockedAspect={lockedAspect}
      selectMode={selectMode}
      isSelected={selectedIds?.has(photo.id) ?? false}
      onPhotoClick={onPhotoClick}
      onLike={onLike}
      onToggleSelect={onToggleSelect}
    />
  )

  if (viewMode === 'masonry') {
    const rows = packMasonryRows(photos, columnCount, targetWidth)

    return (
      <div
        ref={containerRef}
        className='flex w-full flex-col gap-2'
        data-testid='gallery-photo-grid'
      >
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className='flex gap-2'
            style={{ height: `${MASONRY_ROW_HEIGHT}px` }}
          >
            {row.photos.map((photo, photoIndex) => {
              const intrinsic =
                INTRINSIC_RATIOS[photo.url] ??
                (photo.thumbnail ? INTRINSIC_RATIOS[photo.thumbnail] : undefined) ??
                photo.aspectRatio ??
                1.5
              const width = Math.round(MASONRY_IMAGE_HEIGHT * intrinsic) + 10
              return (
                <div
                  key={photo.id}
                  className='h-full flex-shrink-0'
                  style={{ width: `${width}px` }}
                >
                  {renderTile(photo, row.startIndex + photoIndex, false)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className='grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
      data-testid='gallery-photo-grid'
    >
      {photos.map((photo, index) => renderTile(photo, index))}
    </div>
  )
}
