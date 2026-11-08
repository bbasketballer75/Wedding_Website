import { motion, useScroll, useTransform } from 'framer-motion'
import { Calendar, MapPin } from 'lucide-react'
import { useRef } from 'react'
import { mediaPaths } from '@/shared/data/media'
import { cn } from '@/shared/lib/cn'
import { ImageCarousel } from './ImageCarousel'
import { getImagePaths, type TimelineEvent } from './timelineContent'

export interface HalloweenCardProps {
  event: TimelineEvent
  index: number
}

/**
 * Frozen `HalloweenCard` (`src/components/timeline/LoveTimeline.tsx` lines
 * 211-481): the bespoke horror-themed proposal card — fog layers, cobwebs,
 * silhouettes, flickering light, 8-photo engagement carousel and the glowing
 * copy. Every class string, emoji and motion value is verbatim.
 */
export function HalloweenCard({ event, index }: HalloweenCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'center center'],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 1])
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], isMobile ? [0.97, 1, 1] : [0.8, 1, 1])
  const x = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? [0, 0] : [event.side === 'left' ? -100 : 100, 0]
  )

  // Get engagement photos
  const engagementImages = getImagePaths('engagement', 8, mediaPaths.getMediaPath)

  return (
    <motion.div
      ref={cardRef}
      style={{ opacity, scale, x }}
      className={cn(
        'relative z-[60] ml-7 w-[calc(100%-1.75rem)] md:ml-0 md:w-[calc(50%-60px)]',
        event.side === 'left' ? 'md:mr-auto' : 'md:ml-auto'
      )}
    >
      {/* Mobile timeline dot */}
      <div className='absolute -left-3 top-7 z-30 md:hidden'>
        <div className='h-3 w-3 rounded-full border-2 border-white shadow-sm bg-red-600' />
      </div>

      {/* Horror Themed Halloween Card */}
      <motion.div
        whileHover={{
          y: -8,
          boxShadow: '0 38px 84px -18px rgba(72, 8, 31, 0.78), 0 0 90px rgba(251, 113, 133, 0.18)',
        }}
        transition={{ duration: 0.3 }}
        className='relative overflow-hidden rounded-[2rem] border-2 border-rose-950/80 bg-[linear-gradient(145deg,rgba(18,7,16,0.99),rgba(58,11,33,0.98)_34%,rgba(103,21,52,0.94)_65%,rgba(53,10,28,0.98)_100%)] p-6 shadow-2xl cursor-pointer group md:p-8'
      >
        {/* Animated Fog Layers */}
        <div className='absolute inset-0 pointer-events-none'>
          <motion.div
            animate={{
              opacity: [0.35, 0.7, 0.4],
              x: [-14, 12, -14],
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className='absolute inset-0 bg-gradient-to-br from-rose-950/40 via-black to-red-950/25'
          />
          <motion.div
            animate={{ opacity: [0.18, 0.35, 0.2], rotate: [0, 3, -2, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            className='absolute -left-16 top-8 h-64 w-56 bg-[radial-gradient(circle,rgba(251,191,36,0.34),rgba(251,113,133,0.12)_44%,transparent_72%)] blur-3xl'
          />
          <motion.div
            animate={{ opacity: [0.18, 0.42, 0.2], rotate: [0, -4, 2, 0] }}
            transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className='absolute right-[-4rem] top-12 h-72 w-60 bg-[radial-gradient(circle,rgba(244,114,182,0.32),rgba(245,158,11,0.12)_48%,transparent_72%)] blur-3xl'
          />
          <div className='absolute inset-0 bg-[linear-gradient(130deg,transparent_16%,rgba(255,255,255,0.04)_31%,transparent_48%,rgba(255,181,90,0.06)_64%,transparent_81%)]' />
          <div className='absolute inset-0 bg-gradient-to-t from-black via-transparent to-red-950/10' />
        </div>

        <div className='pointer-events-none absolute inset-x-6 top-0 flex justify-between opacity-85'>
          {[0, 1, 2, 3].map(index => (
            <motion.div
              key={index}
              animate={{ height: [10, 18 + index * 4, 12], opacity: [0.7, 1, 0.75] }}
              transition={{ duration: 3.4 + index * 0.45, repeat: Infinity, delay: index * 0.35 }}
              className='w-1.5 rounded-b-full bg-gradient-to-b from-red-500 via-red-700 to-red-950 shadow-[0_0_12px_rgba(220,38,38,0.55)]'
            />
          ))}
        </div>

        {/* Cobweb - Top Right */}
        <svg className='absolute top-0 right-0 w-28 h-28 opacity-40' viewBox='0 0 100 100'>
          <path
            d='M100,0 L100,100 M100,0 L0,0 M100,0 L50,50'
            stroke='#DC2626'
            strokeWidth='0.8'
            fill='none'
            opacity='0.6'
          />
          <path
            d='M100,20 L70,20 M100,40 L80,40 M100,60 L90,60'
            stroke='#7F1D1D'
            strokeWidth='0.5'
            fill='none'
            opacity='0.4'
          />
          <path
            d='M80,0 L80,30 M60,0 L60,20 M40,0 L40,15'
            stroke='#991B1B'
            strokeWidth='0.5'
            fill='none'
            opacity='0.3'
          />
        </svg>

        {/* Cobweb - Bottom Left */}
        <svg
          className='absolute bottom-0 left-0 w-20 h-20 opacity-30 rotate-180'
          viewBox='0 0 100 100'
        >
          <path
            d='M100,0 L100,100 M100,0 L0,0 M100,0 L50,50'
            stroke='#DC2626'
            strokeWidth='0.8'
            fill='none'
            opacity='0.5'
          />
          <path
            d='M100,25 L75,25 M100,50 L85,50'
            stroke='#7F1D1D'
            strokeWidth='0.5'
            fill='none'
            opacity='0.3'
          />
        </svg>

        {/* Shadow Silhouettes */}
        <motion.div
          animate={{ opacity: [0.15, 0.3, 0.14], x: [0, 8, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
          className='absolute right-6 top-6 text-5xl pointer-events-none select-none grayscale'
          style={{ filter: 'blur(1px) brightness(0.35)' }}
        >
          🧟
        </motion.div>
        <motion.div
          animate={{ opacity: [0.12, 0.22, 0.1], x: [0, -6, 0], rotate: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: 2 }}
          className='absolute bottom-10 left-4 text-4xl pointer-events-none select-none grayscale'
          style={{ filter: 'blur(1px) brightness(0.46)' }}
        >
          👰‍♀️
        </motion.div>
        <motion.div
          animate={{ opacity: [0.18, 0.4, 0.18], scale: [0.95, 1.06, 0.95], rotate: [0, 6, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          className='absolute bottom-20 right-8 text-3xl pointer-events-none select-none'
        >
          🎃
        </motion.div>
        <motion.div
          animate={{ opacity: [0.2, 0.45, 0.2], y: [0, -6, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, delay: 0.6 }}
          className='absolute left-10 top-10 text-2xl pointer-events-none select-none'
        >
          ✨
        </motion.div>

        {/* Flickering Light Effect */}
        <motion.div
          animate={{ opacity: [0.18, 0.38, 0.18, 0.46, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1] }}
          className='absolute right-1/4 top-1/3 h-48 w-48 rounded-full bg-orange-700/20 blur-3xl pointer-events-none'
        />

        {/* Engagement Photos Carousel */}
        <div className='relative mb-5 overflow-hidden rounded-[1.65rem] border border-rose-300/25 bg-[linear-gradient(180deg,rgba(10,5,11,0.7),rgba(27,7,16,0.85))] p-3 shadow-[0_26px_45px_-26px_rgba(0,0,0,0.85)]'>
          <motion.div
            animate={{ x: ['0%', '100%'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
            className='pointer-events-none absolute inset-y-0 left-[-20%] w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white/14 to-transparent blur-md'
          />
          <div className='pointer-events-none absolute inset-0 rounded-[1.25rem] border border-white/8 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.12)]' />
          <ImageCarousel
            images={engagementImages}
            alt='Engagement'
            autoPlayInterval={3500}
            className='h-[240px] rounded-[1.25rem] border border-rose-300/20 bg-black/70 md:h-[270px]'
          />
        </div>

        {/* Content */}
        <div className='relative z-10'>
          {/* Date Badge */}
          <div className='flex items-center gap-2 mb-4'>
            <span className='inline-flex items-center gap-2 border border-red-700/70 bg-[linear-gradient(135deg,rgba(94,10,22,0.86),rgba(54,7,17,0.82))] px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-100 shadow-[0_14px_24px_-16px_rgba(127,29,29,0.95)]'>
              <Calendar className='w-3 h-3 text-orange-300' />
              {event.date}
            </span>
          </div>

          {/* Title */}
          <h3 className='mb-3 font-display text-[2.15rem] leading-none text-white md:text-[3rem]'>
            <span className='text-rose-300 drop-shadow-[0_0_18px_rgba(244,114,182,0.72)]'>The</span>
            <span className='ml-2 text-candle-100 drop-shadow-[0_0_24px_rgba(255,247,235,0.12)]'>
              {' '}
              Proposal
            </span>
            <span className='ml-3 inline-block text-fuchsia-200 drop-shadow-[0_0_18px_rgba(244,114,182,0.65)]'>
              💍
            </span>
          </h3>

          {/* Description */}
          <p className='mb-4 text-sm leading-relaxed text-[#f8e7ea] md:text-base'>
            On All Hallows&apos; Eve, with the costumes on, the music up, and the whole night
            already feeling half haunted and half electric, Frankenstein finally asked his Bride the
            question that had been building toward forever.
          </p>

          <motion.p
            animate={{
              opacity: [1, 0.68, 1],
              textShadow: [
                '0 0 14px rgba(244,114,182,0.38)',
                '0 0 24px rgba(251,191,36,0.46)',
                '0 0 14px rgba(244,114,182,0.38)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className='mb-4 font-display text-xl text-rose-300 drop-shadow-[0_0_14px_rgba(244,114,182,0.45)]'
          >
            She said yes, and the whole party tipped into forever.
          </motion.p>

          {/* Location */}
          <motion.div
            className='flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-100/88'
            whileHover={{ x: 5, color: 'var(--color-rose-200)' }}
          >
            <MapPin className='w-3 h-3 text-orange-300' />
            <span>Halloween night • costumes on • forever got weird in the best way</span>
          </motion.div>
        </div>

        {/* Vignette Effect */}
        <div className='absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]' />
      </motion.div>

      {/* Timeline Dot - Halloween Theme */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 z-30 hidden md:flex',
          event.side === 'left' ? '-right-[68px]' : '-left-[68px]'
        )}
      >
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.5 }}
          className='relative w-5 h-5 rounded-full border-4 shadow-lg cursor-pointer bg-red-600 border-red-400 shadow-red-600/60'
        >
          {/* Pulse Ring */}
          <motion.div
            animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className='absolute inset-0 rounded-full -z-10 bg-red-500'
          />
        </motion.div>
      </div>

      {/* Connecting Line from Card to Center */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-0.5 bg-red-900/40 hidden md:block z-20',
          event.side === 'left' ? '-right-[60px] w-[60px]' : '-left-[60px] w-[60px]'
        )}
      />
    </motion.div>
  )
}
