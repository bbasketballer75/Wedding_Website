/**
 * Parent-dances section: heading copy + the four cards, ported from the frozen
 * `src/pages/Film.tsx`.
 */
import { motion } from 'framer-motion'
import { FAMILY_FILMS, type FamilyFilm } from '../filmContent'
import { ParentDanceCard } from './ParentDance'

export interface ParentDancesSectionProps {
  onOpen: (film: FamilyFilm) => void
}

export function ParentDancesSection({ onOpen }: ParentDancesSectionProps) {
  return (
    <section className='px-4 pt-10 pb-16 sm:pt-12 lg:pt-14'>
      <div className='mx-auto max-w-6xl'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className='mb-6 max-w-3xl sm:mb-7'
        >
          <span className='eyebrow-chip'>Parent dances</span>
          <h2 className='mt-4 text-3xl text-charcoal-900 sm:text-4xl'>Watch the parent dances.</h2>
          <p className='mt-3 text-base text-charcoal-600 sm:text-lg'>
            These four clips are here on their own so you can go straight to the parent dances
            whenever you want to revisit them.
          </p>
        </motion.div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {FAMILY_FILMS.map((film, index) => (
            <motion.div
              key={film.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className='min-w-0'
            >
              <ParentDanceCard film={film} onOpen={onOpen} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
