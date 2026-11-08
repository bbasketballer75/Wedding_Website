/**
 * Film-page editorial spotlight, ported from the frozen
 * `src/components/sections/FilmFeatureSection.tsx`: skeleton while loading,
 * accessible `role=status` error banner when the slot read fails, nothing when
 * the slot is absent or inactive, otherwise the cinematic spotlight card.
 *
 * Data comes from the shared data layer (`useEditorialFeatures`), not a direct
 * Supabase call.
 */
import { motion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'
import { useEditorialFeatures } from '@/shared/data/hooks'
import { Button } from '@/shared/ui/Button'

const FILM_FEATURE_SLOT = 'film_featured_guest_video'

function InlineEditorialErrorBanner({ errorMessage }: { errorMessage: string | null }) {
  if (!errorMessage) return null
  return (
    <section className='py-8 px-4' data-testid={`editorial-error-${FILM_FEATURE_SLOT}`}>
      <div
        className='mx-auto max-w-2xl rounded-lg border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-900'
        role='status'
      >
        <p className='font-medium'>Content unavailable</p>
        <p className='mt-1 text-amber-800/90'>
          The &ldquo;{FILM_FEATURE_SLOT}&rdquo; slot couldn&rsquo;t load ({errorMessage}).&nbsp; If
          you see this on the live site, check the Netlify environment variables for &nbsp;
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
    </section>
  )
}

export function FilmFeatureSlot() {
  const query = useEditorialFeatures(FILM_FEATURE_SLOT)

  if (query.isLoading) {
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

  if (query.isError) {
    return <InlineEditorialErrorBanner errorMessage={query.error.message} />
  }

  // The slot key is unique in the DB; the client-side filter keeps a mocked or
  // stale API response from leaking another slot's content onto the film page.
  const feature = query.data?.find(entry => entry.slot === FILM_FEATURE_SLOT)
  if (!feature || !feature.isActive) return null

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
          <div
            className='pointer-events-none absolute inset-0 opacity-20'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,180,92,0.35), transparent)',
            }}
          />

          <div className='relative'>
            <div className='mb-4 flex items-center gap-2'>
              <Play className='h-3.5 w-3.5 fill-gold-400 text-gold-400' />
              <span className='text-xs font-medium uppercase tracking-[0.22em] text-gold-400'>
                {feature.badgeLabel ?? 'Guest Film Spotlight'}
              </span>
            </div>

            <h2 className='font-display text-2xl text-white sm:text-3xl mb-4 leading-snug'>
              {feature.title}
            </h2>

            {feature.summary && (
              <p className='text-white/70 leading-relaxed mb-8 max-w-prose'>{feature.summary}</p>
            )}

            {feature.sourceUrl && (
              <a href={feature.sourceUrl} target='_blank' rel='noopener noreferrer'>
                <Button variant='glass' size='md' className='group gap-2'>
                  {feature.ctaLabel ?? 'Watch clip'}
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
