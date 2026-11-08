import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { ACTIVITY_COPY } from './constants'

export interface NewActivityBannerProps {
  count: number
  /** Banner click: prepend the pending realtime items to the feed. */
  onLoad: () => void
}

/**
 * Frozen `NewActivityBanner` port (`src/components/activity/NewActivityBanner.tsx`).
 *
 * Delta (a11y): the frozen banner had no live region, so a screen-reader user was
 * never told new activity arrived. A visually-hidden `role="status"` region
 * announces the count; the banner itself stays a real `<button>` (keyboard
 * operable via Enter/Space). No visible copy changes.
 */
export function NewActivityBanner({ count, onLoad }: NewActivityBannerProps) {
  return (
    <>
      <div role='status' aria-live='polite' aria-atomic='true' className='sr-only'>
        {count > 0 ? ACTIVITY_COPY.newActivityAnnouncement(count) : ''}
      </div>
      <AnimatePresence>
        {count > 0 && (
          <motion.button
            type='button'
            data-testid='new-activity-banner'
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            onClick={onLoad}
            className='sticky top-4 z-10 mx-auto rounded-full bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-600 shadow-lg transition-colors hover:bg-gold-500/20'
          >
            <span className='flex items-center gap-2'>
              <ArrowUp className='h-4 w-4' aria-hidden='true' />
              {ACTIVITY_COPY.banner(count)}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
