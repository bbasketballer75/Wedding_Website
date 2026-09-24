import { useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Cast,
  ChevronRight,
  X,
  RotateCw,
  Smartphone,
} from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import { type VideoPlayerProps } from './types'
import { usePortraitLock } from './usePortraitLock'
import { useCastPlayback } from './useCastPlayback'
import { usePreviewVideo } from './usePreviewVideo'
import { useVideoProgress } from './useVideoProgress'
import { useControlsVisibility } from './useControlsVisibility'
import { useChapterMenu } from './useChapterMenu'
import { useVideoPlayback } from './useVideoPlayback'

export function VideoPlayer({
  src,
  title,
  chapters = [],
  poster,
  captionsSrc,
  previewStartTime = 0,
  storageKey,
  onTimeUpdate,
  onEnded,
  className,
  requireLandscapeOnPhone = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const resolvedStorageKey = storageKey || src
  const resolvedChapters = useMemo(
    () =>
      chapters.filter(chapter => Number.isFinite(chapter.time) && chapter.label.trim().length > 0),
    [chapters]
  )

  const isPhonePortrait = usePortraitLock()
  const shouldRequireLandscape = requireLandscapeOnPhone && isPhonePortrait

  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    isLoading,
    hasStartedPlayback,
    setHasStartedPlayback,
    captionsEnabled,
    setCaptionsEnabled,
    togglePlay,
    handleLoadedMetadata,
    handleSeek,
    skip,
    toggleMute,
    handleVolumeChange,
    toggleFullscreen,
  } = useVideoPlayback(videoRef, containerRef, src, captionsSrc, shouldRequireLandscape)

  const shouldShowPreviewVideo = !hasStartedPlayback && !shouldRequireLandscape
  const { previewReady, setPreviewReady } = usePreviewVideo(
    previewVideoRef,
    previewStartTime,
    shouldShowPreviewVideo
  )
  const { canCast, isCasting, handleCast } = useCastPlayback(videoRef)
  const { handleTimeUpdate, handleEnded } = useVideoProgress(
    videoRef,
    resolvedStorageKey,
    isPlaying,
    setCurrentTime,
    onTimeUpdate,
    onEnded
  )
  const { showControls, setShowControls, handleMouseMove } = useControlsVisibility(isPlaying)
  const { showChapterMenu, setShowChapterMenu, activeChapter, jumpToChapter } = useChapterMenu(
    videoRef,
    resolvedChapters,
    currentTime,
    isPlaying,
    setIsPlaying,
    shouldRequireLandscape
  )

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const shouldShowControlsOverlay = showControls || shouldRequireLandscape

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
      <div className='pointer-events-none absolute inset-x-0 top-0 z-[1] h-32 bg-[radial-gradient(circle_at_top,rgba(245,226,191,0.18),transparent_62%)]' />

      {/* Video Element */}
      {shouldShowPreviewVideo && !previewReady && poster && (
        <div
          className='pointer-events-none absolute inset-0 z-[2] bg-mocha-900 bg-contain bg-center bg-no-repeat blur-[10px] saturate-[0.78] brightness-[0.68] scale-[1.02]'
          style={{ backgroundImage: `url(${poster})` }}
          aria-hidden='true'
        />
      )}
      <video
        ref={previewVideoRef}
        src={src}
        poster={poster}
        muted
        playsInline
        preload='auto'
        crossOrigin='anonymous'
        onLoadStart={() => setPreviewReady(false)}
        aria-hidden='true'
        className={cn(
          'pointer-events-none absolute inset-0 z-[2] h-full w-full bg-mocha-900 object-contain transition-[filter,transform,opacity] duration-500 ease-out',
          shouldShowPreviewVideo && previewReady
            ? 'scale-[1.03] opacity-100 blur-[12px] saturate-[0.82] brightness-[0.72]'
            : 'scale-100 opacity-0'
        )}
      />
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        crossOrigin='anonymous'
        className={cn(
          'relative z-[2] h-full w-full bg-mocha-900 object-contain transition-[filter,transform,opacity] duration-500 ease-out',
          !hasStartedPlayback && 'opacity-0'
        )}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true)
          setHasStartedPlayback(true)
        }}
        onPause={() => setIsPlaying(false)}
        playsInline
        preload='metadata'
      >
        <track
          kind='captions'
          srcLang='en'
          label='English captions'
          src={captionsSrc || '/captions/empty.vtt'}
          default={captionsEnabled}
        />
      </video>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='absolute inset-0 z-[3] flex items-center justify-center bg-[linear-gradient(180deg,rgba(23,16,12,0.58),rgba(23,16,12,0.76))]'
          >
            <div className='h-12 w-12 animate-spin rounded-full border-3 border-gold-300/25 border-t-gold-400' />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shouldRequireLandscape && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='absolute inset-0 z-[5] flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,247,235,0.08),rgba(18,13,10,0.66)_42%,rgba(18,13,10,0.9))] px-5 text-center'
          >
            <div className='max-w-sm rounded-[1.6rem] border border-gold-200/20 bg-[linear-gradient(145deg,rgba(38,28,22,0.94),rgba(54,39,31,0.95))] px-5 py-6 shadow-[0_24px_60px_-32px_rgba(21,20,19,0.72)] backdrop-blur-xl sm:px-6'>
              <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold-200/20 bg-white/8 text-gold-300'>
                <div className='relative'>
                  <Smartphone className='h-7 w-7' />
                  <RotateCw className='absolute -right-2 -top-2 h-4 w-4' />
                </div>
              </div>
              <p className='mt-5 text-[10px] uppercase tracking-[0.32em] text-gold-300/82'>
                Best in landscape
              </p>
              <h3 className='mt-3 font-display text-3xl text-cinematic-primary'>
                Rotate your phone to watch.
              </h3>
              <p className='mt-3 text-sm leading-6 text-cinematic-secondary'>
                The full film uses a landscape-only player on phones so the controls and framing
                stay clean.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big Play Button (when paused) */}
      <AnimatePresence>
        {!isPlaying && !isLoading && !shouldRequireLandscape && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={togglePlay}
            aria-label={title ? `Play ${title}` : 'Play wedding film'}
            title={title ? `Play ${title}` : 'Play wedding film'}
            className='absolute inset-0 z-[3] flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,247,235,0.04),rgba(24,18,14,0.42)_42%,rgba(24,18,14,0.62))] transition-colors hover:bg-[radial-gradient(circle_at_center,rgba(255,247,235,0.06),rgba(24,18,14,0.4)_36%,rgba(24,18,14,0.64))]'
          >
            {!hasStartedPlayback && (
              <>
                <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,247,235,0.08),transparent_44%),linear-gradient(180deg,rgba(255,247,235,0.06),rgba(18,13,10,0.12)_35%,rgba(18,13,10,0.38))]' />
                <div className='pointer-events-none absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(180deg,rgba(255,247,235,0.08)_0px,rgba(255,247,235,0.08)_1px,transparent_1px,transparent_7px)]' />
                <div className='pointer-events-none absolute inset-x-[8%] top-[14%] h-px bg-white/22 blur-sm' />
                <div className='pointer-events-none absolute inset-x-[10%] bottom-[18%] h-px bg-gold-200/18 blur-sm' />
              </>
            )}
            <div className='flex h-24 w-24 items-center justify-center rounded-full border border-gold-100/30 bg-[linear-gradient(160deg,rgba(245,226,191,0.94),rgba(212,175,127,0.92))] text-charcoal-900 shadow-[0_22px_48px_-26px_rgba(219,184,128,0.9)] transition-transform hover:scale-105'>
              <Play className='ml-1 h-9 w-9' fill='currentColor' />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <AnimatePresence>
        {shouldShowControlsOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className='pointer-events-none absolute inset-0 z-[4] bg-[linear-gradient(to_top,rgba(20,14,10,0.94)_0%,rgba(20,14,10,0.2)_34%,rgba(20,14,10,0.54)_100%)]'
          >
            {/* Top Bar - Title & Chapters */}
            <div className='pointer-events-auto absolute inset-x-0 top-0 flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-6'>
              <div className='max-w-full rounded-[1.2rem] border border-gold-200/12 bg-[linear-gradient(135deg,rgba(255,247,235,0.12),rgba(255,255,255,0.06))] px-3 py-3 backdrop-blur-md sm:max-w-[70%] sm:px-4'>
                {title && (
                  <h3 className='font-display text-lg text-cinematic-primary drop-shadow-lg sm:text-xl md:text-2xl'>
                    {title}
                  </h3>
                )}
                {resolvedChapters.length > 0 && (
                  <button
                    id='video-chapter-toggle'
                    onClick={() => setShowChapterMenu(!showChapterMenu)}
                    className='mt-2 flex w-full items-start gap-1.5 text-left text-xs text-gold-300 transition-colors hover:text-candle-100 sm:text-sm'
                    aria-label={`${showChapterMenu ? 'Hide' : 'Show'} chapters`}
                    aria-expanded={showChapterMenu}
                    aria-controls='video-chapter-menu'
                  >
                    <span className='shrink-0 text-cinematic-muted'>Now playing</span>
                    <span className='min-w-0 flex-1 text-cinematic-primary'>
                      Chapter {Math.max(activeChapter, 0) + 1}:{' '}
                      {resolvedChapters[Math.max(activeChapter, 0)]?.label}
                    </span>
                    <ChevronRight
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 transition-transform',
                        showChapterMenu && 'rotate-90'
                      )}
                    />
                  </button>
                )}
              </div>

              {/* Cast & Settings */}
              <div className='flex items-center justify-end gap-2 sm:self-start'>
                {canCast && (
                  <button
                    onClick={handleCast}
                    className={cn(
                      'rounded-full border border-gold-200/12 bg-[linear-gradient(135deg,rgba(255,247,235,0.12),rgba(255,255,255,0.05))] p-2.5 transition-colors',
                      isCasting
                        ? 'text-gold-300 hover:text-candle-100'
                        : 'text-cinematic-secondary hover:text-cinematic-primary'
                    )}
                    aria-label={
                      isCasting ? 'Change casting or AirPlay target' : 'Cast or AirPlay this video'
                    }
                    title={isCasting ? 'Connected to remote playback' : 'Cast or AirPlay'}
                  >
                    <Cast className='w-5 h-5' />
                  </button>
                )}
              </div>
            </div>

            {/* Chapter Menu */}
            <AnimatePresence>
              {showChapterMenu && resolvedChapters.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  id='video-chapter-menu'
                  className='absolute left-3 right-3 top-[5.2rem] max-h-[58vh] overflow-y-auto rounded-[1.2rem] border border-gold-200/12 bg-[linear-gradient(145deg,rgba(35,25,20,0.96),rgba(56,40,30,0.96))] p-4 backdrop-blur-xl sm:left-4 sm:right-auto sm:top-[5.8rem] sm:max-h-[60vh] sm:max-w-sm sm:rounded-[1.35rem]'
                >
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <h4 className='text-sm font-medium uppercase tracking-wider text-cinematic-primary'>
                      Chapters
                    </h4>
                    <button
                      type='button'
                      onClick={() => setShowChapterMenu(false)}
                      className='flex h-8 w-8 items-center justify-center rounded-full border border-gold-200/12 bg-white/5 text-cinematic-secondary transition-colors hover:text-cinematic-primary'
                      aria-label='Close chapters'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </div>
                  <div className='space-y-1'>
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
                        <div className='flex items-center justify-between'>
                          <span>{chapter.label}</span>
                          <span className='text-xs opacity-70'>{formatTime(chapter.time)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Controls */}
            <div className='pointer-events-auto absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 md:p-4'>
              {/* Progress Bar */}
              <div className='group/progress relative mb-2.5 rounded-[1.05rem] border border-gold-200/10 bg-[linear-gradient(135deg,rgba(255,247,235,0.08),rgba(255,255,255,0.03))] px-3 py-2.5 backdrop-blur-md sm:mb-3 sm:px-3.5'>
                <div className='mb-2 flex flex-col gap-1.5 text-[9px] uppercase tracking-[0.24em] text-cinematic-muted min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between'>
                  <span>{resolvedChapters.length} chapters</span>
                  <span>{Math.round(progressPercent)}% watched</span>
                </div>
                <div className='relative'>
                  <input
                    type='range'
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    aria-label='Seek through the wedding film'
                    className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/18 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(245,226,191,0.18)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125'
                    style={{
                      background: `linear-gradient(to right, var(--color-gold-400) 0%, var(--color-gold-400) ${progressPercent}%, rgba(255,247,235,0.18) ${progressPercent}%, rgba(255,247,235,0.18) 100%)`,
                    }}
                  />

                  {/* Chapter Markers */}
                  <div className='pointer-events-none absolute inset-x-[8px] top-1/2 -translate-y-1/2'>
                    {resolvedChapters.slice(1).map((chapter, i) => {
                      const percentage = duration > 0 ? (chapter.time / duration) * 100 : 0

                      return (
                        <button
                          key={chapter.label}
                          type='button'
                          onClick={() => jumpToChapter(chapter, i + 1)}
                          className='pointer-events-auto absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-[rgba(255,247,235,0.16)] transition-colors hover:border-gold-300 hover:bg-gold-300/60'
                          style={{ left: `${percentage}%` }}
                          aria-label={`Jump to ${chapter.label}`}
                          title={chapter.label}
                        >
                          <span className='absolute left-1/2 top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80' />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className='rounded-[1.05rem] border border-gold-200/10 bg-[linear-gradient(135deg,rgba(255,247,235,0.12),rgba(255,255,255,0.04))] px-3 py-2.5 backdrop-blur-md sm:px-3.5'>
                <div className='flex flex-wrap items-center gap-1.5 sm:gap-2.5'>
                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className='rounded-full bg-[linear-gradient(145deg,rgba(245,226,191,0.95),rgba(219,184,128,0.92))] p-2.5 text-charcoal-900 transition-transform hover:scale-[1.03]'
                    aria-label={isPlaying ? 'Pause film' : 'Play film'}
                  >
                    {isPlaying ? (
                      <Pause className='w-5 h-5' fill='currentColor' />
                    ) : (
                      <Play className='w-5 h-5 ml-0.5' fill='currentColor' />
                    )}
                  </button>

                  {/* Skip Buttons */}
                  <button
                    onClick={() => skip(-10)}
                    className='hidden rounded-full p-2 text-cinematic-secondary transition-colors hover:text-cinematic-primary md:block'
                    aria-label='Skip back 10 seconds'
                  >
                    <SkipBack className='w-5 h-5' />
                  </button>
                  <button
                    onClick={() => skip(10)}
                    className='hidden rounded-full p-2 text-cinematic-secondary transition-colors hover:text-cinematic-primary md:block'
                    aria-label='Skip forward 10 seconds'
                  >
                    <SkipForward className='w-5 h-5' />
                  </button>

                  {/* Volume */}
                  <div className='flex items-center gap-2 group/volume'>
                    <button
                      onClick={toggleMute}
                      className='rounded-full p-1.5 text-cinematic-secondary transition-colors hover:text-cinematic-primary'
                      aria-label={isMuted || volume === 0 ? 'Unmute film' : 'Mute film'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className='w-5 h-5' />
                      ) : (
                        <Volume2 className='w-5 h-5' />
                      )}
                    </button>
                    <input
                      type='range'
                      min={0}
                      max={1}
                      step={0.1}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label='Adjust film volume'
                      className='hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 transition-all duration-300 sm:block sm:w-12 sm:group-hover/volume:w-20 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-candle-100'
                    />
                  </div>

                  {/* Time Display */}
                  <div className='min-[420px]:ml-auto text-xs font-mono text-cinematic-secondary sm:text-sm'>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                  <div className='max-w-full rounded-full border border-gold-200/10 bg-white/6 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-cinematic-muted'>
                    {activeChapter >= 0 ? resolvedChapters[activeChapter]?.label : 'Opening'}
                  </div>
                  {captionsSrc && (
                    <button
                      type='button'
                      onClick={() => setCaptionsEnabled(!captionsEnabled)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-colors',
                        captionsEnabled
                          ? 'border-gold-300/70 bg-gold-300/18 text-cinematic-primary'
                          : 'border-gold-200/10 bg-white/6 text-cinematic-muted hover:text-cinematic-primary'
                      )}
                      aria-pressed={captionsEnabled}
                      aria-label={captionsEnabled ? 'Turn off captions' : 'Turn on captions'}
                    >
                      CC
                    </button>
                  )}
                  <button
                    onClick={toggleFullscreen}
                    className='rounded-full p-1.5 text-cinematic-secondary transition-colors hover:text-cinematic-primary'
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize className='w-5 h-5' />
                    ) : (
                      <Maximize className='w-5 h-5' />
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
