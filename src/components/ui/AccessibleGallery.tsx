import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import LazyImage from './LazyImage'

interface GalleryImage {
  id?: string | number;
  src: string;
  alt?: string;
  caption?: string;
}

interface AccessibleGalleryProps {
  images: GalleryImage[];
  className?: string;
}

const AccessibleGallery = React.memo<AccessibleGalleryProps>(({ images, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const galleryRef = useRef(null)

  // Define navigateImage with useCallback to stabilize the function
  const navigateImage = useCallback(
    (direction: 'previous' | 'next') => {
      if (direction === 'previous') {
        setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))
      } else {
        setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))
      }
    },
    [images.length]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowLeft':
          navigateImage('previous')
          break
        case 'ArrowRight':
          navigateImage('next')
          break
        case 'Escape':
          setIsOpen(false)
          break
        default:
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, navigateImage])

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setIsOpen(true)
  }

  const closeLightbox = () => {
    setIsOpen(false)
  }

  if (!images || images.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className='text-gray-500 dark:text-gray-400'>No images to display</p>
      </div>
    )
  }

  return (
    <div className={`accessible-gallery ${className}`} ref={galleryRef}>
      {/* Thumbnail Grid */}
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
        {images.map((image, index) => (
          <motion.button
            key={image.id || index}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => openLightbox(index)}
            className='relative aspect-square rounded-lg overflow-hidden shadow-lg focus:outline-none focus:ring-4 focus:ring-pink-500'
            aria-label={`View image ${index + 1} of ${images.length}: ${image.alt || 'Wedding photo'}`}
          >
            <LazyImage
              src={image.src}
              alt={image.alt || `Wedding photo ${index + 1}`}
              className='w-full h-full'
            />
            <div className='absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200' />
          </motion.button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
            aria-label={`Image ${currentIndex + 1} of ${images.length} in lightbox`}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className='absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 p-2 rounded-full bg-black bg-opacity-50'
              aria-label='Close lightbox'
            >
              <XMarkIcon className='w-6 h-6' />
            </button>

            {/* Image counter */}
            <div className='absolute top-4 left-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm'>
              {currentIndex + 1} / {images.length}
            </div>

            {/* Main image */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className='relative max-w-5xl max-h-full'
            >
              <img
                src={images[currentIndex].src}
                alt={images[currentIndex].alt || `Wedding photo ${currentIndex + 1}`}
                className='max-w-full max-h-[80vh] object-contain rounded-lg'
              />

              {/* Caption */}
              {images[currentIndex].caption && (
                <div className='absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b-lg'>
                  <p className='text-center'>{images[currentIndex].caption}</p>
                </div>
              )}
            </motion.div>

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => navigateImage('previous')}
                  className='absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 rounded-full bg-black bg-opacity-50'
                  aria-label='Previous image'
                >
                  <ChevronLeftIcon className='w-8 h-8' />
                </button>
                <button
                  onClick={() => navigateImage('next')}
                  className='absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-2 rounded-full bg-black bg-opacity-50'
                  aria-label='Next image'
                >
                  <ChevronRightIcon className='w-8 h-8' />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip to content link for keyboard users */}
      <a
        href='#gallery-end'
        className='sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-pink-600 text-white px-4 py-2'
      >
        Skip gallery
      </a>
      <div id='gallery-end' />
    </div>
  )
})

export default AccessibleGallery
