import { Camera, MessageCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { ACTIVITY_COPY } from './constants'

/**
 * Frozen `EmptyActivityState` port (`src/components/activity/EmptyActivityState.tsx`).
 * Copy, layout and destinations are identical. The frozen app used a React Router
 * `Link`; the rebuild router is TanStack Router, so navigation is client-side here too.
 */
export function EmptyActivityState() {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-center'>
      <div className='mb-4 rounded-full bg-gold-100 p-4'>
        <Camera className='h-8 w-8 text-gold-500' aria-hidden='true' />
      </div>
      <h2 className='mb-2 font-display text-xl text-charcoal-800'>{ACTIVITY_COPY.emptyTitle}</h2>
      <p className='mb-6 max-w-xs text-charcoal-500'>{ACTIVITY_COPY.emptyBody}</p>
      <div className='flex gap-4'>
        <Link
          to='/upload'
          className='inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-600'
        >
          <Camera className='h-4 w-4' aria-hidden='true' />
          {ACTIVITY_COPY.emptyShareCta}
        </Link>
        <Link
          to='/guestbook'
          className='inline-flex items-center gap-2 rounded-full border border-gold-500 px-5 py-2 text-sm font-medium text-gold-600 transition-colors hover:bg-gold-50'
        >
          <MessageCircle className='h-4 w-4' aria-hidden='true' />
          {ACTIVITY_COPY.emptyGuestbookCta}
        </Link>
      </div>
    </div>
  )
}
