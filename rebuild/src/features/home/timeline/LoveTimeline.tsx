import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useRef } from 'react'
import { FilmCTACard } from './FilmCTACard'
import { TimelineCard } from './TimelineCard'
import { timelineEvents } from './timelineContent'

/**
 * Frozen `LoveTimeline` (`src/components/timeline/LoveTimeline.tsx` lines
 * 774-918): header ("Our Love Story" / "The Journey to I Do"), the animated
 * center rail with scroll-linked progress line and indicator, the five
 * floating hearts, the mobile/desktop event rail and the closing film CTA.
 *
 * Every class string, offset, spring value and transform range is verbatim.
 * The nine milestone records and media lists live in `timelineContent.ts`
 * (literal frozen copy — the archival contracts timeline is not used).
 */
export function LoveTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  // Smooth progress animation
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 50,
    damping: 20,
  })

  // Line height grows with scroll
  const lineHeight = useTransform(smoothProgress, [0, 0.8], ['0%', '100%'])

  // Parallax background elements
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -100])

  // Progress indicator position
  const progressY = useTransform(lineHeight, v => v)

  return (
    <section
      id='love-timeline'
      ref={containerRef}
      className='relative py-24 px-4 bg-gradient-to-b from-cream-50 via-gold-50/30 to-cream-100 overflow-hidden'
    >
      {/* Animated Background Elements */}
      <motion.div style={{ y: bgY }} className='absolute inset-0 pointer-events-none'>
        {/* Floating Hearts */}
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 100 }}
            animate={{
              opacity: [0.1, 0.3, 0.1],
              y: [-20, -40, -20],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
            className='absolute text-gold-200/30'
            style={{
              left: `${15 + i * 20}%`,
              top: `${20 + i * 15}%`,
            }}
          >
            <Heart className='w-8 h-8 fill-current' />
          </motion.div>
        ))}
      </motion.div>

      <div className='max-w-5xl mx-auto relative'>
        {/* Header with Scroll Animation */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className='text-center mb-20'
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: 'spring' }}
            className='flex items-center justify-center gap-3 mb-4'
          >
            <Heart className='w-5 h-5 text-rose-400 fill-rose-400' />
            <span className='text-gold-600 text-xs uppercase tracking-[0.4em] font-medium'>
              Our Love Story
            </span>
            <Heart className='w-5 h-5 text-rose-400 fill-rose-400' />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className='font-display text-4xl md:text-6xl text-charcoal-900 mb-4'
          >
            The Journey to I Do
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className='text-charcoal-500 text-sm max-w-lg mx-auto'
          >
            From a summer job to forever. Here&apos;s how our story unfolded.
          </motion.p>
        </motion.div>

        {/* Timeline Container */}
        <div className='relative z-10'>
          {/* Background Line - Behind cards */}
          <div className='absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gold-200/30 md:-translate-x-1/2 rounded-full z-0' />

          {/* Animated Progress Line - Behind cards */}
          <motion.div
            style={{ height: lineHeight }}
            className='absolute left-4 md:left-1/2 top-0 w-1 bg-gradient-to-b from-gold-400 via-gold-500 to-rose-400 md:-translate-x-1/2 rounded-full origin-top z-0'
          />

          {/* Progress Indicator - Above cards */}
          <motion.div
            style={{ top: progressY }}
            className='absolute left-4 md:left-1/2 -translate-x-1/2 z-[70] hidden md:block'
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className='w-6 h-6 bg-white rounded-full shadow-lg border-4 border-gold-500 flex items-center justify-center'
            >
              <Heart className='w-2.5 h-2.5 text-rose-500 fill-rose-500' />
            </motion.div>
          </motion.div>

          {/* Mobile Progress Dot */}
          <motion.div
            style={{ top: progressY }}
            className='absolute left-4 -translate-x-1.5 z-[70] md:hidden'
          >
            <div className='w-4 h-4 bg-gold-500 rounded-full border-2 border-white shadow-md' />
          </motion.div>

          {/* Events - Above timeline elements */}
          <div className='relative z-10 space-y-16 md:space-y-24 pb-12'>
            {timelineEvents.map((event, index) => (
              <TimelineCard key={event.id} event={event} index={index} />
            ))}
            <FilmCTACard />
          </div>
        </div>
      </div>
    </section>
  )
}
