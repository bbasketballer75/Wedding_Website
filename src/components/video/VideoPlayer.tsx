import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  SkipBack, SkipForward, Cast, ChevronRight 
} from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'

interface Chapter {
  label: string
  time: number
  thumbnail?: string
}

interface VideoPlayerProps {
  src: string
  title?: string
  chapters?: Chapter[]
  poster?: string
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  className?: string
}

export function VideoPlayer({ 
  src, 
  title, 
  chapters = [], 
  poster,
  onTimeUpdate,
  onEnded,
  className 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [showChapterMenu, setShowChapterMenu] = useState(false)
  
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem(`video-progress-${src}`)
    if (saved && videoRef.current) {
      videoRef.current.currentTime = parseFloat(saved)
    }
  }, [src])

  // Save progress periodically
  useEffect(() => {
    if (!isPlaying) return
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        localStorage.setItem(`video-progress-${src}`, videoRef.current.currentTime.toString())
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isPlaying, src])

  const activeChapter = chapters.findIndex((ch, i) => {
    const nextCh = chapters[i + 1]
    return currentTime >= ch.time && (!nextCh || currentTime < nextCh.time)
  })

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
      onTimeUpdate?.(videoRef.current.currentTime)
    }
  }, [onTimeUpdate])

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      setIsLoading(false)
    }
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.volume = vol
      setVolume(vol)
      setIsMuted(vol === 0)
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
      setIsFullscreen(!isFullscreen)
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }, [isFullscreen])

  const jumpToChapter = useCallback((chapter: Chapter, index: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.time
      setShowChapterMenu(false)
      if (index >= 0 && !isPlaying) {
        void videoRef.current.play()
        setIsPlaying(true)
      }
    }
  }, [isPlaying])

  // Mouse activity for controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          skip(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          skip(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (videoRef.current) {
            const newVol = Math.min(1, videoRef.current.volume + 0.1)
            videoRef.current.volume = newVol
            setVolume(newVol)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (videoRef.current) {
            const newVol = Math.max(0, videoRef.current.volume - 0.1)
            videoRef.current.volume = newVol
            setVolume(newVol)
          }
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'Escape':
          if (showChapterMenu) {
            setShowChapterMenu(false)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, skip, toggleFullscreen, toggleMute, showChapterMenu])

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative w-full bg-black rounded-2xl overflow-hidden group',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : '',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain bg-black"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onClick={togglePlay}
        playsInline
        preload="metadata"
      >
        <track
          kind="captions"
          srcLang="en"
          label="English captions"
          src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00.000%20--%3E%2099:59.000%0AWedding%20film."
          default
        />
      </video>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/50"
          >
            <div className="w-12 h-12 border-3 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big Play Button (when paused) */}
      <AnimatePresence>
        {!isPlaying && !isLoading && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
          >
            <div className="w-20 h-20 rounded-full bg-gold-500/90 flex items-center justify-center shadow-gold hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none"
          >
            {/* Top Bar - Title & Chapters */}
            <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between pointer-events-auto">
              <div>
                {title && (
                  <h3 className="text-white font-display text-xl md:text-2xl drop-shadow-lg">
                    {title}
                  </h3>
                )}
                {chapters.length > 0 && (
                  <button
                    onClick={() => setShowChapterMenu(!showChapterMenu)}
                    className="mt-2 text-gold-400 text-sm hover:text-gold-300 transition-colors flex items-center gap-1"
                    aria-label={`${showChapterMenu ? 'Hide' : 'Show'} chapters`}
                    aria-expanded={showChapterMenu}
                    aria-controls="video-chapter-menu"
                  >
                    Chapter {Math.max(activeChapter, 0) + 1}: {chapters[Math.max(activeChapter, 0)]?.label}
                    <ChevronRight className={cn('w-4 h-4 transition-transform', showChapterMenu && 'rotate-90')} />
                  </button>
                )}
              </div>

              {/* Cast & Settings */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullscreen}
                  className="p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  <Cast className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chapter Menu */}
            <AnimatePresence>
              {showChapterMenu && chapters.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  id="video-chapter-menu"
                  className="absolute top-20 left-4 bg-black/90 backdrop-blur-xl rounded-xl p-4 max-w-xs max-h-[60vh] overflow-y-auto"
                >
                  <h4 className="text-white font-medium mb-3 text-sm uppercase tracking-wider">Chapters</h4>
                  <div className="space-y-1">
                    {chapters.map((chapter, i) => (
                      <button
                        key={i}
                        onClick={() => jumpToChapter(chapter, i)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                          activeChapter === i
                            ? 'bg-gold-500 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span>{chapter.label}</span>
                          <span className="text-xs opacity-70">{formatTime(chapter.time)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pointer-events-auto">
              {/* Progress Bar */}
              <div className="relative mb-4 group/progress">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  aria-label="Seek through the wedding film"
                  className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-500 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  style={{
                    background: `linear-gradient(to right, #c9a05c 0%, #c9a05c ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) 100%)`
                  }}
                />
                
                {/* Chapter Markers */}
                {chapters.map((chapter, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToChapter(chapter, i)}
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/50 hover:bg-gold-500 transition-colors"
                    style={{ left: `${duration > 0 ? (chapter.time / duration) * 100 : 0}%` }}
                    title={chapter.label}
                  />
                ))}
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-4">
                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className="p-2 text-white hover:text-gold-400 transition-colors"
                    aria-label={isPlaying ? 'Pause film' : 'Play film'}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" fill="currentColor" />
                    ) : (
                      <Play className="w-6 h-6" fill="currentColor" />
                    )}
                  </button>

                  {/* Skip Buttons */}
                  <button
                    onClick={() => skip(-10)}
                    className="hidden md:block p-2 text-white/70 hover:text-white transition-colors"
                    aria-label="Skip back 10 seconds"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => skip(10)}
                    className="hidden md:block p-2 text-white/70 hover:text-white transition-colors"
                    aria-label="Skip forward 10 seconds"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/volume">
                    <button
                      onClick={toggleMute}
                      className="p-2 text-white/70 hover:text-white transition-colors"
                      aria-label={isMuted || volume === 0 ? 'Unmute film' : 'Mute film'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Adjust film volume"
                      className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                  </div>

                  {/* Time Display */}
                  <div className="text-white/80 text-sm font-mono hidden sm:block">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5" />
                    ) : (
                      <Maximize className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
