import { motion } from 'framer-motion'

/**
 * PageLoader - Displays while lazy-loaded pages are being fetched
 * Used as Suspense fallback for code-split routes
 */
export function PageLoader() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-cream-50'>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className='text-center'
      >
        <div className='relative w-16 h-16 mx-auto mb-4'>
          <motion.div
            className='absolute inset-0 border-4 border-gold-200 rounded-full'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <motion.div
            className='absolute inset-0 border-4 border-gold-500 rounded-full border-t-transparent'
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>
        <p className='text-charcoal-500 text-sm'>Loading...</p>
      </motion.div>
    </div>
  )
}

export default PageLoader
