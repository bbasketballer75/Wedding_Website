import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import CustomVideoPlayer from './CustomVideoPlayer'

export interface ImmersiveItem {
  id?: string | number;
  type?: string;
  src?: string;
  photo_url?: string;
  message?: string;
  name?: string;
}

export interface ImmersiveViewProps {
  items: ImmersiveItem[];
  initialIndex?: number;
  onClose: () => void;
}

const ImmersiveView: React.FC<ImmersiveViewProps> = ({ items, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [direction, setDirection] = useState(0)
  const [showUI, setShowUI] = useState(true)

  // Auto-hide UI after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      setShowUI(true)
      clearTimeout(timeout)
      timeout = setTimeout(() => setShowUI(false), 3000)
    }

    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('touchstart', resetTimer)
    resetTimer()

    return () => {
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('touchstart', resetTimer)
      clearTimeout(timeout)
    }
  }, [])

  const nextSlide = useCallback(() => {
    setDirection(1)
    setCurrentIndex(prev => (prev + 1 === items.length ? 0 : prev + 1))
  }, [items.length])

  const prevSlide = useCallback(() => {
    setDirection(-1)
    setCurrentIndex(prev => (prev === 0 ? items.length - 1 : prev - 1))
  }, [items.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide()
      if (e.key === 'ArrowLeft') prevSlide()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextSlide, prevSlide, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const currentItem = items[currentIndex]
  if (!currentItem) return null

  const isVideo =
    currentItem.type === 'video' || (currentItem.src && currentItem.src.endsWith('.mp4'))

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='immersive-view-backdrop fixed inset-0 z-9999 bg-[#050508]/95 backdrop-blur-2xl flex items-center justify-center overflow-hidden'
    >
      {/* Background Ambience (Blurred copy of current image) */}
      <AnimatePresence mode='wait'>
        <motion.div
          key={`bg-${currentIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className='absolute -inset-[10%] bg-center bg-cover bg-no-repeat blur-[100px] saturate-150 -z-10'
          style={{
            backgroundImage: `url(${currentItem.src || currentItem.photo_url})`,
          }}
        />
      </AnimatePresence>

      {/* Close Button - Always visible but better styled */}
      <button
        onClick={onClose}
        className='absolute top-8 right-8 z-100 bg-white/10 border border-white/20 text-white w-[50px] h-[50px] rounded-full cursor-pointer flex items-center justify-center backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:scale-110'
      >
        <svg
          width='24'
          height='24'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
        >
          <line x1='18' y1='6' x2='6' y2='18'></line>
          <line x1='6' y1='6' x2='18' y2='18'></line>
        </svg>
      </button>

      {/* Main Content Carousel */}
      <div className='w-full h-full relative'>
        <AnimatePresence initial={false} custom={direction} mode='popLayout'>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={{
              enter: direction => ({
                x: direction > 0 ? '100%' : '-100%',
                opacity: 0,
                scale: 0.85,
                rotateY: direction > 0 ? 15 : -15,
              }),
              center: {
                zIndex: 1,
                x: 0,
                opacity: 1,
                scale: 1,
                rotateY: 0,
              },
              exit: direction => ({
                zIndex: 0,
                x: direction < 0 ? '100%' : '-100%',
                opacity: 0,
                scale: 0.85,
                rotateY: direction < 0 ? 15 : -15,
              }),
            }}
            initial='enter'
            animate='center'
            exit='exit'
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 1,
            }}
            className='absolute inset-0 flex items-center justify-center'
            style={{ perspective: '1000px' }}
          >
            <div className='media-container w-auto h-auto max-w-[90vw] max-h-[85vh] rounded-lg overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative'>
              {isVideo ? (
                <div className='w-[80vw] max-w-[1200px] aspect-video'>
                  <CustomVideoPlayer
                    src={currentItem.src || currentItem.photo_url}
                    autoPlay={true}
                  />
                </div>
              ) : (
                <img
                  src={currentItem.src || currentItem.photo_url}
                  alt='Memory'
                  className='block max-w-full max-h-[85vh] object-contain'
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Caption Card - Dynamic Position */}
      <AnimatePresence>
        {showUI && (currentItem.message || currentItem.name) && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            className='absolute bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-[600px] px-8 py-6 rounded-[20px] bg-[#141419]/85 border-t border-white/10 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.4)] text-center z-50'
          >
            {currentItem.message && (
              <p className='text-xl font-(--font-body) text-white mb-3 leading-relaxed font-light'>
                "{currentItem.message}"
              </p>
            )}
            <div className='flex items-center justify-center gap-2'>
              <span className='h-px w-5 bg-(--color-gold)'></span>
              <span className='font-(--font-display) text-(--color-gold) text-lg tracking-wider uppercase'>
                {currentItem.name || 'Jordyn & Jordyn'}
              </span>
              <span className='h-px w-5 bg-(--color-gold)'></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal Navigation Arrows */}
      {['left', 'right'].map(dir => (
        <motion.button
          key={dir}
          initial={{ opacity: 0 }}
          animate={{ opacity: showUI ? 1 : 0 }}
          onClick={dir === 'left' ? prevSlide : nextSlide}
          className={`absolute top-1/2 -translate-y-1/2 bg-white/5 border border-white/10 text-white/70 cursor-pointer p-6 z-40 transition-all duration-300 outline-none rounded-full backdrop-blur-sm hover:text-white hover:bg-white/10 hover:border-white/30 ${
            dir === 'left' ? 'left-8' : 'right-8'
          }`}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg
            width='40'
            height='40'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
          >
            {dir === 'left' ? <path d='M15 18l-6-6 6-6' /> : <path d='M9 18l6-6-6-6' />}
          </svg>
        </motion.button>
      ))}

      {/* Counter */}
      <motion.div
        animate={{ opacity: showUI ? 1 : 0 }}
        className='absolute top-10 left-10 text-white/60 font-(--font-display) text-lg tracking-widest z-40'
      >
        {String(currentIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
      </motion.div>
    </motion.div>,
    document.body
  )
}

export default ImmersiveView
