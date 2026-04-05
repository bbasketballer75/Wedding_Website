import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { fetchSiteEditorialFeatureBySlot } from '@/lib/supabase'
import type { SiteEditorialFeature } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function FeaturedNoteSection() {
  const [feature, setFeature] = useState<SiteEditorialFeature | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await fetchSiteEditorialFeatureBySlot('home_featured_guestbook_note')
      if (!mounted) return
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
          <div className='animate-pulse space-y-4 text-center'>
            <div className='mx-auto h-12 w-8 rounded bg-gold-200/40' />
            <div className='mx-auto h-7 w-4/5 rounded-lg bg-charcoal-200/30' />
            <div className='mx-auto h-6 w-3/5 rounded-lg bg-charcoal-200/20' />
            <div className='mx-auto h-4 w-32 rounded-full bg-charcoal-200/30' />
          </div>
        </div>
      </section>
    )
  }

  if (!feature) return null

  return (
    <section className='py-16 sm:py-24 px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
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
