/**
 * Guest-video highlights section, ported from the frozen `src/pages/Film.tsx`
 * guest-clip block: heading + memory-trail chips + card grid, and self-hide when
 * there are no clips.
 *
 * Frozen parity detail: the frozen page gated the whole section on
 * `guestHighlights.length > 0` (`src/pages/Film.tsx:431`), so nothing — not even
 * the skeleton block — rendered while the read was in flight or when it came
 * back empty. Wave 9 W9-4 keeps that exact gate; `isLoading` remains in the
 * props for the card-grid skeleton branch (used only with non-empty data, e.g.
 * optimistic fixtures/parity harness).
 */
import { motion } from 'framer-motion'
import { Smartphone } from 'lucide-react'
import { CardSkeleton } from '@/shared/ui/Skeleton'
import { MEMORY_TRAILS } from '../filmContent'
import type { FilmGuestClip } from './filmGuestClips'
import { GuestVideoHighlightCard } from './GuestVideoHighlight'

export interface GuestVideoHighlightsSectionProps {
  clips: readonly FilmGuestClip[]
  isLoading: boolean
  onOpen: (clip: FilmGuestClip) => void
}

export function GuestVideoHighlightsSection({
  clips,
  isLoading,
  onOpen,
}: GuestVideoHighlightsSectionProps) {
  if (clips.length === 0) {
    return null
  }

  return (
    <section className='px-4 pb-16'>
      <div className='mx-auto max-w-6xl'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className='mb-8 max-w-3xl'
        >
          <span className='eyebrow-chip'>
            <Smartphone className='h-3.5 w-3.5' />
            From your phones
          </span>
          <h2 className='mt-5 text-3xl text-charcoal-900 sm:text-4xl'>
            Guest angles, if you want the room back from another point of view.
          </h2>
          <p className='mt-4 text-base text-charcoal-600 sm:text-lg'>
            These are optional after the main film: quick table laughs, dance-floor blur, and the
            small in-between clips no single camera can catch from every side.
          </p>
          <div className='mt-5 flex flex-wrap gap-2'>
            {MEMORY_TRAILS.slice(0, 3).map(trail => (
              <span
                key={trail.id}
                className='rounded-full border border-gold-200/70 bg-white/76 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-gold-700'
              >
                {trail.label}
              </span>
            ))}
          </div>
        </motion.div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)
            : clips.map((clip, index) => (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.07 }}
                >
                  <GuestVideoHighlightCard clip={clip} onOpen={onOpen} />
                </motion.div>
              ))}
        </div>
      </div>
    </section>
  )
}
