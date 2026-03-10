import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const Hero = React.memo(() => {
  const [showJourneyButton, setShowJourneyButton] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowJourneyButton(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

  const handleScroll = () => {
    const target = document.getElementById('thank-you')
    target?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className='relative h-dvh w-full flex flex-col bg-black overflow-hidden'>
      {/* Top Bar Area (Matches Navbar spacing) */}
      <div className='h-28 bg-black shrink-0 relative z-30' />

      {/* Narrative Video Section (Center Part) */}
      <div className='relative flex-1 overflow-hidden'>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            className='absolute inset-0 z-0'
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              className='w-full h-full object-cover brightness-[0.85]'
            >
              <source src='/video/optimized_background.mp4' type='video/mp4' />
            </video>
          </motion.div>
        </AnimatePresence>

        {/* Cinematic Radial Overlay */}
        <div
          className='absolute inset-0 z-10'
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </div>

      {/* Synchronized Control Area (Bottom Part) */}
      <div className='h-28 bg-black flex items-center justify-center relative z-20'>
        <AnimatePresence>
          {showJourneyButton && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                onClick={handleScroll}
                className='px-8 py-4 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-500 hover:border-gold-500/30 font-display text-xs md:text-sm uppercase tracking-[0.4em] font-bold text-gold-600 active:scale-95'
              >
                Begin Our Journey
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
})

export default Hero
