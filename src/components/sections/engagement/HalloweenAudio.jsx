import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { halloweenTrack } from '@/data/music'

const HalloweenAudio = ({ isInView }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio(halloweenTrack.src)
    audioRef.current.loop = true
    audioRef.current.volume = 0.5 // Start lower

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Audio Fade Utility
  const fadeAudio = (audio, start, end, duration, onComplete) => {
    const steps = 20
    const stepTime = duration / steps
    const volStep = (end - start) / steps
    let currentVol = start

    const interval = setInterval(() => {
      currentVol += volStep
      if ((volStep > 0 && currentVol >= end) || (volStep < 0 && currentVol <= end)) {
        audio.volume = end
        clearInterval(interval)
        if (onComplete) onComplete()
      } else {
        audio.volume = Math.max(0, Math.min(1, currentVol))
      }
    }, stepTime)
  }

  // Handle Play/Pause based on View
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleInteraction = () => setHasInteracted(true)
    window.addEventListener('click', handleInteraction, { once: true })

    if (isInView && hasInteracted) {
      // Fade in
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => { /* Autoplay blocked - expected behavior */ })
      fadeAudio(audio, 0, 0.6, 2000)
    } else {
      // Fade out
      if (isPlaying) {
        fadeAudio(audio, audio.volume, 0, 1000, () => {
          audio.pause()
          setIsPlaying(false)
        })
      }
    }

    return () => window.removeEventListener('click', handleInteraction)
  }, [isInView, hasInteracted, isPlaying])

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className='fixed bottom-6 right-6 z-50 bg-black/80 text-[#ff6b35] px-4 py-2 rounded-full border border-[#ff6b35]/50 flex items-center gap-2 shadow-[0_0_20px_rgba(255,107,53,0.3)] pointer-events-none'
        >
          <span className='text-xl animate-pulse'>🎃</span>
          <span className='font-display tracking-widest text-sm'>SPOOKY MODE ACTIVE</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default HalloweenAudio
