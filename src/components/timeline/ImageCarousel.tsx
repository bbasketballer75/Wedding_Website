import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ImageCarouselProps {
  images: string[]
  alt: string
  className?: string
  autoPlayInterval?: number
}

// Modal component that renders via portal
function ImageModal({
  isOpen,
  onClose,
  images,
  alt,
  currentIndex,
  onPrev,
  onNext,
  onGoTo
}: {
  isOpen: boolean
  onClose: () => void
  images: string[]
  alt: string
  currentIndex: number
  onPrev: () => void
  onNext: () => void
  onGoTo: (index: number) => void
}) {
  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden' // Prevent background scroll
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, onPrev, onNext])

  if (!isOpen) return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClose()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Close image viewer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="text-white text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          onClick={onClose}
          aria-label="Close image gallery"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Main Image Area */}
      <div 
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClickCapture={(e) => e.stopPropagation()}
      >
        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
              onClick={onPrev}
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
              onClick={onNext}
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {/* Current Image */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`${alt} - ${currentIndex + 1}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="max-w-[90%] max-h-[85%] object-contain"
          />
        </AnimatePresence>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="px-4 py-4 bg-black/50">
          <div className="flex gap-2 justify-center overflow-x-auto pb-2">
            {images.map((src, index) => (
              <button
                key={index}
                onClick={(e) => { 
                  e.stopPropagation()
                  onGoTo(index)
                }}
                aria-label={`View image ${index + 1}`}
                className={cn(
                  "relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all",
                  index === currentIndex 
                    ? "ring-2 ring-white ring-offset-2 ring-offset-black" 
                    : "opacity-50 hover:opacity-80"
                )}
              >
                <img
                  src={src}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>,
    document.body
  )
}

export function ImageCarousel({ 
  images, 
  alt, 
  className,
  autoPlayInterval = 3000 
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Preload all images
  useEffect(() => {
    images.forEach((src, i) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        setLoadedImages(prev => new Set([...prev, i]))
      }
    })
  }, [images])

  const goToSlide = useCallback((index: number) => {
    let newIndex = index
    if (newIndex < 0) newIndex = images.length - 1
    if (newIndex >= images.length) newIndex = 0
    setCurrentIndex(newIndex)
  }, [images.length])

  const nextSlide = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % images.length)
  }, [images.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // Auto-play
  useEffect(() => {
    if (isHovered || isModalOpen || images.length <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(nextSlide, autoPlayInterval)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isHovered, isModalOpen, images.length, autoPlayInterval, nextSlide])

  if (images.length === 0) return null

  const isLoaded = loadedImages.has(currentIndex)

  return (
    <>
      {/* Main Carousel - Fixed height */}
      <div 
        className={cn(
          "relative w-full h-[220px] rounded-xl overflow-hidden bg-charcoal-100",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Images Container */}
        <div 
          className="absolute inset-0 cursor-pointer group"
          onClick={() => setIsModalOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setIsModalOpen(true)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${alt} image gallery`}
        >
          {images.map((src, index) => (
            <motion.div
              key={index}
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-charcoal-50 to-charcoal-100"
              initial={false}
              animate={{
                opacity: index === currentIndex ? 1 : 0,
                scale: index === currentIndex ? 1 : 1.05,
              }}
              transition={{ 
                opacity: { duration: 0.4, ease: "easeInOut" },
                scale: { duration: 0.4, ease: "easeInOut" }
              }}
              style={{ 
                zIndex: index === currentIndex ? 1 : 0,
                pointerEvents: index === currentIndex ? 'auto' : 'none'
              }}
            >
              <img
                src={src}
                alt={`${alt} - ${index + 1}`}
                className="max-w-full max-h-full object-contain"
                loading={index <= 2 ? "eager" : "lazy"}
              />
            </motion.div>
          ))}
          
          {/* Loading overlay */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-charcoal-100 z-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-gold-300 border-t-gold-600 rounded-full"
              />
            </div>
          )}
          
          {/* Click to expand hint */}
          <motion.div 
            className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ZoomIn className="w-3.5 h-3.5 text-white" />
            <span className="text-xs text-white font-medium">Click to expand</span>
          </motion.div>
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white"
              onClick={(e) => { e.stopPropagation(); prevSlide() }}
              aria-label="Previous carousel image"
            >
              <ChevronLeft className="w-5 h-5 text-charcoal-700" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white"
              onClick={(e) => { e.stopPropagation(); nextSlide() }}
              aria-label="Next carousel image"
            >
              <ChevronRight className="w-5 h-5 text-charcoal-700" />
            </button>
          </>
        )}

        {/* Dot Indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { 
                  e.stopPropagation()
                  goToSlide(index)
                }}
                aria-label={`Go to image ${index + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === currentIndex 
                    ? "bg-white w-5 shadow-md" 
                    : "bg-white/60 w-2 hover:bg-white/80"
                )}
              />
            ))}
          </div>
        )}

        {/* Image Counter */}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white font-medium z-20">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Fullscreen Modal via Portal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        images={images}
        alt={alt}
        currentIndex={currentIndex}
        onPrev={prevSlide}
        onNext={nextSlide}
        onGoTo={goToSlide}
      />
    </>
  )
}
