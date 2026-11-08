import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/shared/ui'
import { EditorialErrorBanner } from './EditorialErrorBanner'
import type { EditorialSlotProps } from './MomentOfTheWeekSection'

export const FEATURED_NOTE_SLOT = 'home_featured_guestbook_note'

/**
 * Frozen `src/components/sections/FeaturedNoteSection.tsx`, made presentational
 * (data behind `useHomeContent`, TODO Wave 3): rotating featured guestbook note
 * with decorative quote mark and ghost CTA. States and class strings verbatim.
 */
export function FeaturedNoteSection({ feature, loading, error }: EditorialSlotProps) {
  if (loading) {
    return (
      <section className='py-16 sm:py-24 px-4'>
        <div className='mx-auto max-w-2xl'>
          <div className='space-y-4 text-center'>
            <div className='skeleton-light mx-auto h-12 w-8 rounded' />
            <div className='skeleton-light mx-auto h-7 w-4/5 rounded-lg' />
            <div className='skeleton-light mx-auto h-6 w-3/5 rounded-lg' />
            <div className='skeleton-light mx-auto h-4 w-32 rounded-full' />
          </div>
        </div>
      </section>
    )
  }

  if (error) return <EditorialErrorBanner slot={FEATURED_NOTE_SLOT} errorMessage={error} />
  if (!feature) return null

  return (
    <section className='py-16 sm:py-24 px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className='mx-auto max-w-2xl text-center'
      >
        {/* Decorative opening quote */}
        <div
          className='font-display text-7xl leading-none text-gold-300 select-none mb-2'
          aria-hidden='true'
        >
          &ldquo;
        </div>

        {/* Quote text (summary field) */}
        {feature.summary && (
          <p className='font-display text-xl sm:text-2xl text-charcoal-700 italic leading-relaxed mb-4 max-w-prose mx-auto'>
            {feature.summary}
          </p>
        )}

        {/* Attribution (title field) */}
        <p className='text-sm font-medium text-charcoal-500 tracking-wide mb-8'>
          &mdash;&nbsp;{feature.title}
        </p>

        {/* CTA */}
        {feature.source_url && (
          <a href={feature.source_url} target='_blank' rel='noopener noreferrer'>
            <Button variant='ghost' size='md' className='group gap-2'>
              {feature.cta_label ?? 'Read in guestbook'}
              <ArrowRight className='h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          </a>
        )}
      </motion.div>
    </section>
  )
}
