import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ChevronLeft, ChevronRight, Heart, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { mediaPaths } from '@/shared/data/media'
import { cn } from '@/shared/lib/cn'
import type { HomeGuestPhoto, HomeGuestQuote } from '../useHomeContent'

const QUOTE_INTERVAL_MS = 5000

export interface GuestHighlightReelProps {
  photos: HomeGuestPhoto[]
  quotes: HomeGuestQuote[]
  loading: boolean
}

/**
 * Frozen `src/components/sections/GuestHighlightReel.tsx`, made presentational:
 * the frozen Supabase fetch lives behind `useHomeContent` (TODO Wave 3) and is
 * passed in as `photos`/`quotes`/`loading`. Empty/loading data hides the whole
 * section exactly like the frozen component did. Markup, classes, carousel and
 * quote-rotation behavior are otherwise verbatim.
 */
export function GuestHighlightReel({ photos, quotes, loading }: GuestHighlightReelProps) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [photoIndex, setPhotoIndex] = useState(0)

  useEffect(() => {
    if (quotes.length < 2) return
    const id = setInterval(() => {
      setQuoteIndex(i => (i + 1) % quotes.length)
    }, QUOTE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [quotes.length])

  if (loading) return null
  if (photos.length === 0 && quotes.length === 0) return null

  const currentQuote = quotes[quoteIndex]

  return (
    <section className='py-16 sm:py-24 px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className='mx-auto max-w-4xl'
      >
        <div className='text-center mb-10'>
          <div className='flex items-center justify-center gap-2 mb-3'>
            <Camera className='h-4 w-4 text-gold-500' />
            <p className='text-sm uppercase tracking-[0.2em] text-charcoal-500'>
              Memories from our guests
            </p>
          </div>
          <h2 className='font-display text-2xl text-charcoal-800 sm:text-3xl'>
            You were there with us
          </h2>
        </div>

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className='mb-10'>
            {/* Mobile: single photo with nav */}
            <div className='sm:hidden relative'>
              <AnimatePresence mode='wait'>
                <motion.div
                  key={photoIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className='aspect-[4/3] overflow-hidden rounded-2xl bg-charcoal-100'
                >
                  <img
                    src={mediaPaths.getMediaPath(
                      photos[photoIndex]?.thumbnail || photos[photoIndex]?.url || ''
                    )}
                    alt={photos[photoIndex]?.caption || 'Wedding photo'}
                    className='h-full w-full object-cover'
                    loading='lazy'
                  />
                </motion.div>
              </AnimatePresence>
              {photos.length > 1 && (
                <div className='mt-3 flex items-center justify-center gap-4'>
                  <button
                    onClick={() => setPhotoIndex(i => (i - 1 + photos.length) % photos.length)}
                    className='rounded-full p-1.5 text-charcoal-600 hover:bg-cream-200 transition-colors'
                    aria-label='Previous photo'
                  >
                    <ChevronLeft className='h-5 w-5' />
                  </button>
                  <span className='text-xs text-charcoal-400'>
                    {photoIndex + 1} / {photos.length}
                  </span>
                  <button
                    onClick={() => setPhotoIndex(i => (i + 1) % photos.length)}
                    className='rounded-full p-1.5 text-charcoal-600 hover:bg-cream-200 transition-colors'
                    aria-label='Next photo'
                  >
                    <ChevronRight className='h-5 w-5' />
                  </button>
                </div>
              )}
            </div>

            {/* Desktop: grid */}
            <div className='hidden sm:grid sm:grid-cols-3 gap-3'>
              {photos.slice(0, 6).map((photo, i) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={cn(
                    'overflow-hidden rounded-xl bg-charcoal-100',
                    i === 0 ? 'col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'
                  )}
                >
                  <img
                    src={mediaPaths.getMediaPath(photo.thumbnail || photo.url)}
                    alt={photo.caption || 'Wedding photo'}
                    className='h-full w-full object-cover transition-transform duration-500 hover:scale-105'
                    loading='lazy'
                  />
                </motion.div>
              ))}
            </div>

            <div className='mt-4 text-center'>
              <Link
                to='/gallery'
                className='text-sm font-medium text-gold-600 hover:text-gold-700 underline-offset-2 hover:underline'
              >
                View the full gallery →
              </Link>
            </div>
          </div>
        )}

        {/* Rotating quote */}
        {currentQuote && (
          <div className='relative mx-auto max-w-xl rounded-2xl border border-gold-200/60 bg-gradient-to-br from-cream-50 to-gold-50/40 px-6 py-8 text-center'>
            <MessageCircle className='mx-auto mb-4 h-5 w-5 text-gold-400' />
            <AnimatePresence mode='wait'>
              <motion.blockquote
                key={quoteIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className='text-charcoal-700 italic leading-relaxed'
              >
                &quot;{currentQuote.content}&quot;
              </motion.blockquote>
            </AnimatePresence>
            <p className='mt-3 text-sm text-charcoal-500'>— {currentQuote.name}</p>
            {quotes.length > 1 && (
              <div className='mt-4 flex justify-center gap-1.5'>
                {quotes.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setQuoteIndex(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i === quoteIndex ? 'w-4 bg-gold-500' : 'w-1.5 bg-gold-300'
                    )}
                    aria-label={`View quote ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <div className='mt-4'>
              <Link
                to='/guestbook'
                className='inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-700 underline-offset-2 hover:underline'
              >
                <Heart className='h-3.5 w-3.5' />
                Read the guestbook
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </section>
  )
}
