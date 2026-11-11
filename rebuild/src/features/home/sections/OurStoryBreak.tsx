import { motion } from 'framer-motion'

/**
 * Frozen "Our Story" cinematic act break (`src/pages/Home.tsx` lines 214-256):
 * same copy, class strings, viewport amounts and motion timings.
 */
export function OurStoryBreak() {
  return (
    <section className='relative overflow-hidden bg-charcoal-900 py-20 sm:py-28'>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1.4 }}
        className='mx-auto max-w-2xl px-4 text-center'
      >
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeInOut' }}
          className='mx-auto mb-8 h-px w-16 origin-center bg-gold-500/40'
        />
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className='font-script mb-3 text-5xl text-candle-100/90 sm:text-6xl'
        >
          Our Story
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.8 }}
          className='text-[11px] uppercase tracking-[0.3em] text-gold-400/55'
        >
          May 10, 2025 · Shared with love
        </motion.p>
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6, ease: 'easeInOut' }}
          className='mx-auto mt-8 h-px w-16 origin-center bg-gold-500/40'
        />
      </motion.div>
    </section>
  )
}
