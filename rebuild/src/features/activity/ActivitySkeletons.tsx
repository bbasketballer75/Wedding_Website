import { Skeleton } from '@/shared/ui'
import { ACTIVITY_COPY } from './constants'

const SKELETON_ROWS = [0, 1, 2] as const

/**
 * Loading state for the feed. The frozen page rendered filters plus an empty
 * list while loading (no skeleton, no status text); the rebuild shows three
 * card-shaped skeletons and an accessible loading status instead. Not part of
 * the text oracle (the parity harness waits for the fixture load to settle).
 */
export function ActivitySkeletons() {
  return (
    <div data-testid='activity-skeletons'>
      <p role='status' className='sr-only'>
        {ACTIVITY_COPY.loadingLabel}
      </p>
      <div className='flex flex-col gap-3' aria-hidden='true'>
        {SKELETON_ROWS.map(index => (
          <div
            key={index}
            className='flex gap-3 rounded-xl bg-gradient-to-br from-cream-50 to-gold-50/40 p-3'
          >
            <Skeleton className='h-16 w-16 flex-shrink-0 rounded-lg' />
            <div className='flex min-w-0 flex-1 flex-col justify-center gap-2'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-3 w-56 max-w-full' />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
