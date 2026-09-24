import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
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
import { ArrowRight, Sparkles, Smartphone } from 'lucide-react'
import { MAIN_FILM_PROGRESS_KEY, readSavedVideoProgress } from '@/utils/videoProgress'
import { ParentDanceCard, ParentDanceModal } from './film/ParentDance'
import {
  GuestVideoHighlight,
  GuestVideoHighlightCard,
  GuestVideoHighlightModal,
} from './film/GuestVideoHighlight'

const MAIN_FILM_POSTER = '/images/film/main-film-poster.png'

function formatChapterTime(totalSeconds: number) {
  const wholeSeconds = Math.floor(totalSeconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
      .then(loadedChapters => {
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
        .filter(upload => Array.isArray(upload.video_urls) && upload.video_urls.length > 0)
        .filter(upload => upload.video_visibility !== 'archive_only')
        .sort((a, b) => {
          const visibilityScore = (upload: GuestUpload) =>
            upload.video_visibility === 'guest_highlights' || upload.video_visibility === 'featured'
              ? 1
              : 0

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
          trail: upload.memory_trail
            ? getMemoryTrailById(upload.memory_trail)?.label || 'Guest point of view'
            : 'Guest point of view',
        }))

      setGuestHighlights(highlights)
      setIsLoadingHighlights(false)
    }

    void fetchGuestHighlights()

    return () => {
      isActive = false
      setIsLoadingHighlights(false)
    }
  }, [])

  const clipFromUrl = useMemo(() => {
    const clip = searchParams.get('clip')
    return clip ? (familyFilms.find(film => film.id === clip) ?? null) : null
  }, [searchParams])

  const activeParentDance = activeFamilyFilm ?? clipFromUrl

  const scrollToVideo = useCallback(() => {
    document
      .getElementById('wedding-film-player')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const jumpToChapter = useCallback(
    (time: number) => {
      scrollToVideo()

      window.setTimeout(() => {
        const video = document.querySelector<HTMLVideoElement>(
          '#wedding-film-player video:not([aria-hidden])'
        )
        if (!video) {
          return
        }

        video.currentTime = time
        const playAttempt = video.play()
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(() => {})
        }
      }, 420)
    },
    [scrollToVideo]
  )

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

    const targetChapter = chapters.find(chapter => slugifyFilmMoment(chapter.label) === moment)
    if (targetChapter) {
      jumpToChapter(targetChapter.time)
    }
  }, [chapters, jumpToChapter, searchParams])

  useEffect(() => {
    if (searchParams.get('resume') !== '1' || !resumeTime) {
      return
    }

    resumeMainFilm()

    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('resume')
        return next
      },
      { replace: true }
    )
  }, [resumeMainFilm, resumeTime, searchParams, setSearchParams])

  return (
    <div className='min-h-screen bg-cream-50'>
      <FilmSEO />

      <section className='px-4 pb-10 pt-32 sm:pt-36'>
        <div className='mx-auto max-w-6xl'>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            data-testid='film-hero'
            className='editorial-panel px-6 py-8 sm:px-8 sm:py-10 lg:px-10'
          >
            <div className='absolute -right-16 top-8 h-44 w-44 rounded-full bg-gold-200/30 blur-3xl' />
            <div className='absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blush-200/35 blur-3xl' />

            <div className='relative max-w-3xl'>
              <span className='eyebrow-chip'>
                <Sparkles className='h-3.5 w-3.5' />
                Our wedding film
              </span>

              <h1 className='mt-6 max-w-3xl text-5xl text-charcoal-900 sm:text-6xl lg:text-7xl'>
                The day as it felt, not just as it looked.
              </h1>

              <p className='mt-5 max-w-2xl text-base text-charcoal-600 sm:text-lg'>
                Start here if you are only opening one page. This is the full arc of May 10, 2025:
                the nerves, the vows, the speeches, the laughter, and the dance floor blur that
                still feels impossible to forget.
              </p>

              <div className='mt-8'>
                <Button onClick={scrollToVideo} size='lg'>
                  Watch Now
                </Button>
              </div>

              <div className='mt-6 flex flex-wrap items-center gap-3 text-sm text-charcoal-500'>
                <span className='rounded-full border border-white/80 bg-white/78 px-4 py-2'>
                  Saturday, May 10, 2025
                </span>
                <span className='rounded-full border border-white/80 bg-white/78 px-4 py-2'>
                  The Lodge at Indian Lake
                </span>
                <span className='rounded-full border border-white/80 bg-white/78 px-4 py-2'>
                  {MAIN_FILM_RUNTIME_LABEL} feature film
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className='px-4 pb-10'>
        <div className='mx-auto max-w-6xl'>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6 }}
          >
            <div className='editorial-panel px-6 py-6 sm:px-8'>
              <span className='eyebrow-chip'>Meet the family and friends</span>
              <h2 className='mt-5 text-4xl text-charcoal-900 sm:text-5xl'>
                The people who held the day together.
              </h2>
              <p className='mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg'>
                Before you hit play, take a moment to meet the family and friends woven into every
                chapter of the film. It makes the speeches, reactions, and little glances land even
                harder.
              </p>
            </div>

            <div className='mt-5 editorial-panel px-2 py-4 sm:px-4'>
              <FamilyTree />
            </div>
          </motion.div>
        </div>
      </section>

      <section className='px-4 pb-16'>
        <div className='mx-auto max-w-6xl'>
          <div
            id='wedding-video'
            data-testid='film-player-section'
            className='cinematic-panel px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9'
          >
            <div className='grid gap-6'>
              <p className='text-sm text-cinematic-muted'>
                {MAIN_FILM_RUNTIME_LABEL} feature film
                <span className='mx-2 text-gold-300/55'>•</span>
                {chapters.length} chapters
                <span className='mx-2 text-gold-300/55'>•</span>
                Captions available
              </p>

              <motion.div
                id='wedding-film-player'
                initial={{ opacity: 0, scale: 0.985 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className='scroll-mt-28'
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
                  className='aspect-video ring-1 ring-white/10'
                  requireLandscapeOnPhone
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.15 }}
              >
                <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
                  <h3 className='text-sm uppercase tracking-[0.28em] text-gold-300/82'>
                    Chapter guide
                  </h3>
                  <p className='text-sm text-cinematic-muted'>
                    Jump back in only when you need a specific section.
                  </p>
                </div>
                {isLoadingChapters ? (
                  <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5'>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className='h-20 rounded-xl bg-gold-100/50 animate-pulse' />
                    ))}
                  </div>
                ) : (
                  <div className='overflow-x-auto pb-2 hide-scrollbar'>
                    <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'>
                      {chapters.map(chapter => (
                        <button
                          key={chapter.label}
                          type='button'
                          onClick={() => jumpToChapter(chapter.time)}
                          className='group cinematic-card min-h-[4.8rem] cursor-pointer px-3 py-2.5 text-left transition-colors duration-200 hover:border-gold-300/35 hover:bg-white/8 sm:min-h-[5.1rem] sm:px-3.5 sm:py-3'
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <p className='text-[10px] uppercase tracking-[0.28em] text-gold-300/72'>
                                {formatChapterTime(chapter.time)}
                              </p>
                              <p className='mt-1.5 text-[0.9rem] font-semibold leading-5 text-cinematic-primary sm:text-[0.96rem]'>
                                {chapter.label}
                              </p>
                            </div>
                            <ArrowRight className='mt-0.5 h-4 w-4 shrink-0 text-gold-300/72 transition-transform duration-200 group-hover:translate-x-0.5' />
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

      <section className='px-4 pt-10 pb-16 sm:pt-12 lg:pt-14'>
        <div className='mx-auto max-w-6xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className='mb-6 max-w-3xl sm:mb-7'
          >
            <span className='eyebrow-chip'>Parent dances</span>
            <h2 className='mt-4 text-3xl text-charcoal-900 sm:text-4xl'>
              Watch the parent dances.
            </h2>
            <p className='mt-3 text-base text-charcoal-600 sm:text-lg'>
              These four clips are here on their own so you can go straight to the parent dances
              whenever you want to revisit them.
            </p>
          </motion.div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {familyFilms.map((film, index) => (
              <motion.div
                key={film.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className='min-w-0'
              >
                <ParentDanceCard film={film} onOpen={setActiveFamilyFilm} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FilmFeatureSection />

      {guestHighlights.length > 0 && (
        <section className='px-4 pb-16'>
          <div className='mx-auto max-w-6xl'>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className='mb-8 max-w-3xl'
            >
              <span className='eyebrow-chip'>
                <Smartphone className='h-3.5 w-3.5' />
                From your phones
              </span>
              <h2 className='mt-5 text-3xl text-charcoal-900 sm:text-4xl'>
                Guest angles, if you want the room back from another point of view.
              </h2>
              <p className='mt-4 text-base text-charcoal-600 sm:text-lg'>
                These are optional after the main film: quick table laughs, dance-floor blur, and
                the small in-between clips no single camera can catch from every side.
              </p>
              <div className='mt-5 flex flex-wrap gap-2'>
                {memoryTrails.slice(0, 3).map(trail => (
                  <span
                    key={trail.id}
                    className='rounded-full border border-gold-200/70 bg-white/76 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-gold-700'
                  >
                    {trail.label}
                  </span>
                ))}
              </div>
            </motion.div>

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {isLoadingHighlights
                ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
                : guestHighlights.length > 0
                  ? guestHighlights.map((clip, index) => (
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
                  : null}
            </div>
          </div>
        </section>
      )}

      <section className='px-4 pb-20'>
        <div className='mx-auto max-w-5xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className='editorial-panel px-6 py-8 sm:px-8 sm:py-10'
          >
            <div className='absolute -right-10 top-8 h-32 w-32 rounded-full bg-gold-200/35 blur-3xl' />
            <div className='relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
              <div>
                <span className='eyebrow-chip'>
                  {didFinishMainFilm ? 'One last stop' : 'After the film'}
                </span>
                <h2 className='mt-5 text-4xl text-charcoal-900 sm:text-5xl'>
                  {didFinishMainFilm ? 'Choose what to open next.' : 'Where to next'}
                </h2>
                <p className='mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg'>
                  {didFinishMainFilm
                    ? 'Most guests head to the gallery next. The guestbook stays here as the quieter last step if you still want to leave one thoughtful note.'
                    : 'The next step is usually the gallery. Guest uploads and the guestbook stay here if you want one more pass through the day before you leave.'}
                </p>
              </div>

              <div className='flex flex-wrap gap-3 lg:max-w-[42rem] lg:justify-end'>
                <Button
                  size='md'
                  className='min-w-[12.5rem] px-5 py-2.5 sm:min-w-[13rem] sm:px-6'
                  to='/gallery?collection=Wedding+Day'
                >
                  Open Wedding Day Gallery
                </Button>
                <Button
                  size='md'
                  variant='secondary'
                  className='min-w-[12rem] px-5 py-2.5 sm:min-w-[12.5rem] sm:px-6'
                  to='/gallery?collection=Guest+Uploads'
                >
                  Browse Guest Uploads
                </Button>
                <Button
                  size='md'
                  variant='ghost'
                  className='min-w-[10rem] px-4 py-2.5 sm:min-w-[10.5rem] sm:px-5'
                  to='/guestbook'
                >
                  Leave a Note
                </Button>
                <Button
                  size='md'
                  variant='ghost'
                  className='min-w-[10rem] px-4 py-2.5 sm:min-w-[10.5rem] sm:px-5'
                  to='/upload'
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
            setSearchParams(
              prev => {
                const next = new URLSearchParams(prev)
                next.delete('clip')
                return next
              },
              { replace: true }
            )
          }
        }}
      />
      <GuestVideoHighlightModal
        clip={activeGuestHighlight}
        onClose={() => setActiveGuestHighlight(null)}
      />
    </div>
  )
}
