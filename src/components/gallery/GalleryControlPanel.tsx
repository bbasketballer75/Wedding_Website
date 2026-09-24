/**
 * GalleryControlPanel — the white card containing collection tabs +
 * search + view-mode + select toggle + select-mode action bar +
 * active-filter chips.
 *
 * Extracted from src/pages/Gallery.tsx on 2026-09-14 as part of the
 * Gallery.tsx 1356 -> <500 line reduction.
 */
import { motion } from 'framer-motion'
import { CalendarDays, CheckSquare, Grid3X3, LayoutGrid, Search, X } from 'lucide-react'
import type { CollectionTab } from '@/components/gallery/constants'
import { collectionTabs, COLLECTION_COVERS } from '@/components/gallery/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

const viewOptions = [
  { key: 'masonry', label: 'Masonry', icon: LayoutGrid },
  { key: 'grid', label: 'Grid', icon: Grid3X3 },
  { key: 'timeline', label: 'Timeline', icon: CalendarDays },
] as const

export interface GalleryControlPanelProps {
  collectionCounts: Record<CollectionTab, number>
  selectedCollection: CollectionTab
  onCollectionChange: (collection: CollectionTab) => void

  searchQuery: string
  onSearchChange: (query: string) => void

  viewMode: 'masonry' | 'grid' | 'timeline'
  onViewModeChange: (mode: 'masonry' | 'grid' | 'timeline') => void

  selectMode: boolean
  onToggleSelectMode: () => void
  selectedPhotoIdsCount: number
  onSelectAllVisible: () => void
  onClearQueue: () => void

  hasActiveFilters: boolean
  onClearAllFilters: () => void
}

export function GalleryControlPanel(props: GalleryControlPanelProps) {
  const {
    collectionCounts,
    selectedCollection,
    onCollectionChange,
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
    selectMode,
    onToggleSelectMode,
    selectedPhotoIdsCount,
    onSelectAllVisible,
    onClearQueue,
    hasActiveFilters,
    onClearAllFilters,
  } = props

  return (
    <div className='mt-8 border-t border-charcoal-900/8 pt-6'>
      <div
        data-testid='gallery-control-bar'
        className='rounded-[1.6rem] border border-white/80 bg-white/78 p-4 shadow-[0_24px_64px_-48px_rgba(46,33,13,0.34)] backdrop-blur-sm sm:p-5'
      >
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
          {collectionTabs.map(tab => {
            const isActive = selectedCollection === tab
            const coverUrl = COLLECTION_COVERS[tab]
            return (
              <button
                key={tab}
                type='button'
                onClick={() => onCollectionChange(tab)}
                aria-pressed={isActive}
                className={cn(
                  'relative h-40 cursor-pointer overflow-hidden rounded-2xl bg-gold-100 transition-all duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2',
                  isActive
                    ? 'scale-[1.02] ring-2 ring-gold-400 ring-offset-2 shadow-lg'
                    : 'scale-[0.98] hover:scale-[1.00] hover:shadow-md'
                )}
                style={{
                  backgroundImage: `url('${coverUrl}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div
                  className={cn(
                    'absolute inset-0 transition-opacity',
                    isActive
                      ? 'bg-gradient-to-t from-black/50 via-black/15 to-transparent'
                      : 'bg-gradient-to-t from-black/65 via-black/25 to-transparent'
                  )}
                />
                <div className='absolute bottom-0 left-0 p-3 text-left'>
                  <p className='font-display text-sm leading-tight text-white'>{tab}</p>
                  <p className='mt-0.5 text-xs text-white/70'>{collectionCounts[tab]} photos</p>
                </div>
              </button>
            )
          })}
        </div>

        <div
          data-testid='gallery-filter-bar'
          className='mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'
        >
          <div className='relative'>
            <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400' />
            <Input
              type='text'
              placeholder='Search by caption, location, photographer, or tags'
              value={searchQuery}
              onChange={event => onSearchChange(event.target.value)}
              className='h-12 rounded-full border-gold-200/70 bg-cream-50/85 pl-11 pr-11 text-charcoal-900 placeholder:text-charcoal-400 shadow-none'
            />
            {searchQuery && (
              <button
                type='button'
                onClick={() => onSearchChange('')}
                aria-label='Clear gallery search'
                className='absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-white hover:text-charcoal-600'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>

          <div className='flex items-center gap-2'>
            <div className='inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-cream-50/90 p-1'>
              {viewOptions.map(option => {
                const Icon = option.icon
                const isActive = viewMode === option.key
                return (
                  <button
                    key={option.key}
                    type='button'
                    onClick={() => onViewModeChange(option.key)}
                    aria-pressed={isActive}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                      isActive
                        ? 'bg-gold-500 text-white shadow-sm'
                        : 'text-charcoal-500 hover:bg-white hover:text-charcoal-700'
                    )}
                  >
                    <Icon className='h-4 w-4' />
                    {option.label}
                  </button>
                )
              })}
            </div>

            <button
              type='button'
              onClick={onToggleSelectMode}
              aria-pressed={selectMode}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                selectMode
                  ? 'border-gold-400 bg-gold-500 text-white shadow-sm'
                  : 'border-gold-200/70 bg-cream-50/90 text-charcoal-500 hover:bg-white hover:text-charcoal-700'
              )}
            >
              <CheckSquare className='h-4 w-4' />
              Select
            </button>
          </div>
        </div>

        {selectMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-cream-50/50 p-3'
          >
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-charcoal-700'>
                {selectedPhotoIdsCount} photo{selectedPhotoIdsCount !== 1 ? 's' : ''} in queue (max
                50)
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='secondary'
                size='sm'
                onClick={onSelectAllVisible}
                className='h-9 rounded-full px-4 text-xs font-medium'
              >
                Select All Visible
              </Button>
              {selectedPhotoIdsCount > 0 && (
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={onClearQueue}
                  className='h-9 rounded-full px-4 text-xs font-medium border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800'
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {hasActiveFilters && (
          <div className='mt-4 flex flex-wrap items-center gap-2 border-t border-charcoal-900/8 pt-4'>
            <span className='text-[10px] uppercase tracking-[0.28em] text-charcoal-500'>
              Active filters
            </span>
            <span className='inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600'>
              {selectedCollection}
            </span>
            {searchQuery && (
              <span className='inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600'>
                {`Search: "${searchQuery}"`}
              </span>
            )}
            <button
              type='button'
              onClick={onClearAllFilters}
              className='text-sm text-gold-700 transition-colors hover:text-gold-800 sm:ml-auto'
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
