import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import { fetchSiteEditorialFeatureBySlot } from '@/lib/supabase'
import type { SiteEditorialFeature } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function MomentOfTheWeekSection() {
  const [feature, setFeature] = useState<SiteEditorialFeature | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await fetchSiteEditorialFeatureBySlot('home_moment_of_the_week')
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
          <div className='animate-pulse rounded-2xl border border-gold-200/40 bg-cream-100/60 p-8 sm:p-12'>
            <div className='mb-3 h-3 w-20 rounded-full bg-gold-200/60' />
            <div className='mb-4 h-7 w-3/4 rounded-lg bg-charcoal-200/40' />
            <div className='space-y-2'>
              <div className='h-4 w-full rounded bg-charcoal-200/30' />
              <div className='h-4 w-5/6 rounded bg-charcoal-200/30' />
            </div>
            <div className='mt-6 h-10 w-36 rounded-full bg-gold-200/40' />
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
        className='mx-auto max-w-2xl'
      >
        <div className='relative overflow-hidden rounded-2xl border border-gold-200/60 bg-gradient-to-br from-cream-50 via-gold-50/30 to-cream-100/80 px-8 py-10 sm:px-12 sm:py-14 shadow-sm'>
          {/* Subtle background accent */}
          <div
            className='pointer-events-none absolute inset-0 opacity-30'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 80% 0%, rgba(180,140,50,0.18), transparent)',
            }}
          />

          <div className='relative'>
            {/* Badge */}
            <div className='mb-4 flex items-center gap-2'>
              <Sparkles className='h-3.5 w-3.5 text-gold-500' />
              <span className='text-xs font-medium uppercase tracking-[0.22em] text-gold-600'>
                {feature.badge_label ?? 'Moment of the Week'}
              </span>
            </div>

            {/* Title */}
            <h2 className='font-display text-2xl text-charcoal-800 sm:text-3xl mb-4 leading-snug'>
              {feature.title}
            </h2>

            {/* Summary */}
            {feature.summary && (
              <p className='text-charcoal-600 leading-relaxed mb-8 max-w-prose'>
                {feature.summary}
              </p>
            )}

            {/* CTA */}
            {feature.source_url && (
              <a href={feature.source_url} target='_blank' rel='noopener noreferrer'>
                <Button variant='secondary' size='md' className='group gap-2'>
                  {feature.cta_label ?? 'Explore this moment'}
                  <ArrowRight className='h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
