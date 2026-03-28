import { motion } from 'framer-motion'
import { Heart, Images } from 'lucide-react'
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

function MasonryPhotoGrid({ photos, onPhotoClick, onLike }: PhotoGridProps) {
  return (
    <MasonryGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }}>
      {photos.map((photo, index) => (
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.5) }}
          className="group relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-white p-1 text-left shadow-[0_26px_60px_-42px_rgba(46,33,13,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_80px_-46px_rgba(46,33,13,0.34)]"
          onClick={() => onPhotoClick?.(photo, index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onPhotoClick?.(photo, index)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
        >
          <div className="relative overflow-hidden rounded-[1.45rem] bg-charcoal-200">
            <img
              src={photo.thumbnail || photo.url}
              alt={photo.caption || 'Wedding photo'}
              className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <PhotoLikeButton photo={photo} onLike={onLike} />
          </div>
        </motion.div>
      ))}
    </MasonryGrid>
  )
}

function StandardGrid({ photos, onPhotoClick, onLike }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {photos.map((photo, index) => (
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: index * 0.03 }}
          className="group overflow-hidden rounded-[1.8rem] border border-white/80 bg-white p-2 text-left shadow-[0_22px_58px_-44px_rgba(46,33,13,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_75px_-44px_rgba(46,33,13,0.32)]"
          onClick={() => onPhotoClick?.(photo, index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onPhotoClick?.(photo, index)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
        >
          <div className="relative aspect-square overflow-hidden rounded-[1.35rem] bg-charcoal-200">
            <img
              src={photo.thumbnail || photo.url}
              alt={photo.caption || 'Wedding photo'}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
              loading="lazy"
            />
            <PhotoLikeButton photo={photo} onLike={onLike} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  onLike,
  className,
  viewMode = 'masonry',
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
        <MasonryPhotoGrid photos={photos} onPhotoClick={onPhotoClick} onLike={onLike} />
      ) : (
        <StandardGrid photos={photos} onPhotoClick={onPhotoClick} onLike={onLike} />
      )}
    </div>
  )
}
