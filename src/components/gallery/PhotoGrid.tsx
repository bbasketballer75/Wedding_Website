import { motion } from 'framer-motion'
import { Heart, Images, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import MasonryGrid from './components/MasonryGrid'

interface Photo {
  id: string
  url: string
  thumbnail: string
  caption?: string
  photographer?: string
  likes?: number
  aspectRatio?: number
  source?: 'professional' | 'guest'
  collection?: string
  liked?: boolean
}

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

const MASONRY_COLUMNS = { base: 1, sm: 2, md: 3, lg: 4 } as const

function SelectOverlay({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-label={selected ? 'Deselect photo' : 'Select photo'}
      className="absolute inset-0 z-20 flex items-start justify-end p-3"
    >
      <span className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
        selected
          ? 'border-gold-500 bg-gold-500 text-white'
          : 'border-white/80 bg-black/30 text-transparent hover:border-gold-300'
      )}>
        <CheckCircle2 className="h-4 w-4" />
      </span>

      {selected && <span className="absolute inset-0 rounded-[inherit] ring-2 ring-gold-400 ring-offset-1" />}
    </button>

  )

}

function MasonryPhotoGrid({ photos, onPhotoClick, onLike, selectMode, selectedIds, onToggleSelect }: PhotoGridProps) {

  return (
    <MasonryGrid columns={MASONRY_COLUMNS}>
      {photos.map((photo, index) => {
        const isSelected = selectedIds?.has(photo.id) ?? false
        return (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={!selectMode ? { y: -6, scale: 1.02 } : {}}
            transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.5) }}
            className={cn(
              'group relative overflow-hidden rounded-[1.8rem] border bg-white p-1 text-left',
              selectMode ? 'cursor-default' : 'cursor-pointer',
              isSelected ? 'border-gold-400/80' : 'border-white/80'
            )}
            style={{
              boxShadow: '0 26px 60px -42px rgba(46,33,13,0.24)',
              transition: 'box-shadow 0.3s ease'
            }}
            onMouseEnter={(e) => {
              if (!selectMode) {
                e.currentTarget.style.boxShadow = '0 34px 80px -46px rgba(201,160,92,0.35), 0 8px 20px -10px rgba(201,160,92,0.2)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 26px 60px -42px rgba(46,33,13,0.24)'
            }}
            onClick={() => selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, index)}
            onKeyDown={(event) => {

              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, index)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={selectMode ? (isSelected ? `Deselect ${photo.caption || 'photo'}` : `Select ${photo.caption || 'photo'}`) : (photo.caption ? `Open photo: ${photo.caption}` : 'Open photo')}
            aria-pressed={selectMode ? isSelected : undefined}
          >
            <div className="relative overflow-hidden rounded-[1.45rem] bg-charcoal-200">
              <motion.img
                src={photo.thumbnail || photo.url}
                alt={photo.caption || 'Wedding photo'}
                className="w-full h-auto object-cover"
                loading="lazy"
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {selectMode
                ? <SelectOverlay selected={isSelected} onToggle={() => onToggleSelect?.(photo.id)} />
                : <PhotoLikeButton photo={photo} onLike={onLike} />
              }
            </div>

          </motion.div>
        )
      })}
    </MasonryGrid>
  )
}

function StandardGrid({ photos, onPhotoClick, onLike, selectMode, selectedIds, onToggleSelect }: PhotoGridProps) {

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {photos.map((photo, index) => {
        const isSelected = selectedIds?.has(photo.id) ?? false
        return (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={!selectMode ? { y: -6, scale: 1.03 } : {}}
            transition={{ duration: 0.4, delay: index * 0.03 }}
            className={cn(
              'group overflow-hidden rounded-[1.8rem] border bg-white p-2 text-left',
              selectMode ? 'cursor-default' : 'cursor-pointer',
              isSelected ? 'border-gold-400/80' : 'border-white/80'
            )}
            style={{
              boxShadow: '0 22px 58px -44px rgba(46,33,13,0.22)',
              transition: 'box-shadow 0.3s ease'
            }}
            onMouseEnter={(e) => {
              if (!selectMode) {
                e.currentTarget.style.boxShadow = '0 32px 75px -44px rgba(201,160,92,0.32), 0 8px 20px -10px rgba(201,160,92,0.2)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 22px 58px -44px rgba(46,33,13,0.22)'
            }}
            onClick={() => selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, index)}
            onKeyDown={(event) => {

              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, index)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={selectMode ? (isSelected ? `Deselect ${photo.caption || 'photo'}` : `Select ${photo.caption || 'photo'}`) : (photo.caption ? `Open photo: ${photo.caption}` : 'Open photo')}
            aria-pressed={selectMode ? isSelected : undefined}
          >
            <div className="relative aspect-square overflow-hidden rounded-[1.35rem] bg-charcoal-200">
              <motion.img
                src={photo.thumbnail || photo.url}
                alt={photo.caption || 'Wedding photo'}
                className="h-full w-full object-cover"
                loading="lazy"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {selectMode
                ? <SelectOverlay selected={isSelected} onToggle={() => onToggleSelect?.(photo.id)} />
                : <PhotoLikeButton photo={photo} onLike={onLike} />
              }
            </div>

          </motion.div>
        )
      })}
    </div>

  )
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  onLike,

  className,
  viewMode = 'masonry',
  selectMode,
  selectedIds,
  onToggleSelect,

}: PhotoGridProps & { viewMode?: 'masonry' | 'grid' }) {

  if (photos.length === 0) {
    return (
      <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-[1.9rem] border border-dashed border-gold-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(247,241,232,0.9))] px-6 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600 shadow-sm">
          <Images className="h-7 w-7" />
        </div>

        <p className="mt-6 font-display text-2xl text-charcoal-900">
          No photos to display
        </p>

        <p className="mt-2 max-w-md text-sm leading-6 text-charcoal-500">
          Try another chapter or widen the filters to bring more moments back into view.
        </p>

      </div>

    )
  }

  return (
    <div className={cn('w-full', className)}>
      {viewMode === 'masonry' ? (
        <MasonryPhotoGrid photos={photos} onPhotoClick={onPhotoClick} onLike={onLike} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
      ) : (
        <StandardGrid photos={photos} onPhotoClick={onPhotoClick} onLike={onLike} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />
      )}
    </div>

  )
}
