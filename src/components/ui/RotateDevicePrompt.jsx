import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './Button'

const RotateDevicePrompt = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      // Check if we are in portrait mode AND on a mobile-sized screen
      // Using 768px as a safe cutoff for tablets/mobiles
      const isPortrait = window.matchMedia('(orientation: portrait)').matches
      const isMobile = window.innerWidth <= 1024 // Include iPads in portrait

      if (isPortrait && isMobile && !isDismissed) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    // Initial check
    checkOrientation()

    // Listen for resize/orientation changes
    window.addEventListener('resize', checkOrientation)

    // Also listen to orientationchange for mobile specifically
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [isDismissed])

  const handleEnterLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen()
      }

      // Small delay to allow fullscreen to engage before locking
      setTimeout(async () => {
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape')
            // If successful, the resize listener will auto-hide the prompt
          } catch {
            // Orientation lock not supported
            // Even if lock fails, we are in fullscreen, which is better.
            // We can manually dismiss the prompt since the user tried.
            setIsDismissed(true)
          }
        } else {
          // If lock not supported (iOS), just dismiss after they tried
          setIsDismissed(true)
        }
      }, 100)
    } catch {
      // Fullscreen request failed
      setIsDismissed(true) // Dismiss on error so user isn't stuck
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-[9999] bg-dark-900 flex flex-col items-center justify-center p-8 text-center'
        >
          {/* Animated Phone Icon */}
          <motion.div
            animate={{ rotate: 90 }}
            transition={{
              repeat: Infinity,
              repeatType: 'reverse',
              duration: 2,
              ease: 'easeInOut',
              repeatDelay: 0.5,
            }}
            className='w-[60px] h-[100px] border-4 border-gold-500 rounded-xl mb-8 relative'
          >
            {/* Screen Line/Notch */}
            <div className='absolute top-[10px] left-1/2 -translate-x-1/2 w-[20px] h-[4px] bg-white/20 rounded-sm' />
          </motion.div>

          <h2 className='text-cream-50 mb-4 text-2xl font-display'>Best Viewed in Landscape</h2>
          <p className='text-dark-400 mb-12 max-w-[300px] leading-relaxed'>
            Please rotate your device for the full cinematic experience.
          </p>

          <div className='flex flex-col gap-4 w-full max-w-[300px]'>
            <Button onClick={handleEnterLandscape} variant='primary'>
              Enter Landscape
            </Button>
            <button
              onClick={handleDismiss}
              className='bg-transparent border-none text-dark-400 text-sm cursor-pointer p-4 hover:text-cream-50 transition-colors'
            >
              Continue in Portrait
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default RotateDevicePrompt
