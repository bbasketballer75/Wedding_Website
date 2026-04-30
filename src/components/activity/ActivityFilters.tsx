import { cn } from '@/lib/utils'
import { activityFeedStore, type ActivityFilterType } from '@/stores/activityFeedStore'

const filterOptions: { value: ActivityFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photos', label: 'Photos' },
  { value: 'guestbook', label: 'Guestbook' },
  { value: 'moments', label: 'Moments' },
]

export function ActivityFilters() {
  const activeFilter = activityFeedStore((state) => state.activeFilter)
  const setActiveFilter = activityFeedStore((state) => state.setActiveFilter)

  return (
    <div className="flex gap-2 mb-6">
      {filterOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => setActiveFilter(option.value)}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150',
            activeFilter === option.value
              ? 'bg-gold-500 text-white'
              : 'bg-cream-200 text-charcoal-600 hover:bg-cream-300'
          )}
          aria-pressed={activeFilter === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}