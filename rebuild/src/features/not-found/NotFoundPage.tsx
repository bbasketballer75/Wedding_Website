import { motion } from 'framer-motion'
import { ArrowLeft, Heart, Home } from 'lucide-react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { Button, ButtonLink } from '@/shared/ui/Button'

/**
 * 404 page. Structure, copy, motion values and class strings are ported from
 * the frozen `src/pages/NotFound.tsx`; the only adaptations are TanStack
 * `Link` (through `ButtonLink`) and `window.history.back()` replacing
 * react-router's `navigate(-1)`.
 */
export function NotFoundPage() {
  usePageMeta({
    title: 'Page Not Found',
    description: 'This page could not be found.',
    canonical: '/404',
    image: '/images/home/intro-video-poster.png',
    noIndex: true,
  })

  return (
    <div className='min-h-screen bg-cream-50 flex items-center justify-center px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className='text-center max-w-lg'
      >
        {/* Decorative Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className='w-24 h-24 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-8'
        >
          <Heart className='w-12 h-12 text-gold-500' aria-hidden='true' />
        </motion.div>

        {/* 404 Text */}
        <h1 className='font-display text-8xl text-charcoal-900 mb-4'>404</h1>

        <h2 className='font-display text-3xl text-charcoal-800 mb-4'>Page Not Found</h2>

        <p className='text-charcoal-600 text-lg mb-8 leading-relaxed'>
          Oops! It seems this page wandered off like a wedding guest looking for the open bar.
          Let&apos;s get you back to the celebration!
        </p>

        {/* Action Buttons */}
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button size='lg' onClick={() => window.history.back()}>
            <ArrowLeft className='w-4 h-4 mr-2' aria-hidden='true' />
            Go Back
          </Button>
          <ButtonLink to='/' size='lg' variant='secondary'>
            <Home className='w-4 h-4 mr-2' aria-hidden='true' />
            Back to Home
          </ButtonLink>
        </div>

        {/* Decorative Elements */}
        <div className='mt-12 flex justify-center gap-4 opacity-50'>
          <div className='w-2 h-2 rounded-full bg-gold-400' />
          <div className='w-2 h-2 rounded-full bg-gold-400' />
          <div className='w-2 h-2 rounded-full bg-gold-400' />
        </div>
      </motion.div>
    </div>
  )
}
