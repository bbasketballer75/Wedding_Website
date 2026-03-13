import { type ElementType, useState, useEffect, useMemo, useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Heart, ChevronDown, Sparkles, Clock3, Rows3, Images, BookHeart, ArrowRight, MessageCircleHeart, Smartphone } from 'lucide-react'
import { LoveTimeline } from '@/components/timeline/LoveTimeline'
import { publicNavLinks } from '@/components/layout/publicNav'
import Search from '@/components/search/Search'
import { HomeSEO } from '@/components/seo/SEOHead'
import { MAIN_FILM_CHAPTERS_FALLBACK, MAIN_FILM_RUNTIME_LABEL, filmWatchPaths, loadMainFilmChapters, slugifyFilmMoment } from '@/data/film'
import { CURATED_GALLERY_PHOTO_COUNT } from '@/data/gallery'
import { getMemoryTrailById, memoryTrails } from '@/data/memoryTrails'
import { fetchSiteEditorialFeatures, supabase, type GuestUpload, type GuestbookMessage, type SiteEditorialFeature, type SiteEditorialFeatureSlot } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'

const HERO_POSTER = '/images/home/intro-video-poster.png'
const HERO_VIDEO = getMediaPath('/video/edited_background_cut.mp4')

interface HomeStat {
  icon: ElementType
  number: string
  label: string
  detail: string
}

interface HomeReturnCard {
  id: string
  eyebrow: string
  title: string
  summary: string
  href: string
  badge: string
  icon: ElementType
}

function getFeatureTrailLabel(feature: SiteEditorialFeature | null | undefined, fallback: string) {
  if (feature?.memory_trail) {
    return getMemoryTrailById(feature.memory_trail)?.label || feature.trail || fallback
  }

  return feature?.trail || fallback
}

const DEFAULT_HOME_STATS: HomeStat[] = [
  {
    icon: Clock3,
    number: MAIN_FILM_RUNTIME_LABEL,
    label: 'Feature film',
    detail: 'The full ceremony-to-dance-floor cut, all in one watch.',
  },
  {
    icon: Rows3,
    number: MAIN_FILM_CHAPTERS_FALLBACK.length.toString(),
    label: 'Chapter jumps',
    detail: 'Mapped to the real edit so every moment starts exactly where it should.',
  },
  {
    icon: Images,
    number: '0',
    label: 'Gallery photos',
    detail: 'Approved portraits, candids, and guest favorites gathered in one archive.',
  },
  {
    icon: BookHeart,
    number: '0',
    label: 'Guestbook notes',
    detail: 'Messages from the people who were there and still want to tell it back to us.',
  },
]

// Nav item component
function NavItem({ 
  to, 
  icon: Icon, 
  label, 
  mobileLabel,
  isPrimary = false,
  scrolled = false
}: { 
  to: string
  icon: ElementType
  label: string
  mobileLabel?: string
  isPrimary?: boolean
  scrolled?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-[9px] font-medium leading-none uppercase tracking-[0.16em] transition-all duration-300 max-[360px]:gap-0 max-[360px]:px-1.5 max-[360px]:text-[8px] max-[360px]:tracking-[0.12em] min-[430px]:px-2.5 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-[0.24em]",
        isPrimary 
          ? scrolled ? "text-gold-500 hover:text-gold-600 font-medium" : "text-gold-300 hover:text-candle-100 font-medium"
          : scrolled ? "text-charcoal-700 hover:text-charcoal-900 hover:bg-charcoal-100" : "text-[#f7efe3] hover:text-[#fff7eb] hover:bg-white/10"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 max-[360px]:h-3 max-[360px]:w-3 sm:h-4 sm:w-4", isPrimary && !scrolled && "fill-gold-400/20")} />
      <span className="max-[360px]:hidden sm:hidden">{mobileLabel ?? label}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

export default function Home() {
  const [showUI, setShowUI] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoErrored, setVideoErrored] = useState(false)
  const [homeStats, setHomeStats] = useState<HomeStat[]>(DEFAULT_HOME_STATS)
  const [editorialFeatures, setEditorialFeatures] = useState<Partial<Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>>>({})
  const [newestUpload, setNewestUpload] = useState<GuestUpload | null>(null)
  const [newestGuestbookNote, setNewestGuestbookNote] = useState<GuestbookMessage | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 260, 860], [1, 1, 0])
  const heroScale = useTransform(scrollY, [0, 860], [1, 1.08])
  
  // Track scroll position for section transitions
  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 100)
  })

  useEffect(() => {
    const timer = setTimeout(() => setShowUI(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadHomeStats = async () => {
      const [chaptersResult, photoCountResult, guestbookCountResult, featuresResult, uploadResult, noteResult] = await Promise.allSettled([
        loadMainFilmChapters(),
        supabase.from('photos').select('id', { count: 'exact', head: true }),
        supabase.from('guestbook_messages').select('id', { count: 'exact', head: true }),
        fetchSiteEditorialFeatures(),
        supabase.from('guest_uploads').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('guestbook_messages').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      if (!isMounted) {
        return
      }

      const chapterCount =
        chaptersResult.status === 'fulfilled'
          ? chaptersResult.value.length
          : MAIN_FILM_CHAPTERS_FALLBACK.length

      const livePhotoCount =
        photoCountResult.status === 'fulfilled'
          ? photoCountResult.value.count ?? 0
          : 0
      const photoCount = CURATED_GALLERY_PHOTO_COUNT + livePhotoCount

      const guestbookCount =
        guestbookCountResult.status === 'fulfilled'
          ? guestbookCountResult.value.count ?? 0
          : 0

      const features =
        featuresResult.status === 'fulfilled' && Array.isArray(featuresResult.value.data)
          ? (featuresResult.value.data as SiteEditorialFeature[])
          : []

      const featuresBySlot = features.reduce<Partial<Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>>>(
        (acc, feature) => {
          acc[feature.slot] = feature
          return acc
        },
        {}
      )

      const upload =
        uploadResult.status === 'fulfilled'
          ? ((uploadResult.value.data as GuestUpload | null) ?? null)
          : null

      const newestNote =
        noteResult.status === 'fulfilled'
          ? ((noteResult.value.data as GuestbookMessage | null) ?? null)
          : null

      setHomeStats([
        DEFAULT_HOME_STATS[0],
        {
          ...DEFAULT_HOME_STATS[1],
          number: chapterCount.toString(),
        },
        {
          ...DEFAULT_HOME_STATS[2],
          number: photoCount.toString(),
          detail:
            photoCount > 0
              ? 'Curated portraits, approved guest favorites, and the in-between shots all gathered in one archive.'
              : 'The archive is ready for the first approved moments to land.',
        },
        {
          ...DEFAULT_HOME_STATS[3],
          number: guestbookCount.toString(),
          detail:
            guestbookCount > 0
              ? 'Messages from the people who were there and still want to tell it back to us.'
              : 'A clean slate for the first note, memory, or blessing from our guests.',
        },
      ])
      setEditorialFeatures(featuresBySlot)
      setNewestUpload(upload)
      setNewestGuestbookNote(newestNote)
    }

    void loadHomeStats()

    return () => {
      isMounted = false
    }
  }, [])

  const homeStatsColumn = useMemo(() => homeStats, [homeStats])

  const filmFallbackPath = useMemo(() => {
    const familyPath = filmWatchPaths.find((path) => path.id === 'family-moments')
    return familyPath?.momentSlug
      ? `/film?moment=${familyPath.momentSlug}`
      : '/film'
  }, [])

  const momentOfWeekFeature = editorialFeatures.home_moment_of_the_week

  const returnVisitCards = useMemo<HomeReturnCard[]>(() => {
    const uploadFeature = editorialFeatures.home_newest_standout_upload
    const guestbookFeature = editorialFeatures.home_featured_guestbook_note

    const uploadCard: HomeReturnCard = uploadFeature?.is_active
      ? {
          id: 'upload-feature',
          eyebrow: getFeatureTrailLabel(uploadFeature, 'Now unfolding'),
          title: uploadFeature.title,
          summary:
            uploadFeature.summary ||
            'A newly approved angle from the room, ready to become part of the archive.',
          href:
            uploadFeature.source_url ||
            '/gallery?collection=Guest%20Uploads',
          badge: uploadFeature.badge_label || uploadFeature.source_label || 'Guest upload',
          icon: Smartphone,
        }
      : {
          id: 'upload-latest',
          eyebrow: 'Now unfolding',
          title: newestUpload?.message?.trim() || `Newest guest upload from ${newestUpload?.guest_name || 'your side of the room'}`,
          summary:
            newestUpload
              ? `${newestUpload.guest_name} just added a new point-of-view angle for the archive.`
              : 'The next approved guest upload will appear here once a new angle is ready to share.',
          href: '/gallery?collection=Guest%20Uploads',
          badge: newestUpload ? 'Guest upload' : 'Waiting for the next moment',
          icon: Smartphone,
        }

    const guestbookCard: HomeReturnCard = guestbookFeature?.is_active
      ? {
          id: 'guestbook-feature',
          eyebrow: getFeatureTrailLabel(guestbookFeature, 'Keepsake note'),
          title: guestbookFeature.title,
          summary:
            guestbookFeature.summary ||
            'A highlighted note from the guestbook, saved because it says something we know we will reread.',
          href:
            guestbookFeature.source_url ||
            (guestbookFeature.source_id ? `/guestbook?message=${guestbookFeature.source_id}` : '/guestbook'),
          badge: guestbookFeature.badge_label || guestbookFeature.source_label || 'Featured note',
          icon: MessageCircleHeart,
        }
      : {
          id: 'guestbook-latest',
          eyebrow: 'Keepsake note',
          title: newestGuestbookNote?.name || 'The next note we will reread',
          summary:
            newestGuestbookNote?.content ||
            'When the next guestbook message lands, it will show up here as a reason to come back and revisit the day.',
          href: newestGuestbookNote ? `/guestbook?message=${newestGuestbookNote.id}` : '/guestbook',
          badge: newestGuestbookNote ? 'Guestbook' : 'Open guestbook',
          icon: MessageCircleHeart,
        }

    const filmCard: HomeReturnCard =
      momentOfWeekFeature?.is_active && momentOfWeekFeature.source_type === 'film_chapter'
        ? {
            id: 'film-feature',
            eyebrow: getFeatureTrailLabel(momentOfWeekFeature, 'Featured moment'),
            title: momentOfWeekFeature.title,
            summary:
              momentOfWeekFeature.summary ||
              'A chapter to jump straight into when you want the feeling of the room back quickly.',
            href:
              momentOfWeekFeature.source_url ||
              `/film?moment=${slugifyFilmMoment(
                momentOfWeekFeature.source_id || momentOfWeekFeature.source_label || momentOfWeekFeature.title
              )}`,
            badge: momentOfWeekFeature.badge_label || momentOfWeekFeature.source_label || 'Film moment',
            icon: Sparkles,
          }
        : {
            id: 'film-default',
            eyebrow: 'Re-enter the film',
            title: 'A chapter worth revisiting this week',
            summary: 'Jump back into the vows, speeches, or family moments without restarting the entire feature.',
            href: filmFallbackPath,
            badge: 'Watch path',
            icon: Sparkles,
          }

    return [uploadCard, guestbookCard, filmCard]
  }, [editorialFeatures.home_featured_guestbook_note, editorialFeatures.home_newest_standout_upload, filmFallbackPath, momentOfWeekFeature, newestGuestbookNote, newestUpload])

  const memoryTrailLinks = useMemo(() => memoryTrails.slice(0, 5), [])

  const momentOfTheWeek = useMemo(() => {
    const feature = editorialFeatures.home_moment_of_the_week

    if (feature?.is_active) {
      return {
        eyebrow: getFeatureTrailLabel(feature, 'Moment of the week'),
        title: feature.title,
        summary:
          feature.summary ||
          'A curated invitation back into one piece of the story that feels worth revisiting right now.',
        href:
          feature.source_url ||
          (feature.source_type === 'film_chapter'
            ? `/film?moment=${slugifyFilmMoment(feature.source_id || feature.source_label || feature.title)}`
            : '/film'),
        badge: feature.badge_label || feature.source_label || 'Editorial pick',
      }
    }

    return {
      eyebrow: 'Moment of the week',
      title: 'Family moments worth another watch',
      summary:
        'Start with the family watch path when you want something emotional, intimate, and easy to re-enter without committing to the full feature.',
      href: filmFallbackPath,
      badge: 'Editorial fallback',
    }
  }, [editorialFeatures.home_moment_of_the_week, filmFallbackPath])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const attemptPlayback = () => {
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')

      const playback = video.play()
      if (playback && typeof playback.catch === 'function') {
        playback.catch(() => {})
      }
    }

    attemptPlayback()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        attemptPlayback()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const scrollToContent = () => {
    document.getElementById('welcome-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-cream-50">
      <HomeSEO />

      {/* Sticky Nav Bar - Always Visible */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : -20 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        data-testid="home-nav"
        className="fixed top-3 left-1/2 z-50 w-[calc(100vw-1rem)] max-w-[42rem] -translate-x-1/2 sm:top-6"
      >
        <motion.div 
          className={cn(
            "flex w-full items-center gap-1 overflow-x-auto rounded-full px-2 py-1.5 transition-all duration-500 hide-scrollbar max-[360px]:px-1.5 sm:justify-between sm:gap-0 sm:px-2 sm:py-2",
            scrolled 
              ? "bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 backdrop-blur-md border border-gold-300/50 shadow-lg" 
              : "bg-[linear-gradient(135deg,rgba(41,29,23,0.9),rgba(58,42,33,0.9))] backdrop-blur-md border border-gold-200/18 shadow-2xl"
          )}
        >
          {/* Logo */}
          <Link 
            to="/" 
            className={cn(
              "shrink-0 px-3 py-2 font-display text-lg transition-colors max-[360px]:px-2.5 max-[360px]:text-base sm:px-4 sm:text-xl",
              scrolled ? "text-charcoal-900 hover:text-gold-600" : "text-[#fff7eb] hover:text-gold-300"
            )}
          >
            <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
          </Link>
          
          <div className={cn("hidden h-5 w-px sm:block", scrolled ? "bg-charcoal-200" : "bg-gold-200/18")} />
          
          {publicNavLinks.map((item, index) => (
            <div key={item.path} className="contents">
              {index > 0 && (
                <div className={cn("hidden h-5 w-px sm:block", scrolled ? "bg-charcoal-200" : "bg-gold-200/18")} />
              )}
              <NavItem
                to={item.path}
                icon={item.icon}
                label={item.label}
                mobileLabel={item.mobileLabel}
                isPrimary={item.isPrimary}
                scrolled={scrolled}
              />
            </div>
          ))}
        </motion.div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} data-testid="home-hero" className="relative min-h-[100svh] w-full overflow-hidden md:min-h-screen">
        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="absolute inset-0"
        >
          <img
            src={HERO_POSTER}
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-[1.02] object-cover object-[58%_center] sm:scale-100 sm:object-center"
          />
        </motion.div>

        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="absolute inset-0"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={HERO_POSTER}
            onCanPlay={() => setVideoReady(true)}
            onCanPlayThrough={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onError={() => setVideoErrored(true)}
            className={cn(
              "h-full w-full transition-opacity duration-700",
              "object-cover object-[58%_center] sm:object-center",
              videoReady && !videoErrored ? "opacity-100" : "opacity-0"
            )}
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        </motion.div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(to_bottom,rgba(21,20,19,0.26),rgba(21,20,19,0.12)_35%,rgba(21,20,19,0.48))]" />

        {/* Explore Button - Fixed at bottom of hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ opacity: heroOpacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.button
            onClick={scrollToContent}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-full border border-gold-200/18 bg-[linear-gradient(135deg,rgba(41,29,23,0.92),rgba(58,42,33,0.92))] px-5 py-2.5 text-[#f7efe3] shadow-xl transition-colors hover:text-gold-300"
          >
            <span className="text-[10px] uppercase tracking-widest">Explore</span>
            <motion.div
              animate={{ y: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </motion.button>
        </motion.div>
      </section>

      {/* Welcome Section - Editorial landing panel */}
      <section id="content" className="relative overflow-hidden px-4 pb-24 pt-16 sm:pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-cream-50 via-cream-100 to-cream-50" />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-10 right-0 h-72 w-72 rounded-full bg-gold-200/30 blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -40, 0],
              y: [0, 40, 0],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blush-200/35 blur-3xl"
          />
          {[...Array(2)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 0.05, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.25, duration: 0.8 }}
              className="absolute text-gold-500"
              style={{
                left: `${10 + i * 68}%`,
                top: `${12 + i * 42}%`,
              }}
            >
              <Heart className="h-24 w-24 fill-current" />
            </motion.div>
          ))}
        </div>

        <motion.div
          id="welcome-panel"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 mx-auto max-w-6xl scroll-mt-24 sm:scroll-mt-28"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(250,248,244,0.98)_58%,rgba(246,239,226,0.92))] p-6 shadow-[0_35px_90px_-45px_rgba(46,33,13,0.45)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="absolute -right-14 top-8 h-40 w-40 rounded-full bg-gold-200/35 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blush-200/45 blur-3xl" />

            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-start">
              <div className="max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                  className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/60 bg-white/75 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-gold-700 shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Welcome to our wedding hub
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: 0.1 }}
                  className="max-w-xl text-[2.8rem] leading-[0.96] tracking-[-0.035em] text-charcoal-900 sm:text-[4.1rem]"
                >
                  Every chapter, all in one place.
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: 0.18 }}
                  className="mt-5 max-w-xl text-base leading-8 text-charcoal-700 sm:text-[1.15rem]"
                >
                  Relive every part of the celebration from whichever doorway feels right:
                  the full film, the portrait gallery, the notes from everyone we love, and
                  the photos still coming in from your side of the day.
                </motion.p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {homeStatsColumn.map((item, index) => {
                  const Icon = item.icon

                  return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.24 + index * 0.07 }}
                    className="rounded-[1.5rem] border border-white/75 bg-white/82 p-5 shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-200/70 bg-gold-50 text-gold-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-4xl leading-none text-gold-600 sm:text-[2.75rem]">
                          {item.number}
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-charcoal-600">
                          {item.label}
                        </p>
                        <p className="mt-3 text-[0.95rem] leading-7 text-charcoal-700">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )})}
              </div>

            </div>
          </div>
        </motion.div>
      </section>

      <section className="px-4 pb-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65 }}
            className="cinematic-panel px-6 py-6 sm:px-8 sm:py-8"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <span className="eyebrow-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  Now unfolding
                </span>
                <h2 className="mt-5 text-4xl text-cinematic-primary sm:text-5xl">
                  A reason to come back, not just a place to land once.
                </h2>
                <p className="mt-4 text-base leading-7 text-cinematic-secondary sm:text-lg">
                  We want this to keep feeling alive as new guest angles, guestbook notes, and
                  featured film moments settle into the archive. These are the places to start if
                  you are returning for something fresh.
                </p>
              </div>

              <div className="w-full max-w-xl">
                <Search />
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {returnVisitCards.map((card, index) => {
                const Icon = card.icon

                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.08 + index * 0.08 }}
                    className="rounded-[1.6rem] border border-gold-200/14 bg-[rgba(255,247,235,0.08)] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold-200/18 bg-[rgba(255,247,235,0.1)] text-gold-300">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="rounded-full border border-gold-200/18 bg-[rgba(255,247,235,0.08)] px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-cinematic-muted">
                        {card.badge}
                      </span>
                    </div>
                    <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-gold-300/82">
                      {card.eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl text-cinematic-primary">{card.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-cinematic-secondary">{card.summary}</p>
                    <Link
                      to={card.href}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gold-300 transition-colors hover:text-cinematic-primary"
                    >
                      Open this thread
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[1.6rem] border border-gold-200/14 bg-[rgba(255,247,235,0.08)] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-300/82">
                  {momentOfTheWeek.eyebrow}
                </p>
                <h3 className="mt-3 text-3xl text-cinematic-primary">{momentOfTheWeek.title}</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-cinematic-secondary">
                  {momentOfTheWeek.summary}
                </p>
                <Link
                  to={momentOfTheWeek.href}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold-200/18 bg-[rgba(255,247,235,0.08)] px-4 py-2.5 text-sm font-medium text-gold-300 transition-colors hover:border-gold-300/35 hover:text-cinematic-primary"
                >
                  {momentOfTheWeek.badge}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-[1.6rem] border border-gold-200/14 bg-[rgba(255,247,235,0.08)] p-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-300/82">Memory trails</p>
                <h3 className="mt-3 text-2xl text-cinematic-primary">Follow one feeling across the whole site.</h3>
                <p className="mt-3 text-sm leading-6 text-cinematic-secondary">
                  These story lanes tie the film, gallery, guestbook, and guest highlights together
                  without turning the site into a feed.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {memoryTrailLinks.map((trail) => (
                    <Link
                      key={trail.id}
                      to={trail.href}
                      className="rounded-[1.2rem] border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3 transition-colors hover:border-gold-300/35 hover:bg-[rgba(255,247,235,0.1)]"
                    >
                      <p className="text-sm font-semibold text-cinematic-primary">{trail.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-gold-300/72">{trail.cue}</p>
                      <p className="mt-3 text-sm leading-6 text-cinematic-secondary">{trail.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline Section - Love Story */}
      <LoveTimeline />
    </div>
  )
}
