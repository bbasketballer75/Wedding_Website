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
  const [isCompactScreen, setIsCompactScreen] = useState(false)
  const hasNudgedRef = useRef(false)

  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const syncScreenSize = () => {
      setIsCompactScreen(window.innerWidth < 640)
    }

    syncScreenSize()
    window.addEventListener('resize', syncScreenSize)

    return () => window.removeEventListener('resize', syncScreenSize)
  }, [])

  // Nudge Triggers (Scroll & Time)
  useEffect(() => {
    const triggerNudge = () => {
      hasNudgedRef.current = true
      setShowNudge(true)
      // Auto-dismiss after 10 seconds
      setTimeout(() => setShowNudge(false), 10000)
    }

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

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(timer)
    }
  }, [isPlaying, hasInteracted])

  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
    const audio = new Audio(mainPlaylist[0].src)
    audio.loop = false
    audio.volume = volume

    audioRef.current = audio

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

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
  }, [handleTrackEnd])

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

  const toggleMute = (e: React.MouseEvent) => {
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
  const skipTrack = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleTrackEnd()
  }

  const prevTrack = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentTrackIndex(prev => (prev - 1 + activePlaylist.length) % activePlaylist.length)
  }

  // Get current track info safely
  const currentTrack = activePlaylist[currentTrackIndex] || mainPlaylist[0]

  return (
    <div className='fixed bottom-4 left-1/2 z-100 w-[calc(100vw-1.5rem)] max-w-xs -translate-x-1/2 p-safe-bottom sm:bottom-8 sm:left-6 sm:w-auto sm:max-w-none sm:translate-x-0'>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={{ width: '56px', opacity: 0.8 }}
        animate={{
          width: isHovered && !isCompactScreen ? 'auto' : '56px',
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
        className='flex h-14 w-full items-center overflow-hidden rounded-full border border-gold-200/60 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(250,248,244,0.96)_55%,rgba(246,239,226,0.92))] shadow-[0_22px_48px_-30px_rgba(46,33,13,0.34)] backdrop-blur-2xl cursor-pointer sm:w-auto'
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
              <span className='text-[1.2rem] text-white drop-shadow-md select-none leading-none'>
                ♫
              </span>
            )}
          </motion.div>

          {/* EQ Animation Bars when playing */}
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
              className='absolute bottom-[70px] left-0 rounded-xl border border-gold-300/60 bg-[linear-gradient(145deg,rgba(201,160,92,0.95),rgba(166,130,74,0.96))] p-2.5 px-4 text-xs uppercase tracking-widest text-white shadow-gold pointer-events-none z-10'
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
              className='hidden items-center gap-4 pr-6 sm:flex'
            >
              {/* Mute Toggle */}
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className='flex h-8 w-8 items-center justify-center rounded-full bg-gold-50/90 text-charcoal-600 transition-all hover:bg-gold-100 group'
              >
                <span className='text-sm leading-none flex items-center justify-center translate-y-[1px] translate-x-[0.5px]'>
                  {isMuted ? '🔇' : '🔊'}
                </span>
              </button>

              <button
                onClick={prevTrack}
                title='Previous Track'
                className='text-gold-600 hover:scale-110 transition-transform'
              >
                ⏮
              </button>

              <div className='flex min-w-0 flex-col justify-center sm:min-w-[120px]'>
                <span className='font-display text-sm font-medium tracking-tight text-charcoal-900 truncate max-w-[180px] leading-tight'>
                  {currentTrack.title}
                </span>
                <span className='mt-0.5 max-w-[180px] truncate font-body text-[10px] font-light uppercase tracking-[0.2em] text-charcoal-500/80'>
                  {currentTrack.artist}
                </span>
              </div>

              <button
                onClick={skipTrack}
                title='Next Track'
                className='text-gold-600 hover:scale-110 transition-transform'
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
