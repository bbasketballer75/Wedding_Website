import { type ElementType, useState, useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import { Link } from 'react-router-dom'
import { Images, Play } from 'lucide-react'
import { LoveTimeline } from '@/components/timeline/LoveTimeline'
import { AnniversaryCountdown } from '@/components/sections/AnniversaryCountdown'
import { GuestHighlightReel } from '@/components/sections/GuestHighlightReel'
import { MomentOfTheWeekSection } from '@/components/sections/MomentOfTheWeekSection'
import { StandoutUploadSection } from '@/components/sections/StandoutUploadSection'
import { FeaturedNoteSection } from '@/components/sections/FeaturedNoteSection'
import ElegantDivider from '@/components/sections/ElegantDivider'
import { publicNavLinks } from '@/components/layout/publicNav'
import { HomeSEO } from '@/components/seo/SEOHead'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { cn } from '@/lib/utils'

const HERO_POSTER = '/images/home/intro-video-poster.png'

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
  const [scrolled, setScrolled] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollY } = useScroll()
  const heroScale = useTransform(scrollY, [0, 860], prefersReducedMotion ? [1, 1] : [1, 1.08])

  // Track scroll position for section transitions
  useMotionValueEvent(scrollY, 'change', latest => {
    setScrolled(latest > 100)
  })

  const scrollToContent = () => {
    document.getElementById('welcome-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={containerRef} className='theme-canvas min-h-screen'>
      <HomeSEO />

      {/* Sticky Nav Bar */}
      <motion.nav
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        data-testid='home-nav'
        className='fixed top-3 left-1/2 z-50 w-[calc(100vw-0.75rem)] max-w-[40rem] -translate-x-1/2 sm:top-6 sm:w-[calc(100vw-1rem)] sm:max-w-[62rem]'
      >
        <motion.div
          className={cn(
            'flex w-full items-center gap-1 overflow-x-auto rounded-full px-1.5 py-1.5 transition-all duration-500 hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2',
            scrolled
              ? 'theme-panel'
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
          <ThemeToggle className='shadow-none' />
        </motion.div>
      </motion.nav>

      {/* Hero Section */}
      <section
        data-testid='home-hero'
        className='relative min-h-[100svh] w-full overflow-hidden bg-[#050403] md:min-h-screen'
      >
        <motion.div
          style={{ scale: heroScale }}
          className='absolute inset-0 flex items-center justify-center will-change-transform'
        >
          <img
            src={HERO_POSTER}
            alt=''
            aria-hidden='true'
            className='max-h-[66svh] w-[min(92vw,72rem)] object-contain opacity-95 sm:max-h-[70vh]'
          />
        </motion.div>

        <div className='absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%),linear-gradient(to_bottom,rgba(5,4,3,0.5),rgba(5,4,3,0.04)_40%,rgba(5,4,3,0.82))]' />

        {/* Entry actions */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className='absolute inset-x-0 bottom-5 z-10 px-4 sm:bottom-8 sm:px-8'
        >
          <div className='mx-auto flex max-w-6xl flex-col gap-4 rounded-[1.35rem] border border-white/14 bg-black/34 p-4 text-candle-100 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-md sm:flex-row sm:items-end sm:justify-between sm:p-5'>
            <div className='min-w-0'>
              <p className='text-[11px] font-medium uppercase tracking-[0.2em] text-gold-300/80'>
                Austin and Jordyn Porada
              </p>
              <p className='mt-2 max-w-xl text-sm leading-6 text-candle-100/72 sm:text-base'>
                Wedding film, photographs, guest memories, and the story we built with everyone who
                celebrated with us.
              </p>
            </div>

            <div className='flex flex-wrap gap-2 sm:justify-end'>
              <motion.button
                type='button'
                onClick={scrollToContent}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={{ scale: 0.98 }}
                className='inline-flex min-h-11 items-center justify-center rounded-full bg-gold-500 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-charcoal-900 shadow-[0_8px_24px_-8px_rgba(180,140,50,0.55)] transition hover:bg-gold-400'
              >
                Enter archive
              </motion.button>
              <Link
                to='/film'
                className='inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/24 bg-white/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-candle-100 backdrop-blur-sm transition hover:bg-white/18'
              >
                <Play className='h-4 w-4' />
                Film
              </Link>
              <Link
                to='/gallery'
                className='inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/24 bg-white/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-candle-100 backdrop-blur-sm transition hover:bg-white/18'
              >
                <Images className='h-4 w-4' />
                Gallery
              </Link>
            </div>
          </div>
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
