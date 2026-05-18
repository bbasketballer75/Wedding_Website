import { Camera, MessageCircle, Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ActivityLogItem } from '@/lib/supabase'

interface ActivityCardProps {
  item: ActivityLogItem
}

const typeIcons = {
  photo_upload: Camera,
  guestbook_entry: MessageCircle,
  featured_moment: Star,
} as const

const typeLabels = {
  photo_upload: 'shared a photo',
  guestbook_entry: 'signed the guestbook',
  featured_moment: 'Featured moment',
} as const

export function ActivityCard({ item }: ActivityCardProps) {
  const Icon = typeIcons[item.type]
  const typeLabel = typeLabels[item.type]
  const timeAgo = item.created_at
    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
    : ''

  return (
    <div className="flex gap-3 p-3 rounded-xl bg-gradient-to-br from-cream-50 to-gold-50/40">
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt=""
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-gold-100 flex items-center justify-center flex-shrink-0">
          <Icon className="h-6 w-6 text-gold-500" />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="font-medium text-charcoal-800 truncate">
          {item.display_name || 'Anonymous'}
        </p>
        <div className="flex items-center gap-1.5 text-sm text-charcoal-500">
          <Icon className="h-3.5 w-3.5 text-gold-500 flex-shrink-0" />
          <span>{typeLabel}</span>
          <span className="text-charcoal-400">·</span>
          <span className="truncate">{timeAgo}</span>
        </div>
      </div>
    </div>
  )
}