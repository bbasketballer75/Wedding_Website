import { Camera, MessageCircle, Star, type LucideIcon } from 'lucide-react'
import { ACTIVITY_COPY, ACTIVITY_TYPE_LABELS } from './constants'
import { formatActivityTime } from './timeAgo'
import type { ActivityItem, ActivityType } from './types'

const TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  photo_upload: Camera,
  guestbook_entry: MessageCircle,
  featured_moment: Star,
}

export interface ActivityCardProps {
  item: ActivityItem
  /** Clock seam for deterministic relative timestamps (defaults to the real clock). */
  now?: Date
}

/**
 * Frozen `ActivityCard` port (`src/components/activity/ActivityCard.tsx`).
 * The layout classes, icon set, type labels and relative time are 1:1; the only
 * additions are the `data-*` hooks the tests use and explicit image dimensions
 * (the frozen `<img>` had none, which is a CLS risk the quality bar forbids).
 */
export function ActivityCard({ item, now }: ActivityCardProps) {
  const Icon = TYPE_ICONS[item.type]
  const typeLabel = ACTIVITY_TYPE_LABELS[item.type]
  const timeAgo = formatActivityTime(item.createdAt, now)

  return (
    <div
      data-testid='activity-card'
      data-activity-type={item.type}
      className='flex gap-3 rounded-xl bg-gradient-to-br from-cream-50 to-gold-50/40 p-3'
    >
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=''
          width={64}
          height={64}
          loading='lazy'
          className='h-16 w-16 flex-shrink-0 rounded-lg object-cover'
        />
      ) : (
        <div className='flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gold-100'>
          <Icon className='h-6 w-6 text-gold-500' aria-hidden='true' />
        </div>
      )}
      <div className='flex min-w-0 flex-1 flex-col justify-center'>
        <p className='truncate font-medium text-charcoal-800'>
          {item.displayName || ACTIVITY_COPY.anonymousName}
        </p>
        <div className='flex items-center gap-1.5 text-sm text-charcoal-500'>
          <Icon className='h-3.5 w-3.5 flex-shrink-0 text-gold-500' aria-hidden='true' />
          <span>{typeLabel}</span>
          <span className='text-charcoal-400'>·</span>
          <span className='truncate'>{timeAgo}</span>
        </div>
      </div>
    </div>
  )
}
