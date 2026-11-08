/**
 * Frozen loading and error states (`src/pages/GuestShare.tsx:219-269`).
 *
 * Loading: centered spinner + "Curating guest memories...".
 * Error: the invalid/network split with the frozen copy, "Try Again" only for
 * the network state, and the "Back to Gallery" escape hatch in both.
 *
 * A11y contract for Wave 6: the error `<h2>` receives focus on mount (the frozen
 * page left focus on `<body>` after a route transition), so keyboard and
 * screen-reader users land on the error immediately.
 */
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { GUEST_SHARE_COPY } from './constants'
import type { GuestShareErrorKind } from './types'

export function GuestShareLoadingState() {
  return (
    <div
      className='flex min-h-screen flex-col items-center justify-center bg-cream-50 pb-20 pt-28'
      role='status'
      aria-live='polite'
    >
      <Loader2 className='h-10 w-10 text-gold-500 animate-spin' aria-hidden='true' />
      <p className='mt-4 text-sm text-charcoal-500 font-sans'>{GUEST_SHARE_COPY.loadingMessage}</p>
    </div>
  )
}

export interface GuestShareErrorStateProps {
  kind: GuestShareErrorKind
  onRetry: () => void
}

export function GuestShareErrorState({ kind, onRetry }: GuestShareErrorStateProps) {
  const isNetwork = kind === 'network'
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4 pb-20 pt-28'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className='w-full max-w-md border border-gold-200 bg-white/90 p-8 rounded-2xl shadow-md text-center'
      >
        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-200 text-rose-500 mb-6'>
          <AlertCircle className='h-6 w-6' aria-hidden='true' />
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className='font-serif text-2xl font-semibold text-charcoal-900 mb-3 outline-none'
        >
          {isNetwork ? GUEST_SHARE_COPY.networkTitle : GUEST_SHARE_COPY.invalidTitle}
        </h2>
        <p className='text-sm text-charcoal-500 font-sans mb-8 leading-relaxed'>
          {isNetwork ? GUEST_SHARE_COPY.networkBody : GUEST_SHARE_COPY.invalidBody}
        </p>
        <div className='flex flex-col gap-3'>
          {isNetwork && (
            <button
              type='button'
              onClick={onRetry}
              className='inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-600 hover:bg-gold-700 text-white font-medium text-sm py-3 transition duration-200 shadow-sm'
            >
              {GUEST_SHARE_COPY.retry}
            </button>
          )}
          <Link
            to={GUEST_SHARE_COPY.galleryHref}
            className='inline-flex w-full items-center justify-center gap-2 rounded-full border border-gold-200 bg-white hover:bg-gold-50 text-charcoal-800 font-medium text-sm py-3 transition duration-200'
          >
            <ArrowLeft className='h-4 w-4' aria-hidden='true' />
            {GUEST_SHARE_COPY.backToGallery}
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
