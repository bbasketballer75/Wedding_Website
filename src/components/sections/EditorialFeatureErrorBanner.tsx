/**
 * EditorialFeatureErrorBanner — visible fallback for when fetchSiteEditorialFeature*()
 * fails. Used by the four home-page sections (MomentOfTheWeek, FeaturedNote, FilmFeature,
 * StandoutUpload) so a Supabase misconfiguration is loud instead of silent.
 *
 * The data layer fix is owned by Austin (correct Supabase URL + anon key in Netlify env).
 * This component just makes the failure visible so the next person debugging the page
 * immediately sees a banner instead of a mysteriously empty section.
 */
import { motion } from 'framer-motion'

interface EditorialFeatureErrorBannerProps {
  slot: string
  errorMessage: string | null
}

export function EditorialFeatureErrorBanner({
  slot,
  errorMessage,
}: EditorialFeatureErrorBannerProps) {
  return (
    <section className='py-8 px-4' data-testid={`editorial-error-${slot}`}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className='mx-auto max-w-2xl rounded-lg border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-900'
        role='status'
      >
        <p className='font-medium'>Content unavailable</p>
        <p className='mt-1 text-amber-800/90'>
          The &ldquo;{slot}&rdquo; slot couldn&rsquo;t load ({errorMessage ?? 'unknown error'}
          ).&nbsp; If you see this on the live site, check the Netlify environment variables for
          &nbsp;<code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </motion.div>
    </section>
  )
}
