import type { KeyboardEvent } from 'react'
import { cn } from '@/shared/lib/cn'
import { ACTIVITY_COPY, ACTIVITY_FILTERS, activityTabId } from './constants'
import type { ActivityFilterType } from './types'

export interface ActivityFiltersProps {
  activeFilter: ActivityFilterType
  onChange: (filter: ActivityFilterType) => void
}

/**
 * Frozen `ActivityFilters` port (`src/components/activity/ActivityFilters.tsx`).
 *
 * Delta: the frozen control was a row of toggle buttons (`aria-pressed`). The
 * rebuild renders a real ARIA tablist with roving tabindex + Arrow/Home/End
 * navigation (the frozen buttons were not keyboard-group navigable). Visible copy,
 * classes and layout are identical, so parity is unaffected.
 */
export function ActivityFilters({ activeFilter, onChange }: ActivityFiltersProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = ACTIVITY_FILTERS.findIndex(option => option.value === activeFilter)
    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % ACTIVITY_FILTERS.length
        break
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + ACTIVITY_FILTERS.length) % ACTIVITY_FILTERS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = ACTIVITY_FILTERS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const next = ACTIVITY_FILTERS[nextIndex]
    if (!next) return
    onChange(next.value)
    document.getElementById(activityTabId(next.value))?.focus()
  }

  return (
    <div role='tablist' aria-label={ACTIVITY_COPY.filterLabel} className='mb-6 flex gap-2'>
      {ACTIVITY_FILTERS.map(option => {
        const isActive = option.value === activeFilter
        return (
          <button
            key={option.value}
            id={activityTabId(option.value)}
            type='button'
            role='tab'
            aria-selected={isActive}
            aria-controls='activity-feed-panel'
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-gold-500 text-white'
                : 'bg-cream-200 text-charcoal-600 hover:bg-cream-300'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
