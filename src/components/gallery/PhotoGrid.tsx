import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Heart, Images, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const getMasonryColumns = (width: number) => {
  if (width >= 1280) return 4
  if (width >= 768) return 3
  return 2
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

function MasonryGrid({ photos, onPhotoClick, onLike }: PhotoGridProps) {
  const [columnCount, setColumnCount] = useState(() =>
    typeof window === 'undefined' ? 2 : getMasonryColumns(window.innerWidth)
  )

  useEffect(() => {
    const onResize = () => setColumnCount(getMasonryColumns(window.innerWidth))

    onResize()
    window.addEventListener('resize', onResize)

    return () => window.removeEventListener('resize', onResize)
  }, [])

  const distributePhotos = (items: Photo[], columns: number) => {
    const cols: Photo[][] = Array.from({ length: columns }, () => [])
    const colHeights = Array(columns).fill(0)

    items.forEach((photo) => {
      const shortestCol = colHeights.indexOf(Math.min(...colHeights))
      cols[shortestCol].push(photo)
      colHeights[shortestCol] += photo.aspectRatio || 1.5
    })

    return cols
  }

  const columns = distributePhotos(photos, columnCount)

  return (
    <div
      className="grid gap-4 md:gap-5"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-4 md:gap-5">
          {column.map((photo, photoIndex) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: colIndex * 0.08 + photoIndex * 0.04 }}
              className="group relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-white p-1 text-left shadow-[0_26px_60px_-42px_rgba(46,33,13,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_80px_-46px_rgba(46,33,13,0.34)]"
              onClick={() => onPhotoClick?.(photo, photos.indexOf(photo))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onPhotoClick?.(photo, photos.indexOf(photo))
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
        </div>
      ))}
    </div>
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
        <MasonryGrid photos={photos} onPhotoClick={onPhotoClick} onLike={onLike} />
      ) : (
        <StandardGrid photos={photos} onPhotoClick={onPhotoClick} onLike={onLike} />
      )}
    </div>
  )
}

interface LightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}

export function Lightbox({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNext,
  onPrev,
}: LightboxProps) {
  const [isLiked, setIsLiked] = useState(false)
  const currentPhoto = photos[currentIndex]

  if (!isOpen || !currentPhoto) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(97,71,49,0.34),rgba(21,16,13,0.94)_58%)] p-4"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="cinematic-overlay-button absolute right-5 top-5 z-10 flex h-12 w-12 items-center justify-center"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation()
            onPrev()
          }}
          className="cinematic-overlay-button absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center md:left-6"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation()
            onNext()
          }}
          className="cinematic-overlay-button absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center md:right-6"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <motion.div
          key={currentPhoto.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-6xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="overflow-hidden rounded-[1.75rem] border border-gold-200/16 bg-[linear-gradient(145deg,rgba(36,27,22,0.92),rgba(52,39,31,0.94)_52%,rgba(72,55,43,0.9))] shadow-[0_38px_100px_-54px_rgba(21,20,19,0.88)]">
            <motion.img
              src={currentPhoto.url}
              alt={currentPhoto.caption || 'Wedding photo'}
              className="max-h-[78vh] w-full object-contain"
            />
          </div>

          <div className="cinematic-card mt-4 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-200/92">
                  Gallery moment
                </p>
                {currentPhoto.caption && (
                  <p className="text-cinematic-primary mt-2 text-lg md:text-xl">{currentPhoto.caption}</p>
                )}
                <p className="text-cinematic-secondary mt-2 text-sm">
                  {currentIndex + 1} / {photos.length}
                  {currentPhoto.photographer && ` · Photo by ${currentPhoto.photographer}`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    setIsLiked(!isLiked)
                  }}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-all',
                    isLiked
                      ? 'border-rose-300/60 bg-rose-500 text-white'
                      : 'border-gold-200/16 bg-[rgba(255,247,235,0.1)] text-cinematic-primary hover:border-gold-200/28 hover:bg-[rgba(255,247,235,0.16)]'
                  )}
                >
                  <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
                </button>

                <button
                  onClick={(event) => event.stopPropagation()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-200/16 bg-[rgba(255,247,235,0.1)] text-cinematic-primary backdrop-blur-sm transition-colors hover:border-gold-200/28 hover:bg-[rgba(255,247,235,0.16)]"
                >
                  <Download className="h-5 w-5" />
                </button>

                <button
                  onClick={(event) => event.stopPropagation()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-200/16 bg-[rgba(255,247,235,0.1)] text-cinematic-primary backdrop-blur-sm transition-colors hover:border-gold-200/28 hover:bg-[rgba(255,247,235,0.16)]"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
