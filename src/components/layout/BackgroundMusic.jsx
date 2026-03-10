import { mainPlaylist } from '@/data/music'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, useCallback } from 'react'

const BackgroundMusic = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [volume] = useState(1.0)
  const [isHovered, setIsHovered] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [activePlaylist, setActivePlaylist] = useState(mainPlaylist)
  const [showNudge, setShowNudge] = useState(false)
  const hasNudgedRef = useRef(false)

  const [isMuted, setIsMuted] = useState(false)

  // Nudge Triggers (Scroll & Time)
  useEffect(() => {
    // 1. Scroll Trigger
    const handleScroll = () => {
      if (hasNudgedRef.current || isPlaying || hasInteracted) return

      if (window.scrollY > window.innerHeight * 0.4) {
        triggerNudge()
      }
    }

    // 2. Timer Trigger (3s delay)
    const timer = setTimeout(() => {
      if (!hasNudgedRef.current && !isPlaying && !hasInteracted) {
        triggerNudge()
      }
    }, 3000)

    const triggerNudge = () => {
      hasNudgedRef.current = true
      setShowNudge(true)
      // Auto-dismiss after 10 seconds
      setTimeout(() => setShowNudge(false), 10000)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(timer)
    }
  }, [isPlaying, hasInteracted])

  // Audio Refs
  const audioRef = useRef(null)

  // Initialize Playlist (Shuffle Logic)
  useEffect(() => {
    // Keep first track fixed, shuffle the rest
    const firstTrack = mainPlaylist[0]
    const restTracks = [...mainPlaylist.slice(1)]

    // Fisher-Yates Shuffle for restTracks
    for (let i = restTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[restTracks[i], restTracks[j]] = [restTracks[j], restTracks[i]]
    }

    setActivePlaylist([firstTrack, ...restTracks])
  }, [])

  // Initialize Audio Object
  useEffect(() => {
    // Create audio instance
    const audio = new Audio(mainPlaylist[0].src)
    audio.loop = false
    audio.volume = volume // Initial volume

    audioRef.current = audio

    return () => {
      // Cleanup
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = '' // help GC
        audioRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Verify: only run once on mount

  // Handle Playlist Navigation
  const handleTrackEnd = useCallback(() => {
    setCurrentTrackIndex(prev => (prev + 1) % activePlaylist.length)
  }, [activePlaylist])

  // Attach Event Listener
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onEnded = () => handleTrackEnd()
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('ended', onEnded)
    }
  }, [handleTrackEnd]) // Re-attach if handler changes (which depends on playlist)

  // Update Main Audio Source when Index or Playlist Changes
  useEffect(() => {
    if (!audioRef.current || activePlaylist.length === 0) return

    const track = activePlaylist[currentTrackIndex]

    if (audioRef.current.src !== new URL(track.src, window.location.href).href) {
      audioRef.current.src = track.src
      if (isPlaying) {
        audioRef.current.play().catch(e => console.warn('Auto-play next failed', e))
      }
    }
  }, [currentTrackIndex, activePlaylist, isPlaying])

  // Handle Global Volume & Mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const toggleMute = e => {
    e.stopPropagation()
    setIsMuted(!isMuted)
  }

  // Interactions (Autoplay Policy)
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (!hasInteracted) {
      setHasInteracted(true)
      setShowNudge(false)
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(e => console.warn('Play failed', e))
    } else {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(e => console.warn('Play failed', e))
      }
    }
  }

  // Skip Track Handler
  const skipTrack = e => {
    e.stopPropagation() // Prevent toggling play
    handleTrackEnd()
  }

  const prevTrack = e => {
    e.stopPropagation()
    setCurrentTrackIndex(prev => (prev - 1 + activePlaylist.length) % activePlaylist.length)
  }

  // Get current track info safely
  const currentTrack = activePlaylist[currentTrackIndex] || mainPlaylist[0]

  return (
    <div className='fixed bottom-6 left-6 sm:bottom-8 z-100 p-safe-bottom'>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={{ width: '56px', opacity: 0.8 }}
        animate={{
          width: isHovered ? 'auto' : '56px',
          opacity: isHovered ? 1 : 0.8,
          scale: isHovered ? 1.05 : showNudge ? [1, 1.05, 1] : 1,
        }}
        transition={{
          scale: showNudge
            ? { duration: 1.5, repeat: Infinity, repeatType: 'reverse' }
            : { type: 'spring', stiffness: 300, damping: 25 },
          width: { type: 'spring', stiffness: 300, damping: 25 },
          opacity: { duration: 0.3 },
        }}
        className='h-14 rounded-full flex items-center overflow-hidden cursor-pointer backdrop-blur-2xl border glass-panel bg-white/80 dark:bg-dark-900/80 border-white/20 dark:border-white/5 shadow-glass'
      >
        {/* Play/Pause Button Area */}
        <button
          onClick={togglePlay}
          data-testid='music-toggle-btn'
          className='bg-none border-none w-14 h-14 cursor-pointer flex items-center justify-center shrink-0 relative'
        >
          {/* Animated Vinyl/Icon Background */}
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
            className={`w-10 h-10 rounded-full flex items-center justify-center relative shadow-soft overflow-hidden ${
              isPlaying ? 'bg-[conic-gradient(from_0deg,#111,#333,#111)]' : 'bg-gold-500'
            }`}
          >
            {/* Center hole/Details - Only show when appearing as Vinyl */}
            {isPlaying ? (
              <div className='w-3 h-3 rounded-full border-2 border-white/30 bg-gold-500' />
            ) : (
              /* Icon centered inside the gold circle */
              <span className='text-[1.2rem] text-white drop-shadow-md select-none leading-none'>
                ♫
              </span>
            )}
          </motion.div>

          {/* EQ Animation Bars when playing (stays absolute to button for stability) */}
          {isPlaying && !isMuted && (
            <div className='absolute inset-0 flex items-center justify-center gap-0.5 pointer-events-none'>
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  animate={{ height: [4, 12, 4] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                  className='w-[3px] bg-white/90 rounded-[2px]'
                />
              ))}
            </div>
          )}
        </button>

        {/* Nudge Prompt */}
        <AnimatePresence>
          {showNudge && !isPlaying && !hasInteracted && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              data-testid='nudge-tooltip'
              className='absolute bottom-[70px] left-0 bg-gold-500 text-white p-2.5 px-4 rounded-xl text-xs uppercase tracking-widest shadow-gold pointer-events-none z-10'
            >
              Play Music 🎵
              <div className='absolute -bottom-1.5 left-5 w-3 h-3 bg-gold-500 rotate-45' />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Controls */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, width: 0, x: -10 }}
              animate={{ opacity: 1, width: 'auto', x: 0 }}
              exit={{ opacity: 0, width: 0, x: -10 }}
              className='flex items-center pr-6 whitespace-nowrap gap-4'
            >
              {/* Mute Toggle */}
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className='bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition-all group'
              >
                <span className='text-sm leading-none flex items-center justify-center translate-y-[1px] translate-x-[0.5px]'>
                  {isMuted ? '🔇' : '🔊'}
                </span>
              </button>

              <button
                onClick={prevTrack}
                title='Previous Track'
                className='text-gold-600 dark:text-gold-400 hover:scale-110 transition-transform'
              >
                ⏮
              </button>

              <div className='flex flex-col min-w-[120px] justify-center'>
                <span className='font-display text-sm font-medium tracking-tight text-dark-900 dark:text-cream-100 truncate max-w-[180px] leading-tight'>
                  {currentTrack.title}
                </span>
                <span className='font-body text-[10px] uppercase tracking-[0.2em] font-light text-dark-500/80 dark:text-cream-400/60 truncate max-w-[180px] mt-0.5'>
                  {currentTrack.artist}
                </span>
              </div>

              <button
                onClick={skipTrack}
                title='Next Track'
                className='text-gold-600 dark:text-gold-400 hover:scale-110 transition-transform'
              >
                ⏭
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default BackgroundMusic
