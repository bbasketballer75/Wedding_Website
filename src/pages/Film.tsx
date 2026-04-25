import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { FamilyTree } from '@/components/family-tree/FamilyTree'
import { FilmFeatureSection } from '@/components/sections/FilmFeatureSection'
import { FilmSEO } from '@/components/seo/SEOHead'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { supabase, type GuestUpload } from '@/lib/supabase'
import {
  MAIN_FILM_CHAPTERS_FALLBACK,
  MAIN_FILM_RUNTIME_LABEL,
  familyFilms,
  type FamilyFilm,
  loadMainFilmChapters,
  slugifyFilmMoment,
  type FilmChapter,
} from '@/data/film'
import { getMemoryTrailById, memoryTrails } from '@/data/memoryTrails'
import { getMediaPath } from '@/utils/media'
import {
  Play,
  ArrowRight,
  Sparkles,
  Smartphone,
  X,
  RotateCcw,
} from 'lucide-react'
import {
  MAIN_FILM_PROGRESS_KEY,
  readSavedVideoProgress,
} from '@/utils/videoProgress'

const MAIN_FILM_POSTER = '/images/film/main-film-poster.png'
const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'

function formatChapterTime(totalSeconds: number) {
  const wholeSeconds = Math.floor(totalSeconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function ParentDanceCard({
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
        video.addEventListener('error', () => reject(new Error('Unable to load preview video')), { once: true })
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

        await new Promise<void>((resolve) => {
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
      setActiveFrame((current) => (current + 1) % previewFrames.length)
    }, 1100)

    return () => window.clearInterval(interval)
  }, [isHovering, previewFrames])

  return (
    <button
      type="button"
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
      className="group relative block w-full overflow-hidden rounded-[1.75rem] border border-[rgba(255,245,230,0.08)] bg-[#0b0908] p-2.5 text-left shadow-[0_28px_70px_-46px_rgba(10,8,7,0.9)] transition-transform duration-300 hover:-translate-y-1 hover:border-gold-300/18 sm:p-3"
    >
      <div
        className="relative aspect-video overflow-hidden rounded-[1.3rem] bg-[#14100d]"
      >
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-[1.02]"
          style={{
            backgroundImage: `url(${(isHovering ? previewFrames[activeFrame] : previewFrames[0]) || film.thumbnail})`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(to_top,rgba(7,6,6,0.56)_0%,rgba(7,6,6,0.18)_48%,transparent_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,244,227,0.12),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center text-[rgba(255,248,239,0.96)] drop-shadow-[0_10px_24px_rgba(7,6,6,0.55)]">
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          </div>
        </div>
      </div>
    </button>
  )
}

function ParentDanceModal({
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
      setIsPhonePortrait(window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches)
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(18,12,10,0.82)] p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="cinematic-panel w-full max-w-5xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold-200/14 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-300/82">Parent dance</p>
                <h3 className="mt-2 font-display text-3xl text-cinematic-primary">{film.label}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-200/18 bg-[rgba(255,247,235,0.08)] text-cinematic-primary transition-colors hover:border-gold-300/35 hover:text-gold-300"
                aria-label="Close parent dance video"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-gold-200/16 bg-black/20">
                  <video
                    ref={videoRef}
                    src={getMediaPath(film.videoSrc)}
                    controls
                    poster={film.thumbnail}
                    playsInline
                    className="aspect-video w-full object-cover"
                  >
                    <track
                      kind="captions"
                      src={getMediaPath(film.captionsSrc)}
                      srcLang="en"
                      label="English captions"
                      default
                    />
                  </video>
                </div>
                {shouldRequireLandscape && (
                  <div className="flex items-center justify-center gap-3 rounded-xl bg-white/8 px-4 py-3 text-sm text-white/70">
                    <RotateCcw className="h-4 w-4 shrink-0 text-gold-400" />
                    Rotate your phone for the best view
                  </div>
                )}
              </div>

              <div className="cinematic-card px-5 py-5">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300/82">Why it matters</p>
                <p className="mt-4 text-base leading-7 text-cinematic-secondary">
                  {film.description}
                </p>
                <div className="mt-6 space-y-3 text-sm text-cinematic-secondary">
                  <div className="rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-gold-300/78">Duration</span>
                    <p className="mt-2 font-display text-2xl text-cinematic-primary">{film.duration}</p>
                  </div>
                  <div className="rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-gold-300/78">Best for</span>
                    <p className="mt-2 text-cinematic-secondary">Rewatching the quieter part of the reception that still hits hardest.</p>
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

interface GuestVideoHighlight {
  id: string
  uploadId: string
  guestName: string
  title: string
  description: string
  videoUrl: string
  createdAt: string
  badge?: string
  trail?: string
}

function GuestVideoHighlightCard({
  clip,
  onOpen,
}: {
  clip: GuestVideoHighlight
  onOpen: (clip: GuestVideoHighlight) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  return (
    <button
      type="button"
      onClick={() => onOpen(clip)}
      onMouseEnter={() => {
        if (!videoRef.current) return
        videoRef.current.currentTime = 0
        void videoRef.current.play().catch(() => {})
      }}
      onMouseLeave={() => {
        if (!videoRef.current) return
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }}
      onFocus={() => {
        if (!videoRef.current) return
        videoRef.current.currentTime = 0
        void videoRef.current.play().catch(() => {})
      }}
      onBlur={() => {
        if (!videoRef.current) return
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }}
      className="group cinematic-card min-h-[19rem] overflow-hidden p-0 text-left transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <video
          ref={videoRef}
          src={clip.videoUrl}
          muted
          playsInline
          preload="metadata"
          loop
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        >
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,17,14,0.92),rgba(24,17,14,0.12)_58%)]" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[#f5e2bf]/30 bg-[rgba(64,44,34,0.68)] px-3 py-1.5 text-[10px] uppercase tracking-[0.26em] text-[#fff7eb] backdrop-blur-sm">
          {clip.badge || 'From your phones'}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/78">
          {clip.trail || clip.guestName}
        </p>
        <h3 className="mt-3 font-display text-[1.8rem] leading-none text-cinematic-primary">
          {clip.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-cinematic-secondary">
          {clip.description}
        </p>
      </div>
    </button>
  )
}

function GuestVideoHighlightModal({
  clip,
  onClose,
}: {
  clip: GuestVideoHighlight | null
  onClose: () => void
}) {
  if (!clip) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(18,12,10,0.82)] p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="cinematic-panel w-full max-w-4xl overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gold-200/14 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-gold-300/82">Guest highlight</p>
              <h3 className="mt-2 font-display text-3xl text-cinematic-primary">{clip.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-200/18 bg-[rgba(255,247,235,0.08)] text-cinematic-primary transition-colors hover:border-gold-300/35 hover:text-gold-300"
              aria-label="Close guest highlight video"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="overflow-hidden rounded-[1.75rem] border border-gold-200/16 bg-black/20">
              <video src={clip.videoUrl} controls autoPlay playsInline className="aspect-video w-full object-cover">
                <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
              </video>
            </div>

            <div className="cinematic-card px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300/82">
                {clip.badge || 'Shared by'}
              </p>
              <p className="mt-4 font-display text-3xl text-cinematic-primary">{clip.guestName}</p>
              <p className="mt-4 text-base leading-7 text-cinematic-secondary">{clip.description}</p>
              <div className="mt-6 rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3">
                <span className="text-[10px] uppercase tracking-[0.28em] text-gold-300/78">Added</span>
                <p className="mt-2 text-cinematic-secondary">
                  {new Date(clip.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function Film() {
  const [chapters, setChapters] = useState<FilmChapter[]>(MAIN_FILM_CHAPTERS_FALLBACK)
  const [isLoadingChapters, setIsLoadingChapters] = useState(true)
  const [activeFamilyFilm, setActiveFamilyFilm] = useState<FamilyFilm | null>(null)
  const [guestHighlights, setGuestHighlights] = useState<GuestVideoHighlight[]>([])
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(true)
  const [activeGuestHighlight, setActiveGuestHighlight] = useState<GuestVideoHighlight | null>(null)
  const [resumeTime, setResumeTime] = useState<number | null>(null)
  const [didFinishMainFilm, setDidFinishMainFilm] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let isActive = true

    loadMainFilmChapters()
      .then((loadedChapters) => {
        if (isActive) {
          setChapters(loadedChapters)
          setIsLoadingChapters(false)
        }
      })
      .catch(() => {
        if (isActive) {
          setIsLoadingChapters(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const syncResume = () => {
      setResumeTime(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY))
    }

    syncResume()
    document.addEventListener('visibilitychange', syncResume)
    window.addEventListener('focus', syncResume)

    return () => {
      document.removeEventListener('visibilitychange', syncResume)
      window.removeEventListener('focus', syncResume)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function fetchGuestHighlights() {
      const highlightsResult = await supabase
        .from('guest_uploads')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(12)

      const data = highlightsResult.data

      if (!isActive || !Array.isArray(data)) {
        setIsLoadingHighlights(false)
        return
      }

      const highlights = (data as GuestUpload[])
        .filter((upload) => Array.isArray(upload.video_urls) && upload.video_urls.length > 0)
        .filter((upload) => upload.video_visibility !== 'archive_only')
        .sort((a, b) => {
          const visibilityScore = (upload: GuestUpload) =>
            upload.video_visibility === 'guest_highlights' || upload.video_visibility === 'featured' ? 1 : 0

          return visibilityScore(b) - visibilityScore(a)
        })
        .slice(0, 6)
        .map((upload, videoIndex) => ({
          id: `${upload.id}-${videoIndex}`,
          uploadId: upload.id,
          guestName: upload.guest_name,
          title: upload.message?.trim() || `A moment from ${upload.guest_name}`,
          description:
            upload.message?.trim() ||
            'A little handheld piece of the day, straight from the room and exactly how it felt to be there.',
          videoUrl: upload.video_urls[0],
          createdAt: upload.created_at,
          badge: 'From your phones',
          trail: upload.memory_trail ? getMemoryTrailById(upload.memory_trail)?.label || 'Guest point of view' : 'Guest point of view',
        }))

      setGuestHighlights(highlights)
    }

    void fetchGuestHighlights()

    return () => {
      isActive = false
      setIsLoadingHighlights(false)
    }
  }, [])

  const clipFromUrl = useMemo(() => {
    const clip = searchParams.get('clip')
    return clip ? familyFilms.find((film) => film.id === clip) ?? null : null
  }, [searchParams])

  const activeParentDance = activeFamilyFilm ?? clipFromUrl

  const scrollToVideo = useCallback(() => {
    document.getElementById('wedding-film-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const jumpToChapter = useCallback((time: number) => {
    scrollToVideo()

    window.setTimeout(() => {
      const video = document.querySelector<HTMLVideoElement>('#wedding-film-player video:not([aria-hidden])')
      if (!video) {
        return
      }

      video.currentTime = time
      const playAttempt = video.play()
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {})
      }
    }, 420)
  }, [scrollToVideo])

  const resumeMainFilm = useCallback(() => {
    if (!resumeTime) {
      scrollToVideo()
      return
    }

    jumpToChapter(resumeTime)
  }, [jumpToChapter, resumeTime, scrollToVideo])

  useEffect(() => {
    const moment = searchParams.get('moment')
    const clip = searchParams.get('clip')

    if (clip) {
      return
    }

    if (!moment) return

    const targetChapter = chapters.find((chapter) => slugifyFilmMoment(chapter.label) === moment)
    if (targetChapter) {
      jumpToChapter(targetChapter.time)
    }
  }, [chapters, jumpToChapter, searchParams])

  useEffect(() => {
    if (searchParams.get('resume') !== '1' || !resumeTime) {
      return
    }

    resumeMainFilm()

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('resume')
      return next
    }, { replace: true })
  }, [resumeMainFilm, resumeTime, searchParams, setSearchParams])

  return (
    <div className="min-h-screen bg-cream-50">
      <FilmSEO />

      <section className="px-4 pb-10 pt-32 sm:pt-36">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            data-testid="film-hero"
            className="editorial-panel px-6 py-8 sm:px-8 sm:py-10 lg:px-10"
          >
            <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-gold-200/30 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blush-200/35 blur-3xl" />

            <div className="relative max-w-3xl">
              <span className="eyebrow-chip">
                <Sparkles className="h-3.5 w-3.5" />
                Our wedding film
              </span>

              <h1 className="mt-6 max-w-3xl text-5xl text-charcoal-900 sm:text-6xl lg:text-7xl">
                The day as it felt, not just as it looked.
              </h1>

              <p className="mt-5 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                Start here if you are only opening one page. This is the full arc of May 10, 2025:
                the nerves, the vows, the speeches, the laughter, and the dance floor blur that still
                feels impossible to forget.
              </p>

              <div className="mt-8">
                <Button onClick={scrollToVideo} size="lg">Watch Now</Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-charcoal-500">
                <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                  Saturday, May 10, 2025
                </span>
                <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                  The Lodge at Indian Lake
                </span>
                <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                  {MAIN_FILM_RUNTIME_LABEL} feature film
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="editorial-panel px-6 py-6 sm:px-8">
              <span className="eyebrow-chip">Meet the family and friends</span>
              <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                The people who held the day together.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                Before you hit play, take a moment to meet the family and friends woven into every
                chapter of the film. It makes the speeches, reactions, and little glances land even harder.
              </p>
            </div>

            <div className="mt-5 editorial-panel px-2 py-4 sm:px-4">
              <FamilyTree />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <div
            id="wedding-video"
            data-testid="film-player-section"
            className="cinematic-panel px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9"
          >
            <div className="grid gap-6">
              <p className="text-sm text-cinematic-muted">
                {MAIN_FILM_RUNTIME_LABEL} feature film
                <span className="mx-2 text-gold-300/55">•</span>
                {chapters.length} chapters
                <span className="mx-2 text-gold-300/55">•</span>
                Captions available
              </p>

              <motion.div
                id="wedding-film-player"
                initial={{ opacity: 0, scale: 0.985 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="scroll-mt-28"
              >
                <VideoPlayer
                  src={getMediaPath('/video/main.mp4')}
                  title="Austin & Jordyn's Wedding"
                  chapters={chapters}
                  poster={MAIN_FILM_POSTER}
                  captionsSrc={getMediaPath('/video/main.vtt')}
                  previewStartTime={44}
                  storageKey={MAIN_FILM_PROGRESS_KEY}
                  onEnded={() => setDidFinishMainFilm(true)}
                  className="aspect-video ring-1 ring-white/10"
                  requireLandscapeOnPhone
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.15 }}
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <h3 className="text-sm uppercase tracking-[0.28em] text-gold-300/82">
                    Chapter guide
                  </h3>
                  <p className="text-sm text-cinematic-muted">
                    Jump back in only when you need a specific section.
                  </p>
                </div>
                {isLoadingChapters ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-20 rounded-xl bg-gold-100/50 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-2 hide-scrollbar">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                      {chapters.map((chapter) => (
                        <button
                          key={chapter.label}
                          type="button"
                          onClick={() => jumpToChapter(chapter.time)}
                          className="group cinematic-card min-h-[4.8rem] cursor-pointer px-3 py-2.5 text-left transition-colors duration-200 hover:border-gold-300/35 hover:bg-white/8 sm:min-h-[5.1rem] sm:px-3.5 sm:py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/72">
                                {formatChapterTime(chapter.time)}
                              </p>
                              <p className="mt-1.5 text-[0.9rem] font-semibold leading-5 text-cinematic-primary sm:text-[0.96rem]">
                                {chapter.label}
                              </p>
                            </div>
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold-300/72 transition-transform duration-200 group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-10 pb-16 sm:pt-12 lg:pt-14">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-6 max-w-3xl sm:mb-7"
            >
              <span className="eyebrow-chip">Parent dances</span>
              <h2 className="mt-4 text-3xl text-charcoal-900 sm:text-4xl">
                Watch the parent dances.
              </h2>
              <p className="mt-3 text-base text-charcoal-600 sm:text-lg">
                These four clips are here on their own so you can go straight to the parent dances whenever you want to revisit them.
              </p>
            </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {familyFilms.map((film, index) => (
              <motion.div
                key={film.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="min-w-0"
              >
                <ParentDanceCard film={film} onOpen={setActiveFamilyFilm} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FilmFeatureSection />

      {guestHighlights.length > 0 && (
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-8 max-w-3xl"
            >
              <span className="eyebrow-chip">
                <Smartphone className="h-3.5 w-3.5" />
                From your phones
              </span>
              <h2 className="mt-5 text-3xl text-charcoal-900 sm:text-4xl">
                Guest angles, if you want the room back from another point of view.
              </h2>
              <p className="mt-4 text-base text-charcoal-600 sm:text-lg">
                These are optional after the main film: quick table laughs, dance-floor blur, and the small in-between clips no single camera can catch from every side.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {memoryTrails.slice(0, 3).map((trail) => (
                  <span
                    key={trail.id}
                    className="rounded-full border border-gold-200/70 bg-white/76 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-gold-700"
                  >
                    {trail.label}
                  </span>
                ))}
              </div>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {isLoadingHighlights ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))
                ) : guestHighlights.length > 0 ? (
                  guestHighlights.map((clip, index) => (
                    <motion.div
                      key={clip.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.07 }}
                    >
                      <GuestVideoHighlightCard clip={clip} onOpen={setActiveGuestHighlight} />
                    </motion.div>
                  ))
                ) : null}
              </div>
          </div>
        </section>
      )}

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="editorial-panel px-6 py-8 sm:px-8 sm:py-10"
          >
            <div className="absolute -right-10 top-8 h-32 w-32 rounded-full bg-gold-200/35 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="eyebrow-chip">{didFinishMainFilm ? 'One last stop' : 'After the film'}</span>
                <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                  {didFinishMainFilm ? 'Choose what to open next.' : 'Where to next'}
                </h2>
                <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                  {didFinishMainFilm
                    ? 'Most guests head to the gallery next. The guestbook stays here as the quieter last step if you still want to leave one thoughtful note.'
                    : 'The next step is usually the gallery. Guest uploads and the guestbook stay here if you want one more pass through the day before you leave.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-[42rem] lg:justify-end">
                <Button
                  size="md"
                  className="min-w-[12.5rem] px-5 py-2.5 sm:min-w-[13rem] sm:px-6"
                  to="/gallery?collection=Wedding+Day"
                >
                  Open Wedding Day Gallery
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  className="min-w-[12rem] px-5 py-2.5 sm:min-w-[12.5rem] sm:px-6"
                  to="/gallery?collection=Guest+Uploads"
                >
                  Browse Guest Uploads
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  className="min-w-[10rem] px-4 py-2.5 sm:min-w-[10.5rem] sm:px-5"
                  to="/guestbook"
                >
                  Leave a Note
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  className="min-w-[10rem] px-4 py-2.5 sm:min-w-[10.5rem] sm:px-5"
                  to="/upload"
                >
                  Share Your Angle
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <ParentDanceModal
        film={activeParentDance}
        onClose={() => {
          setActiveFamilyFilm(null)
          if (searchParams.get('clip')) {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.delete('clip')
              return next
            }, { replace: true })
          }
        }}
      />
      <GuestVideoHighlightModal clip={activeGuestHighlight} onClose={() => setActiveGuestHighlight(null)} />
    </div>
  )
}
