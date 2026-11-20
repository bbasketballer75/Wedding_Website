/**
 * Frozen `PageLoader` port (`src/components/ui/PageLoader.tsx`): the Suspense
 * fallback used while a code-split route resolves. Skeleton panels use the
 * shared `theme-*` utilities, so it is theme- and parity-safe.
 *
 * The enter animation is CSS (`.shell-enter-loader`) rather than framer-motion: this
 * is the Suspense fallback, so it must paint immediately and must not drag an
 * animation runtime onto the critical path.
 */
export function PageLoader() {
  return (
    <div className='theme-canvas min-h-screen px-4 pt-28 sm:px-6 sm:pt-32'>
      <div
        className='shell-enter-loader mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.85fr_1.15fr]'
        aria-label='Loading page'
        role='status'
      >
        <div className='theme-panel rounded-[1.5rem] p-5 sm:p-6'>
          <div className='theme-skeleton h-4 w-28 rounded-full' />
          <div className='theme-skeleton mt-8 h-16 w-4/5 rounded-2xl' />
          <div className='theme-skeleton mt-4 h-5 w-full rounded-full' />
          <div className='theme-skeleton mt-2 h-5 w-2/3 rounded-full' />
          <div className='mt-8 flex gap-3'>
            <div className='theme-skeleton h-11 w-32 rounded-full' />
            <div className='theme-skeleton h-11 w-11 rounded-full' />
          </div>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='theme-skeleton aspect-[4/5] rounded-[1.35rem]' />
          <div className='theme-skeleton hidden aspect-[4/5] rounded-[1.35rem] sm:block' />
        </div>
        <span className='sr-only'>Loading...</span>
      </div>
    </div>
  )
}

export default PageLoader
