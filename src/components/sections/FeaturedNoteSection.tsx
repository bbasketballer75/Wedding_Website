import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { fetchSiteEditorialFeatureBySlot } from '@/lib/supabase'
import type { SiteEditorialFeature } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

// Self-contained error banner - defined locally to prevent Vite/rolldown
// DCE-eliminating the import-only component from production bundles.
function InlineEditorialErrorBanner({
  slot,
  errorMessage,
}: {
  slot: string
  errorMessage: string | null
}) {
  if (!errorMessage) return null
  return (
    <section className='py-8 px-4' data-testid={`editorial-error-${slot}`}>
      <div
        className='mx-auto max-w-2xl rounded-lg border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-900'
        role='status'
      >
        <p className='font-medium'>Content unavailable</p>
        <p className='mt-1 text-amber-800/90'>
          The &ldquo;{slot}&rdquo; slot couldn&rsquo;t load ({errorMessage}).&nbsp; If you see this
          on the live site, check the Netlify environment variables for &nbsp;
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
    </section>
  )
}

export function FeaturedNoteSection() {
  const [feature, setFeature] = useState<SiteEditorialFeature | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data, error: fetchError } = await fetchSiteEditorialFeatureBySlot(
        'home_featured_guestbook_note'
      )
      if (!mounted) return
      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }
      setFeature(data && data.is_active ? data : null)
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <section className='py-16 sm:py-24 px-4'>
        <div className='mx-auto max-w-2xl'>
          <div className='space-y-4 text-center'>
            <div className='skeleton-light mx-auto h-12 w-8 rounded' />
            <div className='skeleton-light mx-auto h-7 w-4/5 rounded-lg' />
            <div className='skeleton-light mx-auto h-6 w-3/5 rounded-lg' />
            <div className='skeleton-light mx-auto h-4 w-32 rounded-full' />
          </div>
        </div>
      </section>
    )
  }

  if (error)
    return <InlineEditorialErrorBanner slot='home_featured_guestbook_note' errorMessage={error} />
  if (!feature) return null

  return (
    <section className='py-16 sm:py-24 px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className='mx-auto max-w-2xl text-center'
      >
        {/* Decorative opening quote */}
        <div
          className='font-display text-7xl leading-none text-gold-300 select-none mb-2'
          aria-hidden='true'
        >
          &ldquo;
        </div>

        {/* Quote text (summary field) */}
        {feature.summary && (
          <p className='font-display text-xl sm:text-2xl text-charcoal-700 italic leading-relaxed mb-4 max-w-prose mx-auto'>
            {feature.summary}
          </p>
        )}

        {/* Attribution (title field) */}
        <p className='text-sm font-medium text-charcoal-500 tracking-wide mb-8'>
          &mdash;&nbsp;{feature.title}
        </p>

        {/* CTA */}
        {feature.source_url && (
          <a href={feature.source_url} target='_blank' rel='noopener noreferrer'>
            <Button variant='ghost' size='md' className='group gap-2'>
              {feature.cta_label ?? 'Read in guestbook'}
              <ArrowRight className='h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          </a>
        )}
      </motion.div>
    </section>
  )
}
