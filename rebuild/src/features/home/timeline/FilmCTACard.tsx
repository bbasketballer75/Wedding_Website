import { motion, useScroll, useTransform } from 'framer-motion'
import { Clapperboard, Play } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/shared/ui'
import {
  formatVideoProgressLabel,
  MAIN_FILM_PROGRESS_KEY,
  readSavedVideoProgress,
} from '../lib/videoProgress'

/**
 * Frozen `FilmCTACard` (`src/components/timeline/LoveTimeline.tsx` lines
 * 683-772): closing timeline card with the ambient glows and the film CTA.
 *
 * Router adaptation: the frozen `to="/film?resume=1"` becomes TanStack
 * `to="/film"` + `search={{ resume: 1 }}`; the resume label logic (frozen
 * `video-progress-main-film` localStorage key + mm:ss format) is unchanged.
 */
export function FilmCTACard() {
  const cardRef = useRef<HTMLDivElement>(null)
  const resumeTime = readSavedVideoProgress(MAIN_FILM_PROGRESS_KEY)

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'center center'],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 1])

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale }}
      className='relative z-[60] ml-7 w-[calc(100%-1.75rem)] md:mx-auto md:w-full md:max-w-xl'
    >
      {/* Mobile dot — left rail */}
      <div className='absolute -left-3 top-8 z-30 md:hidden'>
        <div className='h-3 w-3 rounded-full border-2 border-white bg-gold-500 shadow-sm' />
      </div>

      {/* Desktop dot — top-center, rail terminates here */}
      <div className='absolute -top-4 left-1/2 -translate-x-1/2 z-30 hidden md:block'>
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200 }}
          className='relative h-5 w-5 rounded-full border-4 border-white bg-gold-500 shadow-lg shadow-gold-300/50'
        >
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className='absolute inset-0 rounded-full -z-10 bg-gold-400'
          />
        </motion.div>
      </div>

      {/* Card */}
      <motion.div
        whileHover={{
          y: -6,
          boxShadow: '0 30px 60px -15px rgba(198,156,78,0.3)',
          borderColor: 'rgba(198,156,78,0.6)',
        }}
        transition={{ duration: 0.3 }}
        className='relative overflow-hidden rounded-2xl border border-gold-200/15 bg-[linear-gradient(145deg,rgba(12,8,5,0.98),rgba(36,22,8,0.97)_55%,rgba(18,11,4,0.98))] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] cursor-pointer group sm:p-8'
      >
        {/* Ambient glow */}
        <div className='pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl' />
        <div className='pointer-events-none absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-rose-700/8 blur-3xl' />

        <div className='relative flex items-start justify-between gap-4'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-300/25 bg-gold-500/10 text-gold-400'>
            <Clapperboard className='h-5 w-5' />
          </div>
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm'
          >
            <Play className='h-4 w-4 fill-white text-white ml-0.5' />
          </motion.div>
        </div>

        <h3 className='relative mt-5 font-display text-2xl text-white sm:text-3xl'>
          The whole night, start to finish.
        </h3>

        <p className='relative mt-3 text-sm leading-relaxed text-white/55 sm:text-base'>
          Ceremony, vows, speeches, first dance — and everything in between.
        </p>

        <div className='relative mt-6'>
          <Button
            size='lg'
            to='/film'
            {...(resumeTime ? { search: { resume: 1 } } : {})}
            className='w-full justify-center'
          >
            {resumeTime ? `Resume at ${formatVideoProgressLabel(resumeTime)}` : 'Watch the Film'}
          </Button>
        </div>

        <motion.div className='pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-inset ring-gold-400/30 transition-opacity duration-300 group-hover:opacity-100' />
      </motion.div>
    </motion.div>
  )
}
