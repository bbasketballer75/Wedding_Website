import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  const resolvedChapters = useMemo(
    () => chapters.filter((chapter) => Number.isFinite(chapter.time) && chapter.label.trim().length > 0),
    [chapters]
  )
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

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

  const activeChapter = resolvedChapters.findIndex((ch, i) => {
    const nextCh = resolvedChapters[i + 1]
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
        'group relative w-full overflow-hidden rounded-[1.8rem] border border-gold-200/20 bg-[linear-gradient(140deg,rgba(35,25,20,0.98),rgba(48,35,28,0.98)_55%,rgba(78,58,44,0.96))] shadow-[0_40px_90px_-50px_rgba(21,20,19,0.9)]',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : '',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-32 bg-[radial-gradient(circle_at_top,rgba(245,226,191,0.18),transparent_62%)]" />

      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="relative z-[2] h-full w-full bg-[#130e0b] object-contain"
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
            className="absolute inset-0 z-[3] flex items-center justify-center bg-[linear-gradient(180deg,rgba(23,16,12,0.58),rgba(23,16,12,0.76))]"
          >
            <div className="h-12 w-12 animate-spin rounded-full border-3 border-gold-300/25 border-t-gold-400" />
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
            aria-label={title ? `Play ${title}` : 'Play wedding film'}
            title={title ? `Play ${title}` : 'Play wedding film'}
            className="absolute inset-0 z-[3] flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,247,235,0.04),rgba(24,18,14,0.42)_42%,rgba(24,18,14,0.62))] transition-colors hover:bg-[radial-gradient(circle_at_center,rgba(255,247,235,0.06),rgba(24,18,14,0.4)_36%,rgba(24,18,14,0.64))]"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-gold-100/30 bg-[linear-gradient(160deg,rgba(245,226,191,0.94),rgba(212,175,127,0.92))] text-charcoal-900 shadow-[0_22px_48px_-26px_rgba(219,184,128,0.9)] transition-transform hover:scale-105">
              <Play className="ml-1 h-9 w-9" fill="currentColor" />
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
            className="pointer-events-none absolute inset-0 z-[4] bg-[linear-gradient(to_top,rgba(20,14,10,0.94)_0%,rgba(20,14,10,0.2)_34%,rgba(20,14,10,0.54)_100%)]"
          >
            {/* Top Bar - Title & Chapters */}
            <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
              <div className="max-w-[70%] rounded-[1.35rem] border border-gold-200/12 bg-[linear-gradient(135deg,rgba(255,247,235,0.12),rgba(255,255,255,0.06))] px-4 py-3 backdrop-blur-md">
                {title && (
                  <h3 className="font-display text-xl text-cinematic-primary drop-shadow-lg md:text-2xl">
                    {title}
                  </h3>
                )}
                {resolvedChapters.length > 0 && (
                  <button
                    onClick={() => setShowChapterMenu(!showChapterMenu)}
                    className="mt-2 flex items-center gap-1 text-sm text-gold-300 transition-colors hover:text-candle-100"
                    aria-label={`${showChapterMenu ? 'Hide' : 'Show'} chapters`}
                    aria-expanded={showChapterMenu}
                    aria-controls="video-chapter-menu"
                  >
                    <span className="text-cinematic-muted">Now playing</span>
                    <span className="text-cinematic-primary">
                      Chapter {Math.max(activeChapter, 0) + 1}: {resolvedChapters[Math.max(activeChapter, 0)]?.label}
                    </span>
                    <ChevronRight className={cn('w-4 h-4 transition-transform', showChapterMenu && 'rotate-90')} />
                  </button>
                )}
              </div>

              {/* Cast & Settings */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullscreen}
                  className="rounded-full border border-gold-200/12 bg-[linear-gradient(135deg,rgba(255,247,235,0.12),rgba(255,255,255,0.05))] p-2.5 text-cinematic-secondary transition-colors hover:text-cinematic-primary"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  <Cast className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chapter Menu */}
            <AnimatePresence>
              {showChapterMenu && resolvedChapters.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  id="video-chapter-menu"
                  className="absolute left-4 top-22 max-h-[60vh] max-w-sm overflow-y-auto rounded-[1.35rem] border border-gold-200/12 bg-[linear-gradient(145deg,rgba(35,25,20,0.96),rgba(56,40,30,0.96))] p-4 backdrop-blur-xl"
                >
                  <h4 className="mb-3 text-sm font-medium uppercase tracking-wider text-cinematic-primary">Chapters</h4>
                  <div className="space-y-1">
                    {resolvedChapters.map((chapter, i) => (
                      <button
                        key={i}
                        onClick={() => jumpToChapter(chapter, i)}
                        className={cn(
                          'w-full rounded-xl px-3 py-2 text-left text-sm transition-colors',
                          activeChapter === i
                            ? 'bg-[linear-gradient(135deg,rgba(219,184,128,0.95),rgba(169,130,74,0.96))] text-charcoal-900'
                            : 'text-cinematic-secondary hover:bg-white/8 hover:text-cinematic-primary'
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
            <div className="pointer-events-auto absolute bottom-0 left-0 right-0 p-4 md:p-6">
              {/* Progress Bar */}
              <div className="group/progress relative mb-4 rounded-[1.35rem] border border-gold-200/10 bg-[linear-gradient(135deg,rgba(255,247,235,0.08),rgba(255,255,255,0.03))] px-3 py-3 backdrop-blur-md sm:px-4">
                <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-cinematic-muted">
                  <span>{resolvedChapters.length} chapters</span>
                  <span>{Math.round(progressPercent)}% watched</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  aria-label="Seek through the wedding film"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/18 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(245,226,191,0.18)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  style={{
                    background: `linear-gradient(to right, #dbb880 0%, #dbb880 ${progressPercent}%, rgba(255,247,235,0.18) ${progressPercent}%, rgba(255,247,235,0.18) 100%)`
                  }}
                />
                
                {/* Chapter Markers */}
                {resolvedChapters.map((chapter, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToChapter(chapter, i)}
                    className="absolute top-[calc(50%+0.85rem)] h-3 w-0.5 -translate-y-1/2 bg-white/45 transition-colors hover:bg-gold-300"
                    style={{ left: `${duration > 0 ? (chapter.time / duration) * 100 : 0}%` }}
                    title={chapter.label}
                  />
                ))}
              </div>

              {/* Control Buttons */}
              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-gold-200/10 bg-[linear-gradient(135deg,rgba(255,247,235,0.12),rgba(255,255,255,0.04))] px-3 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className="rounded-full bg-[linear-gradient(145deg,rgba(245,226,191,0.95),rgba(219,184,128,0.92))] p-2.5 text-charcoal-900 transition-transform hover:scale-[1.03]"
                    aria-label={isPlaying ? 'Pause film' : 'Play film'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" fill="currentColor" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                    )}
                  </button>

                  {/* Skip Buttons */}
                  <button
                    onClick={() => skip(-10)}
                    className="hidden rounded-full p-2 text-cinematic-secondary transition-colors hover:text-cinematic-primary md:block"
                    aria-label="Skip back 10 seconds"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => skip(10)}
                    className="hidden rounded-full p-2 text-cinematic-secondary transition-colors hover:text-cinematic-primary md:block"
                    aria-label="Skip forward 10 seconds"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/volume">
                    <button
                      onClick={toggleMute}
                      className="rounded-full p-2 text-cinematic-secondary transition-colors hover:text-cinematic-primary"
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
                      className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 transition-all duration-300 group-hover/volume:w-20 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-candle-100"
                    />
                  </div>

                  {/* Time Display */}
                  <div className="hidden text-sm font-mono text-cinematic-secondary sm:block">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-gold-200/10 bg-white/6 px-3 py-1.5 text-[10px] uppercase tracking-[0.26em] text-cinematic-muted">
                    {activeChapter >= 0 ? resolvedChapters[activeChapter]?.label : 'Opening'}
                  </div>
                  <button
                    onClick={toggleFullscreen}
                    className="rounded-full p-2 text-cinematic-secondary transition-colors hover:text-cinematic-primary"
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
