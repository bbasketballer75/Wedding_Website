import { motion } from 'framer-motion'
import { BookHeart, Search, X } from 'lucide-react'

interface GuestbookFeedHeaderProps {
  filteredCount: number
  totalCount: number
  searchQuery: string
  isLoading: boolean
  onSearchChange: (query: string) => void
}

export function GuestbookFeedHeader({
  filteredCount,
  totalCount,
  searchQuery,
  isLoading,
  onSearchChange,
}: GuestbookFeedHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      data-testid='guestbook-feed'
      className='relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5'
    >
      <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
        <div>
          <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>Notes from the day</p>
          <h2 className='mt-3 text-3xl text-white sm:text-4xl'>Every guestbook entry</h2>
        </div>
        <div className='inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/60'>
          <BookHeart className='h-4 w-4 text-gold-400' />
          {filteredCount} {filteredCount === 1 ? 'note' : 'notes'}
        </div>
      </div>

      {/* Search bar */}
      {totalCount > 0 && (
        <div className='relative mt-4'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35' />
          <input
            type='search'
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder='Search by name or message…'
            aria-label='Search guestbook messages'
            className='w-full rounded-xl border border-white/12 bg-white/6 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-white/30 focus:border-gold-400/60 focus:outline-none focus:ring-1 focus:ring-gold-400/40'
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              aria-label='Clear search'
              className='absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>
      )}

      {/* No-results state */}
      {searchQuery && filteredCount === 0 && !isLoading && (
        <p className='mt-4 text-sm text-white/40 text-center py-8'>
          No notes matching &ldquo;{searchQuery}&rdquo;
        </p>
      )}
    </motion.div>
  )
}
