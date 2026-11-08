/**
 * Family-and-friends section wrapper, ported from the frozen
 * `src/pages/Film.tsx` (heading panel + the tree inside its own panel).
 */
import { motion } from 'framer-motion'
import { FamilyTree } from './family-tree/FamilyTree'

export function FilmFamilyTreeSection() {
  return (
    <section className='px-4 pb-10'>
      <div className='mx-auto max-w-6xl'>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
        >
          <div className='editorial-panel px-6 py-6 sm:px-8'>
            <span className='eyebrow-chip'>Meet the family and friends</span>
            <h2 className='mt-5 text-4xl text-charcoal-900 sm:text-5xl'>
              The people who held the day together.
            </h2>
            <p className='mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg'>
              Before you hit play, take a moment to meet the family and friends woven into every
              chapter of the film. It makes the speeches, reactions, and little glances land even
              harder.
            </p>
          </div>

          <div className='mt-5 editorial-panel px-2 py-4 sm:px-4'>
            <FamilyTree />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
