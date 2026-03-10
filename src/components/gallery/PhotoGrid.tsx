import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Heart, Download, Share2, MessageCircle } from 'lucide-react'

interface Photo {
  id: string
  url: string
  thumbnail: string
  caption?: string
  photographer?: string
  likes?: number
  comments?: number
  aspectRatio?: number
}

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick?: (photo: Photo, index: number) => void
  className?: string
}

function MasonryGrid({ photos, onPhotoClick }: PhotoGridProps) {
  // Distribute photos into columns for masonry effect
  const distributePhotos = (photos: Photo[], columns: number) => {
    const cols: Photo[][] = Array.from({ length: columns }, () => [])
    const colHeights = Array(columns).fill(0)

    photos.forEach((photo) => {
      const shortestCol = colHeights.indexOf(Math.min(...colHeights))
      cols[shortestCol].push(photo)
      colHeights[shortestCol] += photo.aspectRatio || 1.5
    })

    return cols
  }

  const columns = distributePhotos(photos, 4)

  return (
    <div className="flex gap-4">
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="flex-1 flex flex-col gap-4">
          {column.map((photo, photoIndex) => (
            <motion.button
              key={photo.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: (colIndex * 0.1) + (photoIndex * 0.05) }}
              className="group relative overflow-hidden rounded-xl bg-charcoal-200 cursor-pointer"
              onClick={() => onPhotoClick?.(photo, photos.indexOf(photo))}
              aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
            >
              <img
                src={photo.thumbnail || photo.url}
                alt={photo.caption || 'Wedding photo'}
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  {photo.caption && (
                    <p className="text-white text-sm line-clamp-2 mb-2">
                      {photo.caption}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-white/80">
                    {photo.likes !== undefined && (
                      <span className="flex items-center gap-1 text-xs">
                        <Heart className="w-3.5 h-3.5" />
                        {photo.likes}
                      </span>
                    )}
                    {photo.comments !== undefined && (
                      <span className="flex items-center gap-1 text-xs">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {photo.comments}
                      </span>
                    )}
                  </div>
                  </div>
                </div>
            </motion.button>
          ))}
        </div>
      ))}
    </div>
  )
}

function StandardGrid({ photos, onPhotoClick }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo, index) => (
        <motion.button
          key={photo.id}
          type="button"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: index * 0.03 }}
          className="group relative aspect-square overflow-hidden rounded-xl bg-charcoal-200 cursor-pointer"
          onClick={() => onPhotoClick?.(photo, index)}
          aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
        >
          <img
            src={photo.thumbnail || photo.url}
            alt={photo.caption || 'Wedding photo'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
            <span
              aria-hidden="true"
              className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white"
            >
              <Heart className="w-5 h-5" />
            </span>
            <span
              aria-hidden="true"
              className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white"
            >
              <Download className="w-5 h-5" />
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  )
}

export function PhotoGrid({ photos, onPhotoClick, className, viewMode = 'masonry' }: PhotoGridProps & { viewMode?: 'masonry' | 'grid' }) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-charcoal-500">No photos to display</p>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {viewMode === 'masonry' ? (
        <MasonryGrid photos={photos} onPhotoClick={onPhotoClick} />
      ) : (
        <StandardGrid photos={photos} onPhotoClick={onPhotoClick} />
      )}
    </div>
  )
}

// Lightbox Component
interface LightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}

export function Lightbox({ photos, currentIndex, isOpen, onClose, onNext, onPrev }: LightboxProps) {
  const [isLiked, setIsLiked] = useState(false)
  const currentPhoto = photos[currentIndex]

  if (!isOpen || !currentPhoto) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-white/70 hover:text-white z-10"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Navigation */}
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Image */}
        <motion.img
          key={currentPhoto.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          src={currentPhoto.url}
          alt={currentPhoto.caption || 'Wedding photo'}
          className="max-h-[85vh] max-w-[90vw] object-contain"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Info Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="max-w-4xl mx-auto flex items-end justify-between">
            <div>
              {currentPhoto.caption && (
                <p className="text-white text-lg mb-2">{currentPhoto.caption}</p>
              )}
              <p className="text-white/60 text-sm">
                {currentIndex + 1} / {photos.length}
                {currentPhoto.photographer && ` · Photo by ${currentPhoto.photographer}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); }}
                className={cn(
                  "p-3 rounded-full backdrop-blur-sm transition-all",
                  isLiked 
                    ? "bg-rose-500 text-white" 
                    : "bg-white/20 text-white hover:bg-white/30"
                )}
              >
                <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
              </button>
              
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
              >
                <Download className="w-5 h-5" />
              </button>

              <button
                onClick={(e) => e.stopPropagation()}
                className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
