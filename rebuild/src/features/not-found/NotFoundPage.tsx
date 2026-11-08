import { ArrowLeft, Heart, Home } from 'lucide-react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { Button, ButtonLink } from '@/shared/ui/Button'

/**
 * 404 page. Copy and structural classes are ported from the frozen
 * `src/pages/NotFound.tsx` (the motion wrapper's final state is irrelevant to
 * screenshot parity, which disables animations).
 */
export function NotFoundPage() {
  usePageMeta({
    title: 'Page Not Found',
    description: 'This page could not be found.',
    canonical: '/404',
    noIndex: true,
  })

  return (
    <div className='flex min-h-screen items-center justify-center bg-cream-50 px-4'>
      <div className='max-w-lg text-center'>
        <div className='mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gold-100'>
          <Heart className='h-12 w-12 text-gold-500' aria-hidden='true' />
        </div>

        <h1 className='mb-4 font-display text-8xl text-charcoal-900'>404</h1>
        <h2 className='mb-4 font-display text-3xl text-charcoal-800'>Page Not Found</h2>

        <p className='mb-8 text-lg leading-relaxed text-charcoal-600'>
          Oops! It seems this page wandered off like a wedding guest looking for the open bar.
          Let&apos;s get you back to the celebration!
        </p>

        <div className='flex flex-col justify-center gap-4 sm:flex-row'>
          <Button size='lg' onClick={() => window.history.back()}>
            <ArrowLeft className='mr-2 h-4 w-4' aria-hidden='true' />
            Go Back
          </Button>
          <ButtonLink to='/' size='lg' variant='secondary'>
            <Home className='mr-2 h-4 w-4' aria-hidden='true' />
            Back to Home
          </ButtonLink>
        </div>

        <div className='mt-12 flex justify-center gap-4 opacity-50'>
          {[0, 1, 2].map(index => (
            <div key={index} className='h-2 w-2 rounded-full bg-gold-400' />
          ))}
        </div>
      </div>
    </div>
  )
}
