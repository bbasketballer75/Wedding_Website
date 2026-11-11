import { Link } from '@tanstack/react-router'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Images, Play } from 'lucide-react'
import { HERO_POSTER } from '../content/wedding'

/**
 * Frozen Home hero (`src/pages/Home.tsx` lines 148-212): poster image with the
 * scroll-linked scale (1 → 1.08 over 860px, disabled by reduced motion), the
 * radial/linear overlay, and the entry-actions panel with the scroll-to-content
 * button plus Film/Gallery links. Class strings and motion values are verbatim.
 */
export function HomeHero() {
  const prefersReducedMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const heroScale = useTransform(scrollY, [0, 860], prefersReducedMotion ? [1, 1] : [1, 1.08])

  const scrollToContent = () => {
    document.getElementById('welcome-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
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
  )
}
