import { Images } from 'lucide-react'
import { GALLERY_COPY } from './constants'

/** Frozen `src/components/gallery/GalleryHeader.tsx` verbatim. */
export function GalleryHeader({ visibleCount }: { visibleCount: number }) {
  return (
    <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
      <div>
        <p className='text-[10px] uppercase tracking-[0.34em] text-gold-700'>
          {GALLERY_COPY.eyebrow}
        </p>
        <h1 className='mt-2 font-display text-4xl text-charcoal-900 sm:text-5xl'>
          {GALLERY_COPY.title}
        </h1>
        <p className='mt-3 max-w-2xl text-sm leading-7 text-charcoal-600 sm:text-base'>
          {GALLERY_COPY.description}
        </p>
      </div>

      <div className='inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500 shadow-sm'>
        <Images className='h-4 w-4 text-gold-500' aria-hidden='true' />
        {visibleCount} visible
      </div>
    </div>
  )
}
