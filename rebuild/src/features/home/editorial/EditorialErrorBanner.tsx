/**
 * Frozen inline editorial error banner — duplicated in the frozen
 * `MomentOfTheWeekSection`, `StandoutUploadSection` and `FeaturedNoteSection`
 * to dodge production DCE. Here it is one local component imported by all
 * three slots (identical markup and copy, so parity is unaffected).
 */
export interface EditorialErrorBannerProps {
  slot: string
  errorMessage: string | null
}

export function EditorialErrorBanner({ slot, errorMessage }: EditorialErrorBannerProps) {
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
