import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, ArrowRight } from 'lucide-react'
import { fetchSiteEditorialFeatureBySlot } from '@/lib/supabase'
import type { SiteEditorialFeature } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

export function FilmFeatureSection() {
  const [feature, setFeature] = useState<SiteEditorialFeature | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await fetchSiteEditorialFeatureBySlot('film_featured_guest_video')
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
      <section className='py-10 px-4'>
        <div className='mx-auto max-w-6xl'>
          <div className='animate-pulse rounded-2xl bg-charcoal-800/40 p-8 sm:p-12'>
            <div className='mb-3 h-3 w-24 rounded-full bg-white/10' />
            <div className='mb-4 h-7 w-2/3 rounded-lg bg-white/10' />
            <div className='space-y-2'>
              <div className='h-4 w-full rounded bg-white/8' />
              <div className='h-4 w-4/5 rounded bg-white/8' />
            </div>
            <div className='mt-6 h-10 w-40 rounded-full bg-white/10' />
          </div>
        </div>
      </section>
    )
  }

  if (!feature) return null

  return (
    <section className='py-10 px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className='mx-auto max-w-6xl'
      >
        <div className='relative overflow-hidden rounded-2xl bg-charcoal-800/90 px-8 py-10 sm:px-12 sm:py-14 shadow-lg'>
          {/* Cinematic warm-light accent */}
          <div
            className='pointer-events-none absolute inset-0 opacity-20'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,180,92,0.35), transparent)',
            }}
          />

          <div className='relative'>
            {/* Badge */}
            <div className='mb-4 flex items-center gap-2'>
              <Play className='h-3.5 w-3.5 fill-gold-400 text-gold-400' />
              <span className='text-xs font-medium uppercase tracking-[0.22em] text-gold-400'>
                {feature.badge_label ?? 'Guest Film Spotlight'}
              </span>
            </div>

            {/* Title */}
            <h2 className='font-display text-2xl text-white sm:text-3xl mb-4 leading-snug'>
              {feature.title}
            </h2>

            {/* Summary */}
            {feature.summary && (
              <p className='text-white/70 leading-relaxed mb-8 max-w-prose'>
                {feature.summary}
              </p>
            )}

            {/* CTA */}
            {feature.source_url && (
              <a href={feature.source_url} target='_blank' rel='noopener noreferrer'>
                <Button variant='glass' size='md' className='group gap-2'>
                  {feature.cta_label ?? 'Watch clip'}
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
