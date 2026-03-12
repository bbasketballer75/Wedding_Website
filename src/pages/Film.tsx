import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FilmSEO } from '@/components/seo/SEOHead'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { FamilyTree } from '@/components/family-tree/FamilyTree'
import { supabase, type GuestUpload } from '@/lib/supabase'
import {
  MAIN_FILM_CHAPTERS_FALLBACK,
  MAIN_FILM_RUNTIME_LABEL,
  familyFilms,
  type FamilyFilm,
  loadMainFilmChapters,
  type FilmChapter,
} from '@/data/film'
import { getMediaPath } from '@/utils/media'
import {
  Play,
  Clock3,
  ArrowDown,
  ArrowRight,
  Sparkles,
  Camera,
  HeartHandshake,
  Smartphone,
  X,
} from 'lucide-react'

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
      className="group cinematic-card relative min-h-[24rem] snap-start overflow-hidden text-left transition-transform duration-300 hover:-translate-y-1"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
        style={{
          backgroundImage: `linear-gradient(to top, rgba(24,17,14,0.9), rgba(24,17,14,0.28) 55%, rgba(255,247,235,0.08)), url(${(isHovering ? previewFrames[activeFrame] : previewFrames[0]) || film.thumbnail})`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,247,235,0.16),transparent_36%)]" />

      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[#f5e2bf]/30 bg-[rgba(64,44,34,0.68)] px-3 py-1.5 text-[10px] uppercase tracking-[0.26em] text-[#fff7eb] backdrop-blur-sm">
        Parent dance
      </div>

      <div className="absolute right-4 top-4 rounded-full border border-[#f5e2bf]/30 bg-[rgba(64,44,34,0.72)] px-3 py-1.5 text-xs font-mono text-[#fff7eb] backdrop-blur-sm">
        {film.duration}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-charcoal-900 shadow-lg transition-transform duration-300 group-hover:scale-105">
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
        </div>
        <h3 className="font-display text-[1.95rem] leading-none text-white">
          {film.label}
        </h3>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#f8efe3]">
          {film.description}
        </p>
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
    if (!film || !videoRef.current) {
      return
    }

    const playAttempt = videoRef.current.play()
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {})
    }
  }, [film])

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

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className="overflow-hidden rounded-[1.75rem] border border-gold-200/16 bg-black/20">
                <video
                  ref={videoRef}
                  src={getMediaPath(film.videoSrc)}
                  controls
                  poster={film.thumbnail}
                  className="aspect-video w-full object-cover"
                >
                  <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
                </video>
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
  guestName: string
  title: string
  description: string
  videoUrl: string
  createdAt: string
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
          From your phones
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/78">{clip.guestName}</p>
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
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300/82">Shared by</p>
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
  const [activeFamilyFilm, setActiveFamilyFilm] = useState<FamilyFilm | null>(null)
  const [guestHighlights, setGuestHighlights] = useState<GuestVideoHighlight[]>([])
  const [activeGuestHighlight, setActiveGuestHighlight] = useState<GuestVideoHighlight | null>(null)

  useEffect(() => {
    let isActive = true

    loadMainFilmChapters()
      .then((loadedChapters) => {
        if (isActive) {
          setChapters(loadedChapters)
        }
      })
      .catch(() => {})

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function fetchGuestHighlights() {
      const { data } = await supabase
        .from('guest_uploads')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(12)

      if (!isActive || !Array.isArray(data)) return

      const highlights = (data as GuestUpload[])
        .filter((upload) => Array.isArray(upload.video_urls) && upload.video_urls.length > 0)
        .slice(0, 6)
        .map((upload, index) => ({
          id: `${upload.id}-${index}`,
          guestName: upload.guest_name,
          title: upload.message?.trim() || `A guest angle from ${upload.guest_name}`,
          description:
            upload.message?.trim() ||
            'A little handheld piece of the day, straight from the room and exactly how it felt to be there.',
          videoUrl: upload.video_urls[0],
          createdAt: upload.created_at,
        }))

      setGuestHighlights(highlights)
    }

    void fetchGuestHighlights()

    return () => {
      isActive = false
    }
  }, [])

  const scrollToVideo = () => {
    document.getElementById('wedding-film-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const jumpToChapter = (time: number) => {
    scrollToVideo()

    window.setTimeout(() => {
      const video = document.querySelector<HTMLVideoElement>('#wedding-film-player video')
      if (!video) {
        return
      }

      video.currentTime = time
      const playAttempt = video.play()
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {})
      }
    }, 420)
  }

  const filmHighlights = [
    {
      icon: Clock3,
      title: `${MAIN_FILM_RUNTIME_LABEL} feature`,
      description: 'From the first nervous seconds to the last blur of the dance floor, uninterrupted.',
    },
    {
      icon: Camera,
      title: 'Track-synced chapters',
      description: 'Every chapter jump lands on the real beat of the edit, not an approximation.',
    },
    {
      icon: HeartHandshake,
      title: 'Parent dances',
      description: 'A quieter second spotlight for the dances that made the whole room soften.',
    },
  ] as const

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

            <div className="relative">
              <div className="max-w-3xl">
                <span className="eyebrow-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  Our wedding film
                </span>

                <h1 className="mt-6 max-w-3xl text-5xl text-charcoal-900 sm:text-6xl lg:text-7xl">
                  The day as it felt, not just as it looked.
                </h1>

                <p className="mt-5 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                  This is the full arc of May 10, 2025: the nerves, the vows, the speeches,
                  the laughter, and the dance floor blur that still feels impossible to forget.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-charcoal-500">
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

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={scrollToVideo}>
                    Watch Now
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="secondary" to="/upload">
                    Share Your Angle
                  </Button>
                </div>
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {filmHighlights.map(({ icon: Icon, title, description }, index) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12 + index * 0.08 }}
                    className="editorial-card px-4 py-4 sm:px-5 sm:py-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gold-200/70 bg-gold-50 text-gold-600">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-charcoal-900 sm:text-xl">
                      {title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-charcoal-500">
                      {description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="editorial-panel px-6 py-6 sm:px-8"
          >
            <div>
              <span className="eyebrow-chip">Meet the family and friends</span>
              <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                The people who held the day together.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                Before you hit play, take a moment to meet the family and friends woven into every
                chapter of the film. It makes the speeches, reactions, and little glances land even harder.
              </p>
            </div>
          </motion.div>

          <div className="editorial-panel px-2 py-4 sm:px-4">
            <FamilyTree />
          </div>
        </div>
      </section>

      <section id="wedding-video" className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <div
            data-testid="film-player-section"
            className="cinematic-panel px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9"
          >
            <div className="grid gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="cinematic-chip">
                  <Play className="h-3.5 w-3.5" />
                  Feature presentation
                </span>
                <h2 className="mt-5 max-w-3xl text-4xl leading-[0.95] text-cinematic-primary sm:text-5xl">
                  Press play on the whole day.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-cinematic-secondary sm:text-lg">
                  Watch it straight through or use the chapter jumps below to revisit a single moment
                  without losing the cinematic feel of the full cut.
                </p>

                <div className="mt-5 grid gap-2.5 md:grid-cols-3">
                  <div className="cinematic-card px-3.5 py-3.5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/80">Runtime</p>
                    <p className="mt-2 font-display text-[1.35rem] leading-none text-cinematic-primary sm:text-[1.5rem]">{MAIN_FILM_RUNTIME_LABEL}</p>
                    <p className="mt-2 text-sm leading-5 text-cinematic-secondary">The whole day, kept intact.</p>
                  </div>
                  <div className="cinematic-card px-3.5 py-3.5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/80">Chapters</p>
                    <p className="mt-2 font-display text-[1.35rem] leading-none text-cinematic-primary sm:text-[1.5rem]">{chapters.length}</p>
                    <p className="mt-2 text-sm leading-5 text-cinematic-secondary">Every jump mapped from the real chapter track.</p>
                  </div>
                  <div className="cinematic-card px-3.5 py-3.5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/80">Best viewed</p>
                    <p className="mt-2 font-display text-[1.35rem] leading-none text-cinematic-primary sm:text-[1.5rem]">With sound</p>
                    <p className="mt-2 text-sm leading-5 text-cinematic-secondary">For the vows, speeches, and little laughs in between.</p>
                  </div>
                </div>
              </motion.div>

            <motion.div
              id="wedding-film-player"
              initial={{ opacity: 0, scale: 0.985 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 scroll-mt-28"
            >
              <VideoPlayer
                src={getMediaPath('/video/main.mp4')}
                title="Austin & Jordyn's Wedding"
                chapters={chapters}
                poster={MAIN_FILM_POSTER}
                className="aspect-video ring-1 ring-white/10"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="mt-7"
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <h3 className="text-sm uppercase tracking-[0.28em] text-gold-300/82">
                  Jump to a moment
                </h3>
                <p className="text-sm text-cinematic-muted">
                  Click a chapter and the player will jump there.
                </p>
              </div>
              <div className="overflow-x-auto pb-2 hide-scrollbar">
                <div className="grid grid-flow-col grid-rows-2 gap-2.5 auto-cols-[minmax(8.1rem,1fr)] sm:auto-cols-[minmax(9rem,1fr)] lg:auto-cols-[minmax(10.5rem,1fr)]">
                {chapters.map((chapter) => (
                  <button
                    key={chapter.label}
                    type="button"
                    onClick={() => jumpToChapter(chapter.time)}
                    className="group cinematic-card min-h-[4.8rem] px-3 py-2.5 text-left transition-colors duration-200 hover:border-gold-300/35 hover:bg-white/8 sm:min-h-[5.1rem] sm:px-3.5 sm:py-3"
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
            </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-8 max-w-3xl"
          >
            <span className="eyebrow-chip">Parent dances</span>
            <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
              Four quieter moments that deserve their own replay.
            </h2>
            <p className="mt-4 text-base text-charcoal-600 sm:text-lg">
              These dances are some of the most personal pauses in the whole reception. Hover to let the cards
              breathe a little, then open any one of them for the full moment.
            </p>
          </motion.div>

          <div className="overflow-x-auto pb-2 hide-scrollbar">
            <div className="grid grid-flow-col auto-cols-[minmax(17rem,1fr)] gap-4 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4">
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
        </div>
      </section>

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
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
              <div>
                <span className="eyebrow-chip">Keep the archive growing</span>
                <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                  Have your own angle from the day?
                </h2>
                <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                  Add the clips, candids, and dance floor moments only your phone caught so the
                  story feels complete from every side of the room.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button size="lg" to="/upload">
                  Share Your Memories
                </Button>
                <Button size="lg" variant="secondary" to="/gallery">
                  Browse the Gallery
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

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
              <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                Small clips from the room that make the day feel alive again.
              </h2>
              <p className="mt-4 text-base text-charcoal-600 sm:text-lg">
                These are the quick guest angles that fill in the edges: the table laughs, the dance-floor blur, and
                the little in-between pieces no feature camera can catch from every side of the room.
              </p>
            </motion.div>

            <div className="overflow-x-auto pb-2 hide-scrollbar">
              <div className="grid grid-flow-col auto-cols-[minmax(16rem,1fr)] gap-4">
                {guestHighlights.map((clip) => (
                  <GuestVideoHighlightCard key={clip.id} clip={clip} onOpen={setActiveGuestHighlight} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <ParentDanceModal film={activeFamilyFilm} onClose={() => setActiveFamilyFilm(null)} />
      <GuestVideoHighlightModal clip={activeGuestHighlight} onClose={() => setActiveGuestHighlight(null)} />
    </div>
  )
}
