import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CustomVideoPlayer from '@/components/ui/CustomVideoPlayer'
import storage from '@/utils/storage'
import { TIMING, VIDEO_CONFIG } from '@/config/constants'

// Chapters from VTT file
const chapters = [
  { label: 'Start', time: 0 },
  { label: 'Bachelor+ette Weekend', time: 44.64 },
  { label: '"Who Is It" Gameshow', time: 300.44 }, // 05:00.440
  { label: 'Messages from our Wedding Party', time: 863.36 }, // 14:23.360
  { label: 'Our Vows', time: 1211.0 }, // 20:11.000
  { label: 'The Ceremony', time: 1537.88 }, // 25:37.880
  { label: 'The Reception', time: 1688.92 }, // 28:08.920
  { label: 'Our First Dance', time: 1814.88 }, // 30:14.880
  { label: 'Bloopers', time: 2165.28 }, // 36:05.280
  { label: 'The REAL Party', time: 2375.12 }, // 39:35.120
]

const parentVideos = [
  { id: 'mom', label: "Mom's Film", src: '/video/mom.mp4' },
  { id: 'christine', label: "Christine's Film", src: '/video/christine.mp4' },
  { id: 'jerame', label: "Jerame's Film", src: '/video/jerame.mp4' },
  { id: 'melony', label: "Melony's Film", src: '/video/melony.mp4' },
]

const formatChapterTime = timeInSeconds => {
  const minutes = Math.floor(timeInSeconds / 60)
  const seconds = Math.floor(timeInSeconds % 60)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const VideoSection = () => {
  const videoRef = useRef(null)
  const [selectedFamilyVideo, setSelectedFamilyVideo] = useState(null)
  const [showCastTip, setShowCastTip] = useState(() => {
    return !storage.getItem(VIDEO_CONFIG.castTipStorageKey)
  })

  useEffect(() => {
    // No-op effect or remove if not needed anymore
  }, [])

  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        if (selectedFamilyVideo) setSelectedFamilyVideo(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFamilyVideo])

  useEffect(() => {
    if (showCastTip) {
      const timer = setTimeout(() => {
        setShowCastTip(false)
        storage.setItem(VIDEO_CONFIG.castTipStorageKey, 'true')
      }, TIMING.castTipDelay) // Use constant instead of magic number
      return () => clearTimeout(timer)
    }
  }, [showCastTip])

  const handleChapterClick = time => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      videoRef.current.play().catch(() => {})
    }
  }

  const closeTip = () => {
    setShowCastTip(false)
    storage.setItem(VIDEO_CONFIG.castTipStorageKey, 'true')
  }

  return (
    <section id='video' className='py-20 bg-cream-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className='text-center mb-12'
        >
          <h2 className='text-4xl font-bold font-display text-dark-900 mb-4'>Our Wedding Video</h2>
          <p className='text-lg font-light text-dark-700/60'>
            Relive the special moments from our big day
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className='relative rounded-xl overflow-hidden shadow-2xl mb-12 border border-gold-500/10'
        >
          <CustomVideoPlayer ref={videoRef} chapters={chapters} />
        </motion.div>

        {/* Film-Strip Chapter Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className='mb-16 overflow-hidden'
        >
          <h3 className='text-sm font-medium text-gold-500 mb-6 text-center uppercase tracking-[0.2em] opacity-80'>
            Film Chapters
          </h3>
          <div className='relative'>
            {/* Film Strip Decoration (top) */}
            <div className='absolute -top-4 left-0 right-0 h-4 flex gap-2 overflow-hidden opacity-20'>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className='min-w-[40px] h-3 bg-gold-200/50 rounded-sm' />
              ))}
            </div>

            <div className='flex overflow-x-auto gap-4 py-6 px-4 hide-scrollbar snap-x'>
              {chapters.map((chapter, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleChapterClick(chapter.time)}
                  className='snap-center flex-none w-48 group'
                >
                  <div className='aspect-video bg-cream-100 rounded-lg overflow-hidden mb-3 border-2 border-transparent group-hover:border-gold-500 transition-all duration-300 shadow-lg relative'>
                    {/* Placeholder for Thumbnails - Use labeled gradients for now */}
                    <div
                      className='w-full h-full flex items-center justify-center text-gold-500 opacity-40 group-hover:opacity-100 transition-opacity'
                      style={{
                        background: `linear-gradient(${45 + index * 30}deg, #1a1a1a 0%, #333 100%)`,
                      }}
                    >
                      <span className='text-xs font-mono text-dark-700/60'>
                        {formatChapterTime(chapter.time)}
                      </span>
                    </div>
                    <div className='absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium tracking-wide'>
                      CHAPTER {index + 1}
                    </div>
                  </div>
                  <p className='text-sm font-medium text-dark-700 line-clamp-1 group-hover:text-gold-600 transition-colors'>
                    {chapter.label}
                  </p>
                </motion.button>
              ))}
            </div>

            {/* Film Strip Decoration (bottom) */}
            <div className='absolute -bottom-4 left-0 right-0 h-4 flex gap-2 overflow-hidden opacity-20'>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className='min-w-[40px] h-3 bg-gold-200/50 rounded-sm' />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Family Videos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className='mb-8'
        >
          <h3 className='text-2xl font-semibold text-dark-900 mb-6 text-center font-display'>
            Family Films
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {parentVideos.map(video => (
              <motion.button
                key={video.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedFamilyVideo(video)}
                className='p-4 bg-white/70 backdrop-blur-md rounded-lg shadow-lg border border-gold-500/10 hover:border-gold-500/50 hover:shadow-gold/10 transition-all duration-300'
              >
                <div className='text-sm font-medium text-dark-700'>{video.label}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Cast Tip */}
        <AnimatePresence>
          {showCastTip && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='fixed bottom-4 right-4 bg-gold-600 text-white p-4 rounded-lg shadow-lg max-w-sm z-50'
            >
              <p className='text-sm font-medium mb-2'>💡 Tip: Cast this video to your TV!</p>
              <p className='text-xs opacity-90 mb-2'>
                Look for the cast icon in your browser's video player
              </p>
              <button onClick={closeTip} className='text-xs underline hover:no-underline'>
                Got it!
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Family Video Modal */}
        <AnimatePresence>
          {selectedFamilyVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md'
              onClick={() => setSelectedFamilyVideo(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className='relative w-full max-w-4xl'
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedFamilyVideo(null)}
                  className='absolute -top-10 right-0 text-white hover:text-gold-400 transition-colors'
                  aria-label='Close video'
                >
                  <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
                <video
                  src={selectedFamilyVideo.src}
                  controls
                  className='w-full rounded-lg shadow-2xl border border-white/10'
                  autoPlay
                >
                  <track
                    kind='captions'
                    src='/captions/empty.vtt'
                    srcLang='en'
                    label='English'
                    default
                  />
                  Your browser does not support the video tag.
                </video>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

export default VideoSection
