import { motion } from 'framer-motion'

interface ThankYouProps {
  className?: string
}

export const ThankYou = ({ className, ...props }: ThankYouProps) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`relative py-24 px-6 md:px-12 bg-cream-50 scroll-mt-24 border-b border-gold-200/20 ${className || ''}`}
      {...props}
    >
      <div className='max-w-4xl mx-auto text-center space-y-8'>
        <motion.h2
          className='font-display text-4xl md:text-6xl text-brand-dark'
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          Thank You
        </motion.h2>

        <motion.div
          className='prose prose-lg mx-auto text-brand-muted font-light italic leading-relaxed'
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p>To our dearest family and friends,</p>
          <p>
            Our hearts are overflowing with gratitude. Thank you for traveling near and far to
            celebrate our love, for the laughter that filled the air, and for the memories we will
            cherish forever. May 10th, 2025 was perfect because you were there.
          </p>
          <p className='font-header text-xl pt-4'>
            With love, <br /> Austin & Jordyn
          </p>
        </motion.div>
      </div>
    </motion.section>
  )
}
