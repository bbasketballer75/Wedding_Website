import ChapterTitle from '@/components/ui/ChapterTitle'
import { motion } from 'framer-motion'
import React, { useRef } from 'react'

export interface Milestone {
  year: string
  title: string
  description: string
}

const DEFAULT_MILESTONES: Milestone[] = [
  {
    year: '2018',
    title: 'The First Hello',
    description:
      'A chance encounter that would change everything. Our eyes met across a crowded room.',
  },
  {
    year: '2019',
    title: 'Falling in Love',
    description:
      'From late-night conversations to early morning coffees, every moment felt like magic.',
  },
  {
    year: '2023',
    title: 'The Question',
    description: 'Under a canopy of stars, one question started our forever.',
  },
  {
    year: '2025',
    title: 'The Big Day',
    description: 'We tied the knot surrounded by the people we love most.',
  },
]

interface StoryTimelineProps {
  id?: string
  milestones?: Milestone[]
  showTopConnector?: boolean
  showBottomConnector?: boolean
  showHeader?: boolean
}

const StoryTimeline: React.FC<StoryTimelineProps> = React.memo(
  ({
    id,
    milestones = DEFAULT_MILESTONES,
    showTopConnector = false,
    showBottomConnector = false,
    showHeader = true,
  }) => {
    const containerRef = useRef<HTMLDivElement>(null)

    return (
      <section
        id={id}
        className='bg-cream-50 pt-12 pb-16 contain-layout relative overflow-hidden scroll-mt-24'
      >
        {/* Background Texture - Performance Hint */}
        <div className='absolute inset-0 opacity-[0.02] pointer-events-none will-change-transform' style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

        <div ref={containerRef} className='w-full relative z-10'>
          {/* Chapter Header */}
          {showHeader && (
            <ChapterTitle
              chapter='Chapter One'
              title='Our Story'
              subtitle='Every love story is beautiful, but ours is our favorite.'
              theme='light'
            />
          )}

          {/* Timeline Container */}
          <div className='max-w-[1000px] mx-auto relative px-4'>
            {/* Top Connector Line */}
            {showTopConnector && (
              <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-script text-[15rem] md:text-[20rem] whitespace-nowrap pointer-events-none -z-10 will-change-opacity' />
            )}

            {/* Timeline Content Wrapper */}
            <div className='relative'>
              {/* Milestones */}
              {milestones.map((milestone, index) => {
                const isLeft = index % 2 === 0
                const isLast = index === milestones.length - 1

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3, margin: '-50px' }}
                    transition={{
                      duration: 1,
                      delay: index * 0.15,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`flex pb-16 relative w-full justify-end group ${
                      isLeft ? 'md:justify-start' : 'md:justify-end'
                    }`}
                  >
                    {/* Connector Line to Next Item */}
                    {!isLast && (
                      <div className='absolute left-1/2 top-10 w-px bg-linear-to-b from-gold-400/30 via-gold-300/20 to-transparent -translate-x-1/2 z-0 h-full' />
                    )}

                    {/* Timeline Dot */}
                    <div className='absolute top-10 left-1/2 -translate-x-1/2 z-10'>
                      <div className='w-5 h-5 bg-gold-500 rounded-full shadow-[0_0_25px_rgba(198,156,78,0.8)] ring-4 ring-cream-50 relative transition-transform duration-500 group-hover:scale-125'>
                        <div className='absolute inset-0 rounded-full animate-ping bg-gold-400/40' />
                      </div>
                    </div>

                    {/* Card */}
                    <div
                      className={`
                          w-full max-w-[500px] md:w-[45%] flex-none
                          relative overflow-hidden rounded-2xl
                          bg-white/80 border border-white/60 shadow-glass
                          p-8 md:p-12
                          transform transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(198,156,78,0.15)]
                          group-hover:border-gold-200/50
                          will-change-transform
                          ${isLeft ? 'md:mr-auto md:text-right' : 'md:ml-auto md:text-left'}
                        `}
                    >
                      {/* Smooth highlight gradient */}
                      <div className='absolute inset-0 bg-linear-to-br from-white/80 via-transparent to-transparent opacity-50 pointer-events-none' />

                      <span className='relative block text-sm font-display font-medium tracking-[0.4em] uppercase text-gold-600 mb-4'>
                        {milestone.year}
                      </span>
                      <h3 className='relative font-display text-4xl md:text-5xl text-dark-900 leading-[0.9] mb-5 tracking-tight'>
                        {milestone.title}
                      </h3>
                      <p className='relative font-body font-light text-lg md:text-xl leading-relaxed text-dark-800/80 tracking-wide'>
                        {milestone.description}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Bottom Connector Line */}
            {showBottomConnector && (
              <div className='absolute -bottom-24 left-1/2 -translate-x-1/2 w-px h-24 bg-linear-to-b from-gold-400/50 via-gold-300 to-transparent z-0 shadow-[0_0_15px_rgba(198,156,78,0.3)]' />
            )}
          </div>
        </div>
      </section>
    )
  }
)

StoryTimeline.displayName = 'StoryTimeline'

export default StoryTimeline
