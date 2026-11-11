/**
 * Film hero, ported from the frozen `src/pages/Film.tsx` hero section.
 * Copy, class strings and motion values are the frozen oracle's.
 */
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { MAIN_FILM_RUNTIME_LABEL } from './filmContent'

export interface FilmHeroProps {
  onWatchNow: () => void
}

export function FilmHero({ onWatchNow }: FilmHeroProps) {
  return (
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
              Start here if you are only opening one page. This is the full arc of May 10, 2025: the
              nerves, the vows, the speeches, the laughter, and the dance floor blur that still
              feels impossible to forget.
            </p>

            <div className='mt-8'>
              <Button onClick={onWatchNow} size='lg'>
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
  )
}
