import { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Heart, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VirtualizedMasonryGrid } from './components/VirtualizedMasonryGrid'
import type { Photo } from '@/lib/supabase'

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo, index: number) => void
  onLike?: (photoId: string) => void
  className?: string
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photoId: string) => void
}

function PhotoLikeButton({
  photo,
  onLike,
}: {
  photo: Photo
  onLike?: (photoId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
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
      <Heart className={cn('h-4 w-4', photo.liked && 'fill-current')} />
    </button>
  )
}

function SelectOverlay({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={selected ? 'Deselect photo' : 'Select photo'}
      className="absolute inset-0 z-20 flex items-start justify-end p-3"
    >
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
          selected
            ? 'border-gold-500 bg-gold-500 text-white'
            : 'border-white/80 bg-black/30 text-transparent hover:border-gold-300'
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
      </span>

      {selected && (
        <span className="absolute inset-0 rounded-[inherit] ring-2 ring-gold-400 ring-offset-1" />
      )}
    </button>
  )
}

interface PrefetchMap {
  [url: string]: string
}

// Prefetch adjacent photos (±5 around current position = 11 total)
function prefetchAdjacentPhotos(
  currentIndex: number,
  photos: Photo[],
  prefetchMap: PrefetchMap
): void {
  const start = Math.max(0, currentIndex - 5)
  const end = Math.min(photos.length - 1, currentIndex + 5)

  for (let i = start; i <= end; i++) {
    if (i === currentIndex) continue
    const photo = photos[i]
    if (!photo) continue

    const url = photo.thumbnail || photo.url
    if (!prefetchMap[url]) {
      prefetchMap[url] = url

      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = url
      document.head.appendChild(link)
    }
  }
}

export function VirtualizedPhotoGrid({
  photos,
  onPhotoClick,
  onLike,
  className,
  selectMode,
  selectedIds,
  onToggleSelect,
}: PhotoGridProps) {
  const prefetchMapRef = useRef<PrefetchMap>({})

  // Prefetch photos around the center of the viewport
  const handleVisibleRangeChange = useCallback(
    (startIndex: number, endIndex: number) => {
      if (photos.length === 0) return

      const centerIndex = Math.floor((startIndex + endIndex) / 2)
      prefetchAdjacentPhotos(centerIndex, photos, prefetchMapRef.current)
    },
    [photos]
  )

  const renderPhoto = useCallback(
    (photo: Photo, globalIndex: number) => {
      const isSelected = selectedIds?.has(photo.id) ?? false

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={!selectMode ? { y: -6, scale: 1.02 } : {}}
          transition={{ duration: 0.5, delay: Math.min(globalIndex * 0.04, 0.5) }}
          className={cn(
            'group relative h-full overflow-hidden rounded-[1.8rem] border bg-white p-1 text-left',
            selectMode ? 'cursor-default' : 'cursor-pointer',
            isSelected ? 'border-gold-400/80' : 'border-white/80'
          )}
          style={{
            boxShadow: '0 26px 60px -42px rgba(46,33,13,0.24)',
            transition: 'box-shadow 0.3s ease',
          }}
          onMouseEnter={(e) => {
            if (!selectMode) {
              e.currentTarget.style.boxShadow =
                '0 34px 80px -46px rgba(201,160,92,0.35), 0 8px 20px -10px rgba(201,160,92,0.2)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 26px 60px -42px rgba(46,33,13,0.24)'
          }}
          onClick={() =>
            selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, globalIndex)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, globalIndex)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={
            selectMode
              ? isSelected
                ? `Deselect ${photo.caption || 'photo'}`
                : `Select ${photo.caption || 'photo'}`
              : photo.caption
                ? `Open photo: ${photo.caption}`
                : 'Open photo'
          }
          aria-pressed={selectMode ? isSelected : undefined}
        >
          <div className="relative h-full overflow-hidden rounded-[1.45rem] bg-charcoal-200">
            <motion.img
              src={photo.thumbnail || photo.url}
              alt={photo.caption || 'Wedding photo'}
              className="h-full w-full object-cover"
              loading="lazy"
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {selectMode ? (
              <SelectOverlay
                selected={isSelected}
                onToggle={() => onToggleSelect?.(photo.id)}
              />
            ) : (
              <PhotoLikeButton photo={photo} onLike={onLike} />
            )}
          </div>
        </motion.div>
      )
    },
    [selectMode, selectedIds, onPhotoClick, onLike, onToggleSelect]
  )

  return (
    <div className={cn('w-full', className)}>
      <VirtualizedMasonryGrid
        photos={photos}
        rowHeight={280}
        gap={8}
        onVisibleRangeChange={handleVisibleRangeChange}
      >
        {renderPhoto}
      </VirtualizedMasonryGrid>
    </div>
  )
}
