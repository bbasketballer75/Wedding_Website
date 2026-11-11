import { motion, useScroll, useTransform } from 'framer-motion'
import { Calendar, MapPin, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { mediaPaths } from '@/shared/data/media'
import { cn } from '@/shared/lib/cn'
import { ImageCarousel } from './ImageCarousel'
import { LocationMap } from './LocationMap'
import { TimelineIcon } from './TimelineIcon'
import { getImagePaths, type TimelineEvent } from './timelineContent'

export const DESCRIPTION_TRUNCATE_THRESHOLD = 120

export interface StandardTimelineCardProps {
  event: TimelineEvent
  index: number
}

/**
 * Frozen `StandardTimelineCard` (`src/components/timeline/LoveTimeline.tsx`
 * lines 496-681): scroll-linked card (opacity/scale/x), media tile (map /
 * carousel / icon), date badge, title, truncate-at-120 description with
 * Read more/less, location, timeline dot + pulse ring and center connector.
 * All class strings, thresholds and motion values are verbatim.
 */
export function StandardTimelineCard({ event, index }: StandardTimelineCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const descIsLong = event.description.length > DESCRIPTION_TRUNCATE_THRESHOLD

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

  const carouselImages = useMemo(() => {
    if (event.media?.type !== 'carousel') return []
    const config = event.media.config as { folder: string; count: number }
    return getImagePaths(config.folder, config.count, mediaPaths.getMediaPath)
  }, [event.media])

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
        <div
          className={cn(
            'h-3 w-3 rounded-full border-2 border-white shadow-sm',
            event.date === 'May 10, 2025' ? 'bg-rose-500' : 'bg-gold-500'
          )}
        />
      </div>

      {/* Standard Card */}
      <motion.div
        whileHover={{
          y: -8,
          boxShadow: '0 25px 50px -12px rgba(198, 156, 78, 0.35)',
          borderColor: 'rgba(198, 156, 78, 0.6)',
        }}
        transition={{ duration: 0.3 }}
        className='relative bg-white rounded-2xl p-6 md:p-8 border border-gold-200/80 cursor-pointer group shadow-lg hover:shadow-xl hover:border-gold-300 transition-all duration-300'
      >
        {/* Animated Background Gradient */}
        <motion.div className='absolute inset-0 bg-gradient-to-br from-gold-50/80 via-transparent to-rose-50/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

        {/* Floating Particles on Hover */}
        <div className='absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
          <motion.div
            animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Sparkles className='w-4 h-4 text-gold-400' />
          </motion.div>
        </div>

        {/* Media Section */}
        {event.media && (
          <div className='mb-6'>
            {event.media.type === 'map' && (
              <LocationMap
                location={(event.media.config as { location: string }).location}
                type={(event.media.config as { type: 'town' | 'home' }).type}
              />
            )}
            {event.media.type === 'carousel' && (
              <ImageCarousel
                images={carouselImages}
                alt={(event.media.config as { alt: string }).alt}
                autoPlayInterval={3000}
              />
            )}
            {event.media.type === 'icon' && (
              <TimelineIcon
                type={
                  (
                    event.media.config as {
                      iconType: 'meeting' | 'first-date' | 'wedding' | 'generic'
                    }
                  ).iconType
                }
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className='relative z-10'>
          {/* Date Badge */}
          <motion.div className='flex items-center gap-2 mb-4' whileHover={{ scale: 1.05 }}>
            <span className='inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gold-100 text-gold-700 text-xs font-semibold tracking-wide'>
              <Calendar className='w-3 h-3' />
              {event.date}
            </span>
          </motion.div>

          {/* Title */}
          <h3 className='font-display text-2xl md:text-3xl text-charcoal-900 mb-3 group-hover:text-gold-600 transition-colors duration-300'>
            {event.title}
          </h3>

          {/* Description */}
          <div className='mb-4'>
            <p className='text-charcoal-600 text-sm md:text-base leading-relaxed'>
              {descIsLong && !descExpanded
                ? `${event.description.slice(0, DESCRIPTION_TRUNCATE_THRESHOLD).trimEnd()}…`
                : event.description}
            </p>
            {descIsLong && (
              <button
                type='button'
                onClick={() => setDescExpanded(prev => !prev)}
                className='mt-1.5 text-xs font-medium text-gold-600 hover:text-gold-700 transition-colors'
              >
                {descExpanded ? 'Read less' : 'Read more'}
              </button>
            )}
          </div>

          {/* Location */}
          {event.location && (
            <motion.div
              className='flex items-center gap-1.5 text-gold-600 text-xs font-medium'
              whileHover={{ x: 5 }}
            >
              <MapPin className='w-3 h-3' />
              <span>{event.location}</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Timeline Dot - Properly Aligned to Center */}
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
          className={cn(
            'relative w-5 h-5 rounded-full border-4 shadow-lg cursor-pointer transition-colors duration-300',
            event.date === 'May 10, 2025'
              ? 'bg-rose-500 border-white shadow-rose-300/50'
              : 'bg-gold-500 border-white shadow-gold-300/50'
          )}
        >
          {/* Pulse Ring */}
          <motion.div
            animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={cn(
              'absolute inset-0 rounded-full -z-10',
              event.date === 'May 10, 2025' ? 'bg-rose-400' : 'bg-gold-400'
            )}
          />
        </motion.div>
      </div>

      {/* Connecting Line from Card to Center */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-0.5 bg-gold-300/50 hidden md:block z-20',
          event.side === 'left' ? '-right-[60px] w-[60px]' : '-left-[60px] w-[60px]'
        )}
      />
    </motion.div>
  )
}
