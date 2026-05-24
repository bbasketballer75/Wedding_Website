import { type ElementType, useState, useEffect, useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { LoveTimeline } from '@/components/timeline/LoveTimeline'
import { AnniversaryCountdown } from '@/components/sections/AnniversaryCountdown'
import { GuestHighlightReel } from '@/components/sections/GuestHighlightReel'
import { MomentOfTheWeekSection } from '@/components/sections/MomentOfTheWeekSection'
import { StandoutUploadSection } from '@/components/sections/StandoutUploadSection'
import { FeaturedNoteSection } from '@/components/sections/FeaturedNoteSection'
import ElegantDivider from '@/components/sections/ElegantDivider'
import { publicNavLinks } from '@/components/layout/publicNav'
import { HomeSEO } from '@/components/seo/SEOHead'
import { cn } from '@/lib/utils'

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
  scrolled = false,
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
        'flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-[9px] font-medium leading-none uppercase tracking-[0.16em] transition-all duration-300 max-[360px]:gap-0 max-[360px]:px-1.5 max-[360px]:text-[8px] max-[360px]:tracking-[0.12em] min-[430px]:px-2.5 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-[0.24em]',
        isPrimary
          ? scrolled
            ? 'text-gold-500 hover:text-gold-600 font-medium'
            : 'text-gold-300 hover:text-candle-100 font-medium'
          : scrolled
            ? 'text-charcoal-700 hover:text-charcoal-900 hover:bg-charcoal-100'
            : 'text-[#f7efe3] hover:text-[#fff7eb] hover:bg-white/10'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 max-[360px]:h-3 max-[360px]:w-3 sm:h-4 sm:w-4',
          isPrimary && !scrolled && 'fill-gold-400/20'
        )}
      />
      <span className='max-[360px]:hidden sm:hidden'>{mobileLabel ?? label}</span>
      <span className='hidden sm:inline'>{label}</span>
    </Link>
  )
}

export default function Home() {
  const prefersReducedMotion = useReducedMotion()
  const [showUI, setShowUI] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [heroMateriallyVisible, setHeroMateriallyVisible] = useState(true)
  const heroRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 260, 860], [1, 1, 0])
  const heroScale = useTransform(scrollY, [0, 860], [1, 1.08])

  // Track scroll position for section transitions
  useMotionValueEvent(scrollY, 'change', latest => {
    setScrolled(latest > 100)
  })

  useEffect(() => {
    const timer = setTimeout(() => setShowUI(true), 1200)
    return () => clearTimeout(timer)
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
    document.getElementById('welcome-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={containerRef} className='min-h-screen bg-cream-50'>
      <HomeSEO />

      {/* Sticky Nav Bar - Always Visible */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{
          opacity: showUI && !heroMateriallyVisible ? 1 : 0,
          y: showUI && !heroMateriallyVisible ? 0 : -20,
        }}
        transition={{ duration: 0.6, delay: 0.3 }}
        data-testid='home-nav'
        aria-hidden={!showUI || heroMateriallyVisible}
        className={cn(
          'fixed top-3 left-1/2 z-50 w-[calc(100vw-0.75rem)] max-w-[40rem] -translate-x-1/2 sm:top-6 sm:w-[calc(100vw-1rem)] sm:max-w-[52rem]',
          heroMateriallyVisible && 'pointer-events-none'
        )}
      >
        <motion.div
          className={cn(
            'flex w-full items-center gap-1 overflow-x-auto rounded-full px-1.5 py-1.5 transition-all duration-500 hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2',
            scrolled
              ? 'bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 backdrop-blur-md border border-gold-300/50 shadow-lg'
              : 'bg-[linear-gradient(135deg,rgba(41,29,23,0.9),rgba(58,42,33,0.9))] backdrop-blur-md border border-gold-200/18 shadow-2xl'
          )}
        >
          {/* Logo */}
          <Link
            to='/'
            className={cn(
              'shrink-0 px-3 py-2 font-display text-lg transition-colors max-[360px]:px-2.5 max-[360px]:text-base sm:px-4 sm:text-xl',
              scrolled
                ? 'text-charcoal-900 hover:text-gold-600'
                : 'text-[#fff7eb] hover:text-gold-300'
            )}
          >
            <span className='text-gold-500'>A</span>&<span className='text-gold-500'>J</span>
          </Link>

          <div
            className={cn(
              'hidden h-5 w-px sm:block',
              scrolled ? 'bg-charcoal-200' : 'bg-gold-200/18'
            )}
          />

          {publicNavLinks.map((item, index) => (
            <div key={item.path} className='contents'>
              {index > 0 && (
                <div
                  className={cn(
                    'hidden h-5 w-px sm:block',
                    scrolled ? 'bg-charcoal-200' : 'bg-gold-200/18'
                  )}
                />
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
      <section
        ref={heroRef}
        data-testid='home-hero'
        className='relative min-h-[100svh] w-full overflow-hidden md:min-h-screen'
      >
        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className='absolute inset-0'>
          <img
            src={HERO_POSTER}
            alt=''
            aria-hidden='true'
            className='h-full w-full scale-[1.02] object-cover object-[58%_center] sm:scale-100 sm:object-center'
          />
        </motion.div>

        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className='absolute inset-0'>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload='auto'
            poster={HERO_POSTER}
            className={cn('h-full w-full', 'object-cover object-[58%_center] sm:object-center')}
          >
            <source src={HERO_VIDEO_WEBM} type='video/webm' />
            <source src={HERO_VIDEO_MP4} type='video/mp4' />
          </video>
        </motion.div>

        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(to_bottom,rgba(21,20,19,0.26),rgba(21,20,19,0.12)_35%,rgba(21,20,19,0.48))]' />

        {/* Explore Button - Fixed at bottom of hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ opacity: heroOpacity }}
          className='absolute bottom-6 left-1/2 -translate-x-1/2 z-10 sm:bottom-8'
        >
          <motion.button
            onClick={scrollToContent}
            animate={prefersReducedMotion ? undefined : { y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.03, y: -6 }}
            whileTap={{ scale: 0.95 }}
            className='group flex items-center gap-3'
          >
            <span className='rounded-full bg-gold-500 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.25em] text-white shadow-[0_8px_24px_-8px_rgba(180,140,50,0.55)]'>
              Explore
            </span>
            <span className='flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/18 text-white shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0.5'>
              <ChevronDown className='h-4 w-4' />
            </span>
          </motion.button>
        </motion.div>
      </section>

      {/* Cinematic act-break chapter panel */}
      <section className='relative overflow-hidden bg-charcoal-900 py-20 sm:py-28'>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.4 }}
          className='mx-auto max-w-2xl px-4 text-center'
        >
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2, ease: 'easeInOut' }}
            className='mx-auto mb-8 h-px w-16 origin-center bg-gold-500/40'
          />
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.4 }}
            className='font-script mb-3 text-5xl text-candle-100/90 sm:text-6xl'
          >
            Our Story
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.8 }}
            className='text-[11px] uppercase tracking-[0.3em] text-gold-400/55'
          >
            May 10, 2025 · Shared with love
          </motion.p>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.6, ease: 'easeInOut' }}
            className='mx-auto mt-8 h-px w-16 origin-center bg-gold-500/40'
          />
        </motion.div>
      </section>

      <div id='welcome-panel'>
        <AnniversaryCountdown />
      </div>

      <ElegantDivider />

      <LoveTimeline />

      <ElegantDivider />

      <GuestHighlightReel />

      <ElegantDivider />

      <MomentOfTheWeekSection />

      <ElegantDivider />

      <StandoutUploadSection />

      <ElegantDivider />

      <FeaturedNoteSection />
    </div>
  )
}
