import React from 'react'

interface GalleryHeaderProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filter: string
  setFilter: (filter: string) => void
  sortBy: 'date' | 'likes' | 'ai'
  setSortBy: (sort: 'date' | 'likes' | 'ai') => void
  viewMode: 'masonry' | 'grid' | 'carousel'
  setViewMode: (mode: 'masonry' | 'grid' | 'carousel') => void
  allTags: string[]
  enableAI: boolean
  isLoading: boolean
  onUploadClick: () => void
}

const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  allTags,
  enableAI,
  isLoading,
  onUploadClick,
}) => {
  return (
    <div className='sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-white/5 shadow-glass'>
      <div className='max-w-7xl mx-auto px-4 py-4'>
        <div className='flex flex-col lg:flex-row gap-4'>
          {/* Search */}
          <div className='flex-1'>
            <input
              type='text'
              placeholder='Search photos by caption, tags, or location...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='w-full px-5 py-3 bg-white/5 border border-white/10 rounded-full text-cream-100 placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-(--color-gold) focus:border-(--color-gold) transition-all font-body text-sm'
            />
          </div>

          {/* Filters */}
          <div className='flex gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide'>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label='Filter photos by tag'
              className='px-5 py-3 bg-white/5 border border-white/10 rounded-full text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-gold) cursor-pointer hover:bg-white/10 transition-colors appearance-none min-w-[140px]'
            >
              <option value='all' className='bg-dark-900'>
                All Photos
              </option>
              <option value='liked' className='bg-dark-900'>
                Liked
              </option>
              {allTags.map(tag => (
                <option key={tag} value={tag} className='bg-dark-900'>
                  {tag}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'date' | 'likes' | 'ai')}
              aria-label='Sort photos by'
              className='px-5 py-3 bg-white/5 border border-white/10 rounded-full text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-gold) cursor-pointer hover:bg-white/10 transition-colors appearance-none min-w-[140px]'
            >
              <option value='date' className='bg-dark-900'>
                Sort by Date
              </option>
              <option value='likes' className='bg-dark-900'>
                Sort by Likes
              </option>
              {enableAI && (
                <option value='ai' className='bg-dark-900'>
                  Sort by AI Match
                </option>
              )}
            </select>

            <div className='flex bg-white/5 border border-white/10 rounded-full p-1 shrink-0'>
              {(['masonry', 'grid', 'carousel'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  aria-label={`Switch to ${mode} view`}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-medium transition-all ${
                    viewMode === mode
                      ? 'bg-gold-500 text-white shadow-gold'
                      : 'text-cream-200/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={onUploadClick}
              disabled={isLoading}
              className='px-6 py-2 bg-linear-to-r from-gold-600 to-gold-400 text-white rounded-full hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-gold shrink-0 transition-all font-medium text-sm tracking-wide'
            >
              {isLoading ? (
                <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent'></div>
              ) : (
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 4v16m8-8H4'
                  />
                </svg>
              )}
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GalleryHeader
