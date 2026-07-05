import { motion } from 'framer-motion'

/**
 * PageLoader - Displays while lazy-loaded pages are being fetched
 * Used as Suspense fallback for code-split routes
 */
export function PageLoader() {
  return (
    <div className='theme-canvas min-h-screen px-4 pt-28 sm:px-6 sm:pt-32'>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className='mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.85fr_1.15fr]'
        aria-label='Loading page'
        role='status'
      >
        <div className='theme-panel rounded-[1.5rem] p-5 sm:p-6'>
          <div className='theme-skeleton h-4 w-28 rounded-full' />
          <div className='theme-skeleton mt-8 h-16 w-4/5 rounded-2xl' />
          <div className='theme-skeleton mt-4 h-5 w-full rounded-full' />
          <div className='theme-skeleton mt-2 h-5 w-2/3 rounded-full' />
          <div className='mt-8 flex gap-3'>
            <div className='theme-skeleton h-11 w-32 rounded-full' />
            <div className='theme-skeleton h-11 w-11 rounded-full' />
          </div>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='theme-skeleton aspect-[4/5] rounded-[1.35rem]' />
          <div className='theme-skeleton hidden aspect-[4/5] rounded-[1.35rem] sm:block' />
        </div>
        <span className='sr-only'>Loading...</span>
      </motion.div>
    </div>
  )
}

export default PageLoader
