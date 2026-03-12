import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  id: string
  type: 'page'
  title: string
  description?: string
  url: string
  relevance: number
}

interface SearchProps {
  placeholder?: string
  maxResults?: number
  showSuggestions?: boolean
}

const Search: React.FC<SearchProps> = ({
  placeholder = 'Search the wedding site...',
  maxResults = 8,
  showSuggestions = true,
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const navigate = useNavigate()

  const searchablePages = useMemo(
    () => [
      {
        id: 'home',
        title: 'Home',
        url: '/',
        description: 'The welcome page, timeline, and the big-day overview.',
      },
      {
        id: 'film',
        title: 'Watch Film',
        url: '/film',
        description: 'Watch the full wedding film and parent dances.',
      },
      {
        id: 'gallery',
        title: 'Gallery',
        url: '/gallery',
        description: 'Browse the professional photos and approved guest uploads.',
      },
      {
        id: 'guestbook',
        title: 'Guestbook',
        url: '/guestbook',
        description: 'Leave a note, voice message, or video for Austin and Jordyn.',
      },
      {
        id: 'share',
        title: 'Share',
        url: '/upload',
        description: 'Upload your photos and videos or share the site with loved ones.',
      },
    ],
    []
  )

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        return
      }

      setLoading(true)

      const queryLower = searchQuery.toLowerCase()
      const searchResults: SearchResult[] = searchablePages.reduce<SearchResult[]>((matches, page) => {
        const titleMatch = page.title.toLowerCase().includes(queryLower)
        const descMatch = page.description?.toLowerCase().includes(queryLower)
        const relevance = titleMatch ? 2 : descMatch ? 1 : 0

        if (relevance > 0) {
          matches.push({
            ...page,
            type: 'page',
            relevance,
          })
        }
        return matches
      }, [])

      // Sort by relevance and limit results
      searchResults.sort((a, b) => b.relevance - a.relevance)
      setResults(searchResults.slice(0, maxResults))
      setLoading(false)
    },
    [maxResults, searchablePages]
  )

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      search(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, search])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url)
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  const getTypeIcon = () => '↗'

  return (
    <div className='relative w-full max-w-2xl mx-auto'>
      <div className='relative'>
        <input
          type='text'
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className='w-full px-4 py-3 pr-12 text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent transition-all duration-200'
        />

        <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
          {loading ? (
            <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-gold'></div>
          ) : (
            <svg
              className='w-5 h-5 text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (query || showSuggestions) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden'
          >
            {results.length > 0 ? (
              <ul className='py-2'>
                {results.map((result, index) => (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => handleResultClick(result)}
                      className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        index === selectedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''
                      }`}
                    >
                      <span className='text-xl'>{getTypeIcon()}</span>
                      <div className='flex-1 text-left'>
                        <div className='font-medium text-gray-900 dark:text-white'>
                          {result.title}
                        </div>
                        {result.description && (
                          <div className='text-sm text-gray-500 dark:text-gray-400'>
                            {result.description}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query ? (
              <div className='px-4 py-8 text-center text-gray-500 dark:text-gray-400'>
                No results found for "{query}"
              </div>
            ) : (
              <div className='px-4 py-2'>
                <p className='text-sm text-gray-500 dark:text-gray-400 mb-2'>Try one of these:</p>
                <div className='flex flex-wrap gap-2'>
                  {['Film', 'Gallery', 'Guestbook', 'Share'].map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className='px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Search
