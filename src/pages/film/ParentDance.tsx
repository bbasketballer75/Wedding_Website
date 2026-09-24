import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, RotateCcw, X } from 'lucide-react'
import { getMediaPath } from '@/utils/media'
import type { FamilyFilm } from '@/data/film'

export function ParentDanceCard({
  film,
  onOpen,
}: {
  film: FamilyFilm
  onOpen: (film: FamilyFilm) => void
}) {
  const [previewFrames, setPreviewFrames] = useState<string[]>([film.thumbnail])
  const [activeFrame, setActiveFrame] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const videoSrc = getMediaPath(film.videoSrc)

  useEffect(() => {
    let isCancelled = false

    const extractFrames = async () => {
      const video = document.createElement('video')
      video.src = videoSrc
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        return
      }

      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        video.addEventListener('error', () => reject(new Error('Unable to load preview video')), {
          once: true,
        })
      }).catch(() => {})

      if (!video.videoWidth || !video.videoHeight || isCancelled) {
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const frames: string[] = []

      for (const timestamp of film.previewFrameTimestamps) {
        if (isCancelled) {
          break
        }

        const safeTime = Math.min(timestamp, Math.max(video.duration - 0.1, 0))

        await new Promise<void>(resolve => {
          const handleSeeked = () => {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            frames.push(canvas.toDataURL('image/jpeg', 0.82))
            resolve()
          }

          video.addEventListener('seeked', handleSeeked, { once: true })
          video.currentTime = safeTime
        })
      }

      if (!isCancelled && frames.length > 0) {
        setPreviewFrames(frames)
      }
    }

    void extractFrames()

    return () => {
      isCancelled = true
    }
  }, [film.previewFrameTimestamps, videoSrc])

  useEffect(() => {
    if (!isHovering || previewFrames.length < 2) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveFrame(current => (current + 1) % previewFrames.length)
    }, 1100)

    return () => window.clearInterval(interval)
  }, [isHovering, previewFrames])

  return (
    <button
      type='button'
      onClick={() => onOpen(film)}
      aria-label={`Play ${film.label} parent dance`}
      onMouseEnter={() => {
        setActiveFrame(0)
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setActiveFrame(0)
        setIsHovering(false)
      }}
      onFocus={() => {
        setActiveFrame(0)
        setIsHovering(true)
      }}
      onBlur={() => {
        setActiveFrame(0)
        setIsHovering(false)
      }}
      className='group relative block w-full overflow-hidden rounded-[1.75rem] border border-[rgba(255,245,230,0.08)] bg-[#0b0908] p-2.5 text-left shadow-[0_28px_70px_-46px_rgba(10,8,7,0.9)] transition-transform duration-300 hover:-translate-y-1 hover:border-gold-300/18 sm:p-3'
    >
      <div className='relative aspect-video overflow-hidden rounded-[1.3rem] bg-[#14100d]'>
        <div
          className='absolute inset-0 bg-contain bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-[1.02]'
          style={{
            backgroundImage: `url(${(isHovering ? previewFrames[activeFrame] : previewFrames[0]) || film.thumbnail})`,
          }}
        />
        <div className='absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(to_top,rgba(7,6,6,0.56)_0%,rgba(7,6,6,0.18)_48%,transparent_100%)]' />
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,244,227,0.12),transparent_34%)]' />
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100'>
          <div className='flex h-12 w-12 items-center justify-center text-[rgba(255,248,239,0.96)] drop-shadow-[0_10px_24px_rgba(7,6,6,0.55)]'>
            <Play className='ml-0.5 h-4 w-4' fill='currentColor' />
          </div>
        </div>
      </div>
    </button>
  )
}

export function ParentDanceModal({
  film,
  onClose,
}: {
  film: FamilyFilm | null
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPhonePortrait, setIsPhonePortrait] = useState(false)
  const shouldRequireLandscape = isPhonePortrait

  useEffect(() => {
    if (!film) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [film, onClose])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateViewportState = () => {
      setIsPhonePortrait(
        window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches
      )
    }

    updateViewportState()
    window.addEventListener('resize', updateViewportState)
    window.addEventListener('orientationchange', updateViewportState)

    return () => {
      window.removeEventListener('resize', updateViewportState)
      window.removeEventListener('orientationchange', updateViewportState)
    }
  }, [])

  useEffect(() => {
    if (!film || !videoRef.current || shouldRequireLandscape) {
      return
    }

    const playAttempt = videoRef.current.play()
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {})
    }
  }, [film, shouldRequireLandscape])

  useEffect(() => {
    if (!shouldRequireLandscape || !videoRef.current) {
      return
    }

    videoRef.current.pause()
  }, [shouldRequireLandscape])

  return (
    <AnimatePresence>
      {film ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(18,12,10,0.82)] p-4 backdrop-blur-md'
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className='cinematic-panel w-full max-w-5xl overflow-hidden'
            onClick={event => event.stopPropagation()}
          >
            <div className='flex items-center justify-between border-b border-gold-200/14 px-5 py-4 sm:px-6'>
              <div>
                <p className='text-[10px] uppercase tracking-[0.32em] text-gold-300/82'>
                  Parent dance
                </p>
                <h3 className='mt-2 font-display text-3xl text-cinematic-primary'>{film.label}</h3>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='flex h-11 w-11 items-center justify-center rounded-full border border-gold-200/18 bg-[rgba(255,247,235,0.08)] text-cinematic-primary transition-colors hover:border-gold-300/35 hover:text-gold-300'
                aria-label='Close parent dance video'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]'>
              <div className='flex flex-col gap-3'>
                <div className='relative overflow-hidden rounded-[1.75rem] border border-gold-200/16 bg-black/20'>
                  <video
                    ref={videoRef}
                    src={getMediaPath(film.videoSrc)}
                    controls
                    poster={film.thumbnail}
                    playsInline
                    className='aspect-video w-full object-cover'
                  >
                    <track
                      kind='captions'
                      src={getMediaPath(film.captionsSrc)}
                      srcLang='en'
                      label='English captions'
                      default
                    />
                  </video>
                </div>
                {shouldRequireLandscape && (
                  <div className='flex items-center justify-center gap-3 rounded-xl bg-white/8 px-4 py-3 text-sm text-white/70'>
                    <RotateCcw className='h-4 w-4 shrink-0 text-gold-400' />
                    Rotate your phone for the best view
                  </div>
                )}
              </div>

              <div className='cinematic-card px-5 py-5'>
                <p className='text-[10px] uppercase tracking-[0.3em] text-gold-300/82'>
                  Why it matters
                </p>
                <p className='mt-4 text-base leading-7 text-cinematic-secondary'>
                  {film.description}
                </p>
                <div className='mt-6 space-y-3 text-sm text-cinematic-secondary'>
                  <div className='rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3'>
                    <span className='text-[10px] uppercase tracking-[0.28em] text-gold-300/78'>
                      Duration
                    </span>
                    <p className='mt-2 font-display text-2xl text-cinematic-primary'>
                      {film.duration}
                    </p>
                  </div>
                  <div className='rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3'>
                    <span className='text-[10px] uppercase tracking-[0.28em] text-gold-300/78'>
                      Best for
                    </span>
                    <p className='mt-2 text-cinematic-secondary'>
                      Rewatching the quieter part of the reception that still hits hardest.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
