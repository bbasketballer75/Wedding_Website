import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CalendarHeart, ChevronRight } from 'lucide-react'
import { AnniversaryCountdown } from '@/components/sections/AnniversaryCountdown'
import { fetchPublishedAnniversaryEntries, fetchWeddingDayPhotos } from '@/lib/supabase'
import type { AnniversaryEntry, Photo } from '@/lib/supabase'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { SEOHead } from '@/components/seo/SEOHead'
import { cn } from '@/lib/utils'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function Anniversary() {
  const [entries, setEntries] = useState<AnniversaryEntry[]>([])
  const [weddingPhotos, setWeddingPhotos] = useState<Photo[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [loadingPhotos, setLoadingPhotos] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    let mounted = true
    async function loadEntries() {
      try {
        const data = await fetchPublishedAnniversaryEntries()
        if (mounted) setEntries(data)
      } finally {
        if (mounted) setLoadingEntries(false)
      }
    }
    async function loadPhotos() {
      try {
        const data = await fetchWeddingDayPhotos(8)
        if (mounted) setWeddingPhotos(data)
      } finally {
        if (mounted) setLoadingPhotos(false)
      }
    }
    void loadEntries()
    void loadPhotos()
    return () => {
      mounted = false
    }
  }, [])

  const lightboxPhotos = weddingPhotos.map((p) => ({
    id: p.id,
    url: p.url,
    caption: p.caption,
  }))

  return (
    <div className="min-h-screen bg-cream-50">
      <SEOHead
        title="Anniversary — Austin & Jordyn's Wedding"
        description="Celebrating each year together. Our anniversary countdown, year-by-year memories, and photos from our wedding day."
        canonical="https://www.theporadas.com/anniversary"
      />

      {/* Countdown hero */}
      <AnniversaryCountdown />

      {/* Year cards */}
      <section className="px-4 pb-16 sm:pb-24">
        <div className="mx-auto max-w-3xl">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="mb-10 flex items-center gap-3"
          >
            <CalendarHeart className="h-5 w-5 text-gold-500 shrink-0" />
            <h2 className="font-display text-2xl text-charcoal-800 sm:text-3xl">
              Year by year
            </h2>
          </motion.div>

          {loadingEntries ? (
            <div className="space-y-6">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-charcoal-200/40 bg-cream-100/60 p-8"
                >
                  <div className="mb-3 h-3 w-16 rounded-full bg-gold-200/60" />
                  <div className="mb-4 h-7 w-2/3 rounded-lg bg-charcoal-200/40" />
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-charcoal-200/30" />
                    <div className="h-4 w-4/5 rounded bg-charcoal-200/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-charcoal-400 text-center py-12">
              Year memories will appear here as each anniversary passes.
            </p>
          ) : (
            <div className="space-y-8">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="relative overflow-hidden rounded-2xl border border-gold-200/50 bg-white shadow-sm"
                >
                  {/* Optional header photo */}
                  {entry.photo_url && (
                    <div className="h-48 overflow-hidden sm:h-56">
                      <img
                        src={entry.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="px-8 py-8 sm:px-10">
                    {/* Year badge */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-[0.22em] text-gold-600">
                        {ordinal(entry.year_number)} anniversary
                      </span>
                    </div>

                    <h3 className="font-display text-2xl text-charcoal-800 sm:text-3xl mb-4 leading-snug">
                      {entry.title}
                    </h3>

                    {entry.summary && (
                      <p className="text-charcoal-600 leading-relaxed max-w-prose mb-6">
                        {entry.summary}
                      </p>
                    )}

                    {/* Couple message pull-quote */}
                    {entry.couple_message && (
                      <div className="mt-4 border-t border-gold-100 pt-6">
                        <div className="font-display text-5xl text-gold-300 leading-none mb-1">
                          &ldquo;
                        </div>
                        <p className="font-display text-lg italic text-charcoal-700 leading-relaxed max-w-prose">
                          {entry.couple_message}
                        </p>
                        <p className="mt-3 text-sm text-charcoal-400">
                          &mdash; Austin &amp; Jordyn
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* On this day — Wedding Day photo strip */}
      {!loadingPhotos && weddingPhotos.length > 0 && (
        <section className="px-4 pb-20 sm:pb-28">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="mb-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-gold-600">
                  On this day
                </span>
              </div>
              <a
                href="/gallery?collection=Wedding+Day"
                className={cn(
                  'flex items-center gap-1 text-sm text-charcoal-500 hover:text-gold-600 transition-colors'
                )}
              >
                See all
                <ChevronRight className="h-4 w-4" />
              </a>
            </motion.div>

            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {weddingPhotos.map((photo, i) => (
                <motion.button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    setLightboxIndex(i)
                    setLightboxOpen(true)
                  }}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="relative shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                  aria-label={`View wedding day photo ${i + 1}`}
                >
                  <img
                    src={photo.thumbnail || photo.url}
                    alt=""
                    className="h-48 w-36 object-cover hover:opacity-90 transition-opacity sm:h-56 sm:w-44"
                    loading="lazy"
                  />
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Lightbox for wedding day photos */}
      {lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}
