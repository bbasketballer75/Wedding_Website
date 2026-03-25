import { type ElementType, useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronDown, Clapperboard } from 'lucide-react'
import { LoveTimeline } from '@/components/timeline/LoveTimeline'
import { publicNavLinks } from '@/components/layout/publicNav'
import { HomeSEO } from '@/components/seo/SEOHead'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  MAIN_FILM_PROGRESS_KEY,
  formatVideoProgressLabel,
  readSavedVideoProgress,
} from '@/utils/videoProgress'

const HERO_POSTER = '/images/home/intro-video-poster.png'
const HERO_VIDEO_WEBM = '/video/home-hero.webm'
const HERO_VIDEO_MP4 = '/video/home-hero.mp4'

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
  const [heroMateriallyVisible, setHeroMateriallyVisible] = useState(true)
  const [resumeTime, setResumeTime] = useState<number | null>(null)
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
    const syncResumeTime = () => {
      setResumeTime(readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY))
    }

    syncResumeTime()
    document.addEventListener('visibilitychange', syncResumeTime)
    window.addEventListener('focus', syncResumeTime)

    return () => {
      document.removeEventListener('visibilitychange', syncResumeTime)
      window.removeEventListener('focus', syncResumeTime)
    }
  }, [])

  useEffect(() => {
    const hero = heroRef.current

    if (!hero) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroMateriallyVisible(entry.isIntersecting && entry.intersectionRatio > 0.35)
      },
      {
        threshold: [0, 0.35, 0.5, 1],
      }
    )

    observer.observe(hero)

    return () => {
      observer.disconnect()
    }
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
      video.load()

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
    document.getElementById('love-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-cream-50">
      <HomeSEO />

      {/* Sticky Nav Bar - Always Visible */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: showUI && !heroMateriallyVisible ? 1 : 0, y: showUI && !heroMateriallyVisible ? 0 : -20 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        data-testid="home-nav"
        className={cn(
          "fixed top-3 left-1/2 z-50 w-[calc(100vw-0.75rem)] max-w-[40rem] -translate-x-1/2 sm:top-6 sm:w-[calc(100vw-1rem)] sm:max-w-[42rem]",
          heroMateriallyVisible && "pointer-events-none"
        )}
      >
        <motion.div 
          className={cn(
            "flex w-full items-center gap-1 overflow-x-auto rounded-full px-1.5 py-1.5 transition-all duration-500 hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2",
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
            className={cn(
              "h-full w-full",
              "object-cover object-[58%_center] sm:object-center"
            )}
          >
            <source src={HERO_VIDEO_WEBM} type="video/webm" />
            <source src={HERO_VIDEO_MP4} type="video/mp4" />
          </video>
        </motion.div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(to_bottom,rgba(21,20,19,0.26),rgba(21,20,19,0.12)_35%,rgba(21,20,19,0.48))]" />

        {/* Explore Button - Fixed at bottom of hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ opacity: heroOpacity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 sm:bottom-8"
        >
          <motion.button
            onClick={scrollToContent}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.03, y: -6 }}
            whileTap={{ scale: 0.95 }}
            className="group flex items-center gap-3"
          >
            <span className="rounded-full bg-gold-500 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.25em] text-white shadow-[0_8px_24px_-8px_rgba(180,140,50,0.55)]">
              Explore
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/18 text-white shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0.5">
              <ChevronDown className="h-4 w-4" />
            </span>
          </motion.button>
        </motion.div>
      </section>

      <LoveTimeline />

      <section className="relative overflow-hidden px-4 pb-24 pt-10 sm:pt-14">
        <div className="absolute inset-0 bg-gradient-to-b from-cream-100 via-cream-50 to-cream-100" />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ x: [0, 36, 0], y: [0, 24, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute right-0 top-0 h-64 w-64 rounded-full bg-gold-200/25 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -32, 0], y: [0, 28, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-blush-200/35 blur-3xl"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 mx-auto max-w-5xl"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(250,248,244,0.98)_58%,rgba(246,239,226,0.92))] p-5 shadow-[0_35px_90px_-45px_rgba(46,33,13,0.45)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="absolute -right-12 top-6 h-36 w-36 rounded-full bg-gold-200/30 blur-3xl" />
            <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-blush-200/35 blur-3xl" />

            <div className="relative">
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/60 bg-white/80 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-gold-700 shadow-sm">
                  <Clapperboard className="h-3.5 w-3.5" />
                  Watch next
                </div>

                <h2 className="max-w-xl text-[2.2rem] leading-[0.98] tracking-[-0.035em] text-charcoal-900 min-[380px]:text-[2.5rem] sm:text-[4rem]">
                  When you are ready, the film is waiting.
                </h2>

                <p className="mt-5 max-w-2xl text-base leading-7 text-charcoal-700 sm:text-[1.08rem] sm:leading-8">
                  The timeline gives the shape of the story. The film lets you settle into the
                  ceremony, the speeches, and the rest of the night at an easy pace.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button size="lg" to={resumeTime ? `/film?resume=1` : '/film'} className="min-w-[14rem] justify-center">
                    {resumeTime ? `Resume the Film at ${formatVideoProgressLabel(resumeTime)}` : 'Watch the Film'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

    </div>
  )
}
