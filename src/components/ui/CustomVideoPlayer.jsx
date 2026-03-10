import { AnimatePresence, motion } from 'framer-motion'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import CornerOrnament from './decorations/CornerOrnament'
import { FullscreenIcon, PauseIcon, PlayIcon, VolumeIcon } from './icons/VideoIcons'

const CustomVideoPlayer = forwardRef(
  (
    {
      src,
      poster,
      autoPlay = false,
      children,
      className,
      style,
      onClick,
      onPlay,
      chapters = [],
      ...rest
    },
    ref
  ) => {
    const internalVideoRef = useRef(null)
    const containerRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isMuted, setIsMuted] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const controlsTimeoutRef = useRef(null)

    // Chapter Hover State
    const [hoverChapter, setHoverChapter] = useState(null)
    const [hoverX, setHoverX] = useState(0)

    // Expose video methods to parent
    useImperativeHandle(ref, () => ({
      get currentTime() {
        return internalVideoRef.current?.currentTime || 0
      },
      set currentTime(val) {
        if (internalVideoRef.current) internalVideoRef.current.currentTime = val
      },
      play: () => internalVideoRef.current?.play(),
      pause: () => internalVideoRef.current?.pause(),
      get duration() {
        return internalVideoRef.current?.duration || 0
      },
      get videoElement() {
        return internalVideoRef.current
      },
    }))

    // AutoPlay handling
    useEffect(() => {
      if (autoPlay && internalVideoRef.current) {
        internalVideoRef.current.play().catch(() => {
          // Autoplay might initially fail if not muted, but we'll try
          setIsPlaying(false)
        })
      }
    }, [autoPlay])

    // Hide controls logic
    const handleMouseMove = () => {
      setShowControls(true)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500)
      }
    }

    const togglePlay = e => {
      e?.stopPropagation()
      if (internalVideoRef.current) {
        if (isPlaying) {
          internalVideoRef.current.pause()
        } else {
          internalVideoRef.current.play()
        }
      }
    }

    const handleTimeUpdate = () => {
      if (internalVideoRef.current) {
        const current = internalVideoRef.current.currentTime
        const total = internalVideoRef.current.duration
        setCurrentTime(current)
        setDuration(total) // Update duration continuously just in case
        setProgress((current / total) * 100)
      }
    }

    const handleSeek = e => {
      e.stopPropagation()
      const timelineWidth = e.currentTarget.offsetWidth
      const clickPosition = e.nativeEvent.offsetX
      const newProgress = (clickPosition / timelineWidth) * 100

      if (internalVideoRef.current && duration) {
        const newTime = (newProgress / 100) * duration
        internalVideoRef.current.currentTime = newTime
        setProgress(newProgress)
      }
    }

    const toggleMute = e => {
      e.stopPropagation()
      if (internalVideoRef.current) {
        internalVideoRef.current.muted = !isMuted
        setIsMuted(!isMuted)
      }
    }

    const toggleFullscreen = e => {
      e.stopPropagation()
      if (containerRef.current) {
        if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(() => { /* Fullscreen not supported */ })
        } else {
          document.exitFullscreen()
        }
      }
    }

    const formatTime = timeInSeconds => {
      const minutes = Math.floor(timeInSeconds / 60)
      const seconds = Math.floor(timeInSeconds % 60)
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
    }

    const [preloadState, setPreloadState] = useState(autoPlay ? 'auto' : 'none')

    useEffect(() => {
      if (autoPlay) return

      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setPreloadState('metadata')
              observer.disconnect()
            }
          })
        },
        { rootMargin: '200px' }
      )

      if (containerRef.current) {
        observer.observe(containerRef.current)
      }

      return () => observer.disconnect()
    }, [autoPlay])

    return (
      <div
        ref={containerRef}
        className={`custom-video-player relative w-full h-full bg-black overflow-hidden group ${
          className || ''
        }`}
        style={style}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={onClick}
        role='button'
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            togglePlay(e)
          }
        }}
      >
        {/* Film Frame Aesthetic */}
        <div className='absolute inset-0 z-10 pointer-events-none border-[12px] border-black/20 mix-blend-overlay' />
        <div className='absolute inset-0 z-10 pointer-events-none'>
          <CornerOrnament position='top-left' />
          <CornerOrnament position='top-right' />
          <CornerOrnament position='bottom-left' />
          <CornerOrnament position='bottom-right' />
        </div>

        {/* Film Grain/Noise Overlay */}
        <div className='absolute inset-0 z-5 opacity-[0.03] pointer-events-none bg-[url("https://www.transparenttextures.com/patterns/stardust.png")]' />

        <video
          ref={internalVideoRef}
          src={src}
          poster={poster}
          preload={preloadState}
          className='w-full h-full object-contain'
          onPlay={e => {
            setIsPlaying(true)
            if (onPlay) onPlay(e)
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onClick={togglePlay}
          playsInline
          {...rest}
        >
          <track kind='captions' src='/captions/empty.vtt' srcLang='en' label='English' />
          {children}
        </video>

        {/* Center Play Button (only if paused/idle) */}
        <AnimatePresence>
          {!isPlaying && showControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none'
            >
              <div className='bg-black/50 backdrop-blur-sm rounded-full p-5 text-white flex'>
                <PlayIcon />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Controls Bar */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className='absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 z-10 flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
              onClick={e => e.stopPropagation()} // Prevent masking clicks from toggling play
              onKeyDown={e => e.stopPropagation()}
              role='toolbar'
              aria-label='Video controls'
            >
              {/* Progress Bar */}
              <div
                className='w-full h-1 bg-white/20 rounded-sm cursor-pointer relative transition-[height] duration-200 mb-2.5 hover:h-2 group/progress'
                onClick={handleSeek}
                role='slider'
                aria-label='Seek video'
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    if (internalVideoRef.current) internalVideoRef.current.currentTime += 5
                  }
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    if (internalVideoRef.current) internalVideoRef.current.currentTime -= 5
                  }
                }}
                onMouseMove={e => {
                  if (!chapters || chapters.length === 0 || !duration) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percent = x / rect.width
                  const hoverTime = percent * duration

                  // Find active chapter for this time
                  // iterate backwards to find the first chapter that has time <= hoverTime
                  let found = null
                  for (let i = chapters.length - 1; i >= 0; i--) {
                    if (hoverTime >= chapters[i].time) {
                      found = chapters[i]
                      break
                    }
                  }

                  // Set state for tooltip (needs new state)
                  setHoverChapter(found)
                  setHoverX(x)
                }}
                onMouseLeave={() => {
                  setHoverChapter(null)
                }}
              >
                {/* Chapters Tooltip */}
                <AnimatePresence>
                  {hoverChapter && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className='absolute bottom-4 -translate-x-1/2 bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none z-20'
                      style={{ left: hoverX }}
                    >
                      {hoverChapter.label}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chapter Markers */}
                {chapters &&
                  chapters.map((chapter, index) => {
                    const pct = (chapter.time / duration) * 100
                    if (isNaN(pct) || pct < 0 || pct > 100) return null
                    return (
                      <div
                        key={index}
                        className='absolute top-0 bottom-0 w-0.5 bg-white/50 z-1 pointer-events-none'
                        style={{ left: `${pct}%` }}
                      />
                    )
                  })}

                <div
                  className='h-full bg-(--color-gold,#c9a961) rounded-sm relative z-2'
                  style={{ width: `${progress}%` }}
                >
                  {/* Scrubber Dot */}
                  <div className='absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 transition-opacity duration-200 shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover/progress:opacity-100' />
                </div>
              </div>

              {/* Buttons Row */}
              <div className='flex items-center justify-between text-white'>
                <div className='flex items-center gap-4'>
                  <button
                    onClick={togglePlay}
                    className='bg-transparent border-none text-white cursor-pointer p-0 flex items-center opacity-80 transition-all duration-200 hover:opacity-100 hover:scale-110'
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <div className='flex items-center gap-1'>
                    <button
                      onClick={toggleMute}
                      className='bg-transparent border-none text-white cursor-pointer p-0 flex items-center opacity-80 transition-all duration-200 hover:opacity-100 hover:scale-110'
                    >
                      <VolumeIcon muted={isMuted} />
                    </button>
                  </div>
                  <span className='text-xs font-mono opacity-80'>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div>
                  <button
                    onClick={toggleFullscreen}
                    className='bg-transparent border-none text-white cursor-pointer p-0 flex items-center opacity-80 transition-all duration-200 hover:opacity-100 hover:scale-110'
                  >
                    <FullscreenIcon />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

CustomVideoPlayer.displayName = 'CustomVideoPlayer'

export default CustomVideoPlayer
