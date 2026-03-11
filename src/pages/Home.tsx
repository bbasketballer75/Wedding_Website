import { type ElementType, useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Play, Images, Heart, BookHeart, ChevronDown, ArrowRight, Sparkles } from 'lucide-react'
import { LoveTimeline } from '@/components/timeline/LoveTimeline'
import { publicNavLinks } from '@/components/layout/publicNav'
import { HomeSEO } from '@/components/seo/SEOHead'

import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'

const HERO_POSTER = '/images/home/intro-video-poster.png'
const HERO_VIDEO = getMediaPath('/video/optimized_background.mp4')

const HOME_ACTIONS = [
  {
    to: '/film',
    icon: Play,
    eyebrow: 'Start here',
    title: 'Watch the film',
    description: 'Settle in for the ceremony, speeches, and dance floor in one cinematic cut.',
    surfaceClass: 'border-charcoal-900 bg-charcoal-900 text-white shadow-[0_24px_50px_-28px_rgba(21,20,19,0.85)]',
    iconClass: 'border-white/10 bg-white/10 text-gold-300',
    eyebrowClass: 'text-white/60',
    bodyClass: 'text-white/72',
    arrowClass: 'text-gold-300',
  },
  {
    to: '/gallery',
    icon: Images,
    eyebrow: 'Best dressed',
    title: 'Browse the gallery',
    description: 'Professional portraits, candids, and all the small looks that made the day.',
    surfaceClass: 'border-white/80 bg-white/82 text-charcoal-900 shadow-sm',
    iconClass: 'border-gold-200 bg-gold-50 text-gold-600',
    eyebrowClass: 'text-gold-700',
    bodyClass: 'text-charcoal-500',
    arrowClass: 'text-gold-500',
  },
  {
    to: '/guestbook',
    icon: BookHeart,
    eyebrow: 'Sweetest notes',
    title: 'Read the guestbook',
    description: 'Messages from family and friends, all gathered in one place for easy revisiting.',
    surfaceClass: 'border-blush-200/80 bg-blush-100/88 text-charcoal-900 shadow-sm',
    iconClass: 'border-white/80 bg-white/80 text-rose-500',
    eyebrowClass: 'text-rose-500',
    bodyClass: 'text-charcoal-500',
    arrowClass: 'text-rose-500',
  },
  {
    to: '/upload',
    icon: Heart,
    eyebrow: 'Your point of view',
    title: 'Share your photos',
    description: 'Add your phone favorites so our archive keeps growing from every angle.',
    surfaceClass: 'border-sage-200/90 bg-sage-100/88 text-charcoal-900 shadow-sm',
    iconClass: 'border-white/80 bg-white/80 text-gold-700',
    eyebrowClass: 'text-charcoal-500',
    bodyClass: 'text-charcoal-500',
    arrowClass: 'text-charcoal-500',
  },
] as const

const HOME_STATS = [
  { number: '42', label: 'Minute film', detail: 'Ceremony to final dance' },
  { number: '247', label: 'Photos', detail: 'Portraits, candids, and details' },
  { number: '100+', label: 'Guest messages', detail: 'Notes worth keeping forever' },
  { number: '∞', label: 'Memories', detail: 'Still growing with your uploads' },
] as const

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
          ? scrolled ? "text-gold-500 hover:text-gold-600 font-medium" : "text-gold-400 hover:text-gold-300 font-medium"
          : scrolled ? "text-charcoal-700 hover:text-charcoal-900 hover:bg-charcoal-100" : "text-white/80 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 max-[360px]:h-3 max-[360px]:w-3 sm:h-4 sm:w-4", isPrimary && !scrolled && "fill-gold-400/20")} />
      <span className="whitespace-nowrap max-[360px]:hidden sm:hidden">{mobileLabel ?? label}</span>
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </Link>
  )
}

export default function Home() {
  const [showUI, setShowUI] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoErrored, setVideoErrored] = useState(false)
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
        className="fixed top-3 left-1/2 z-50 w-[calc(100vw-1rem)] max-w-[28rem] -translate-x-1/2 sm:top-6 sm:w-auto sm:max-w-max"
      >
        <motion.div 
          className={cn(
            "flex w-full items-center justify-between rounded-full px-2 py-1.5 transition-all duration-500 max-[360px]:px-1.5 sm:w-auto sm:px-2 sm:py-2",
            scrolled 
              ? "bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 backdrop-blur-md border border-gold-300/50 shadow-lg" 
              : "bg-charcoal-950/90 backdrop-blur-md border border-white/20 shadow-2xl"
          )}
        >
          {/* Logo */}
          <Link 
            to="/" 
            className={cn(
              "shrink-0 px-3 py-2 font-display text-lg transition-colors max-[360px]:px-2.5 max-[360px]:text-base sm:px-4 sm:text-xl",
              scrolled ? "text-charcoal-900 hover:text-gold-600" : "text-white hover:text-gold-400"
            )}
          >
            <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
          </Link>
          
          <div className={cn("hidden h-5 w-px sm:block", scrolled ? "bg-charcoal-200" : "bg-white/20")} />
          
          {publicNavLinks.map((item, index) => (
            <div key={item.path} className="contents">
              {index > 0 && (
                <div className={cn("hidden h-5 w-px sm:block", scrolled ? "bg-charcoal-200" : "bg-white/20")} />
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-charcoal-950/90 backdrop-blur-md border border-white/20 shadow-xl text-white/80 hover:text-gold-400 transition-colors"
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

            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <div>
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
                  className="max-w-2xl text-4xl text-charcoal-900 sm:text-5xl"
                >
                  Every chapter, all in one place.
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: 0.18 }}
                  className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg"
                >
                  Relive every part of the celebration from whichever doorway feels right:
                  the full film, the portrait gallery, the notes from everyone we love, and
                  the photos still coming in from your side of the day.
                </motion.p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {HOME_ACTIONS.map((item, index) => {
                    const Icon = item.icon

                    return (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, delay: 0.18 + index * 0.08 }}
                      >
                        <Link
                          to={item.to}
                          className={cn(
                            'group flex h-full flex-col rounded-[1.5rem] border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-28px_rgba(46,33,13,0.45)]',
                            item.surfaceClass
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', item.iconClass)}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <ArrowRight className={cn('h-4 w-4 transition-transform duration-300 group-hover:translate-x-1', item.arrowClass)} />
                          </div>
                          <p className={cn('mt-6 text-[10px] uppercase tracking-[0.3em]', item.eyebrowClass)}>
                            {item.eyebrow}
                          </p>
                          <p className="mt-2 text-xl font-semibold">
                            {item.title}
                          </p>
                          <p className={cn('mt-3 text-sm leading-6', item.bodyClass)}>
                            {item.description}
                          </p>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:pt-6">
                {HOME_STATS.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.24 + index * 0.07 }}
                    className="rounded-[1.5rem] border border-white/75 bg-white/72 p-5 shadow-sm backdrop-blur-sm"
                  >
                    <p className="font-display text-4xl text-gold-600 sm:text-[2.75rem]">
                      {item.number}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-charcoal-500">
                      {item.label}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-charcoal-500">
                      {item.detail}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Timeline Section - Love Story */}
      <LoveTimeline />
    </div>
  )
}
