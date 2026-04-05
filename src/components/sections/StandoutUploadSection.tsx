import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ImageIcon, ArrowRight } from 'lucide-react'
import { fetchSiteEditorialFeatureBySlot } from '@/lib/supabase'
import type { SiteEditorialFeature } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function StandoutUploadSection() {
  const [feature, setFeature] = useState<SiteEditorialFeature | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await fetchSiteEditorialFeatureBySlot('home_newest_standout_upload')
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
        <div className='relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/60 via-cream-50 to-gold-50/40 px-8 py-10 sm:px-12 sm:py-14 shadow-sm'>
          {/* Warm photo-toned background accent */}
          <div
            className='pointer-events-none absolute inset-0 opacity-25'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse 55% 45% at 20% 100%, rgba(200,150,60,0.22), transparent)',
            }}
          />

          <div className='relative'>
            {/* Badge */}
            <div className='mb-4 flex items-center gap-2'>
              <ImageIcon className='h-3.5 w-3.5 text-amber-600' />
              <span className='text-xs font-medium uppercase tracking-[0.22em] text-amber-700'>
                {feature.badge_label ?? 'Guest Spotlight'}
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
                  {feature.cta_label ?? 'View in gallery'}
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
