import OptimizedImage from '@/components/ui/OptimizedImage'
import { photos } from '@/data/engagement'
import { motion, useInView } from 'framer-motion'
import React, { useEffect, useRef, useState } from 'react'

interface Photo {
  id: number
  src: string
  caption?: string
  type: 'main' | 'filler' | 'gallery'
  objectPosition?: string
}

interface EngagementGalleryProps {
  onPhotoSelect: (photo: Photo) => void
}

const EngagementGallery: React.FC<EngagementGalleryProps> = ({ onPhotoSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { amount: 0.1 })
  const [isHovered, setIsHovered] = useState(false)
  const autoScrollRef = useRef<number | null>(null)

  // Pause auto-scroll on touch
  const [isTouched, setIsTouched] = useState(false)

  // Drag State
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Auto-scroll logic
  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return

    let lastTime = performance.now()
    let accumulated = 0
    const speed = 0.5 // Pixels per frame approx

    const animate = (time: number) => {
      // Pause if hovered OR touched
      if (!isHovered && !isTouched && !isDragging && isInView) {
        const delta = time - lastTime
        const safeDelta = Math.min(delta, 50)

        accumulated += safeDelta * (60 / 1000) * speed

        if (accumulated >= 1) {
          const pixelsToScroll = Math.floor(accumulated)
          scrollContainer.scrollLeft += pixelsToScroll
          accumulated -= pixelsToScroll
        }
      }
      lastTime = time
      autoScrollRef.current = requestAnimationFrame(animate)
    }

    autoScrollRef.current = requestAnimationFrame(animate)

    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current)
    }
  }, [isHovered, isTouched, isDragging, isInView])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - scrollRef.current.offsetLeft)
    setScrollLeft(scrollRef.current.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
    setIsHovered(false)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX) * 2 // Scroll-fast multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className='w-full mx-auto relative px-[5vw]'
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave} // Combined leave handler
      onTouchStart={() => setIsTouched(true)}
      onTouchEnd={() => setTimeout(() => setIsTouched(false), 2000)} // Resume after 2s delay
    >
      {/* Navigation Buttons */}
      <button
        onClick={() => scroll('left')}
        aria-label='Scroll left'
        className='absolute left-[1vw] top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/80 text-(--color-gold) border border-(--color-gold)/30 flex items-center justify-center text-2xl backdrop-blur-md shadow-lg hover:bg-(--color-gold) hover:text-white hover:scale-110 transition-all duration-300'
      >
        ←
      </button>

      <button
        onClick={() => scroll('right')}
        aria-label='Scroll right'
        className='absolute right-[1vw] top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/80 text-(--color-gold) border border-(--color-gold)/30 flex items-center justify-center text-2xl backdrop-blur-md shadow-lg hover:bg-(--color-gold) hover:text-white hover:scale-110 transition-all duration-300'
      >
        →
      </button>

      {/* Helper text */}
      <div
        className={`text-center mb-4 transition-opacity duration-300 ${
          isHovered || isTouched || isDragging ? 'opacity-100' : 'opacity-60'
        }`}
      >
        <span className='text-white/40 text-[10px] uppercase tracking-[0.4em] font-medium'>
          {isHovered || isTouched || isDragging ? 'Paused ' : ''}Auto-scrolling • Click or drag to
          explore
        </span>
      </div>

      {/* Scrollable Container with Fade Mask */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={scrollRef}
        className={`hide-scrollbar flex items-center gap-8 overflow-x-auto overflow-y-hidden py-24 px-12 select-none ${
          isDragging ? 'scroll-auto cursor-grabbing' : 'scroll-smooth cursor-grab'
        }`}
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        role='region'
        aria-label='Engagement Gallery Scrollable'
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {photos
          .filter(p => p.type === 'gallery')
          .map((photo: any) => (
            <GalleryItem key={photo.id} photo={photo} onSelect={onPhotoSelect} />
          ))}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .hide-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.3);
          border-radius: 4px;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.6);
        }
      `}</style>
    </motion.div>
  )
}

// Memoized Item Component
const GalleryItem = React.memo(({ photo, onSelect }: { photo: any; onSelect: (photo: Photo) => void }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -8, zIndex: 10 }}
      onClick={() => onSelect(photo)}
      className='min-w-[220px] h-[280px] rounded-xl border border-(--color-gold)/20 flex items-center justify-center cursor-pointer shadow-md shrink-0 relative bg-white will-change-transform translate-z-0'
    >
      <OptimizedImage
        src={photo.src}
        alt={photo.caption || 'Engagement Photo'}
        className='w-full h-full object-cover select-none rounded-xl'
        width={220}
        height={280}
        placeholder='blur'
      />
      {photo.caption && (
        <div className='absolute bottom-0 left-0 right-0 p-[0.8rem] bg-linear-to-t from-black/60 to-transparent text-white/95 text-[0.9rem] text-center font-display'>
          {photo.caption}
        </div>
      )}
    </motion.div>
  )
})

GalleryItem.displayName = 'GalleryItem'

export default EngagementGallery
