import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookHeart, Images, Link2, Search as SearchIcon, Sparkles, Video, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { filmQuotes, filmWatchPaths, MAIN_FILM_CHAPTERS_FALLBACK, slugifyFilmMoment } from '@/data/film'
import { memoryTrails } from '@/data/memoryTrails'

type SearchResultType = 'page' | 'film' | 'gallery' | 'guestbook' | 'trail'

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  description?: string
  url: string
  relevance: number
  badge: string
}

interface SearchProps {
  placeholder?: string
  maxResults?: number
  showSuggestions?: boolean
  className?: string
}

interface SearchablePhoto {
  id: string
  caption: string | null
  location: string | null
  category: string | null
  tags: string[] | null
}

interface SearchableGuestbookMessage {
  id: string
  name: string
  content: string
}

const pageResults: Array<Omit<SearchResult, 'relevance'>> = [
  {
    id: 'page-home',
    type: 'page',
    title: 'Home',
    description: 'The welcome page, timeline, and main story of the archive.',
    url: '/',
    badge: 'Page',
  },
  {
    id: 'page-film',
    type: 'page',
    title: 'Watch Film',
    description: 'The full wedding film, chapter jumps, parent dances, and guest highlights.',
    url: '/film',
    badge: 'Page',
  },
  {
    id: 'page-gallery',
    type: 'page',
    title: 'Gallery',
    description: 'Professional photos, approved guest uploads, and collection-based browsing.',
    url: '/gallery',
    badge: 'Page',
  },
  {
    id: 'page-guestbook',
    type: 'page',
    title: 'Guestbook',
    description: 'Text messages and replies from guests.',
    url: '/guestbook',
    badge: 'Page',
  },
  {
    id: 'page-share',
    type: 'page',
    title: 'Share',
    description: 'Upload your photos and videos or send the site to someone else who should see it.',
    url: '/upload',
    badge: 'Page',
  },
]

const defaultSuggestions = ['Ceremony', 'Parent dances', 'Guest uploads', 'Engagement', 'Guestbook']

function rankMatch(query: string, haystacks: string[]) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0

  let score = 0
  for (const haystack of haystacks) {
    const normalized = haystack.toLowerCase()
    if (normalized === normalizedQuery) {
      score = Math.max(score, 8)
    } else if (normalized.startsWith(normalizedQuery)) {
      score = Math.max(score, 6)
    } else if (normalized.includes(normalizedQuery)) {
      score = Math.max(score, 4)
    }
  }

  return score
}

function getTypeIcon(type: SearchResultType) {
  switch (type) {
    case 'film':
      return <Video className="h-4 w-4 text-gold-600" />
    case 'gallery':
      return <Images className="h-4 w-4 text-gold-600" />
    case 'guestbook':
      return <BookHeart className="h-4 w-4 text-gold-600" />
    case 'trail':
      return <Sparkles className="h-4 w-4 text-gold-600" />
    default:
      return <Link2 className="h-4 w-4 text-gold-600" />
  }
}

function Search({
  placeholder = 'Search moments, notes, and pages...',
  maxResults = 8,
  showSuggestions = true,
  className,
}: SearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [photos, setPhotos] = useState<SearchablePhoto[]>([])
  const [guestbookMessages, setGuestbookMessages] = useState<SearchableGuestbookMessage[]>([])
  const navigate = useNavigate()

  const staticResults = useMemo(() => {
    const filmMoments: SearchResult[] = [
      ...MAIN_FILM_CHAPTERS_FALLBACK.map((chapter) => ({
        id: `chapter-${slugifyFilmMoment(chapter.label)}`,
        type: 'film' as const,
        title: chapter.label,
        description: `Jump straight to ${chapter.label.toLowerCase()} in the film.`,
        url: `/film?moment=${slugifyFilmMoment(chapter.label)}`,
        relevance: 0,
        badge: 'Film moment',
      })),
      ...filmQuotes.map((quote) => ({
        id: quote.id,
        type: 'film' as const,
        title: quote.speaker,
        description: quote.note,
        url: `/film?moment=${quote.momentSlug}`,
        relevance: 0,
        badge: 'Quote rail',
      })),
      ...filmWatchPaths.map((path) => ({
        id: path.id,
        type: 'film' as const,
        title: path.label,
        description: path.description,
        url: path.clipId ? `/film?clip=${path.clipId}` : `/film?moment=${path.momentSlug ?? 'start'}`,
        relevance: 0,
        badge: 'Watch path',
      })),
    ]

    const trailResults: SearchResult[] = memoryTrails.map((trail) => ({
      id: trail.id,
      type: 'trail',
      title: trail.label,
      description: trail.description,
      url: trail.href,
      relevance: 0,
      badge: 'Memory trail',
    }))

    return [...pageResults.map((page) => ({ ...page, relevance: 0 })), ...filmMoments, ...trailResults]
  }, [])

  useEffect(() => {
    let isActive = true

    async function preloadSearchData() {
      const [{ data: photoData }, { data: guestbookData }] = await Promise.all([
        supabase
          .from('photos')
          .select('id, caption, location, category, tags')
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('guestbook_messages')
          .select('id, name, content')
          .order('created_at', { ascending: false })
          .limit(120),
      ])

      if (!isActive) return

      setPhotos((photoData || []) as SearchablePhoto[])
      setGuestbookMessages((guestbookData || []) as SearchableGuestbookMessage[])
    }

    void preloadSearchData()

    return () => {
      isActive = false
    }
  }, [])

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      const normalized = searchQuery.trim().toLowerCase()

      const rankedStatic = staticResults
        .map((result) => ({
          ...result,
          relevance: rankMatch(normalized, [result.title, result.description || '', result.badge]),
        }))
        .filter((result) => result.relevance > 0)

      const rankedPhotos = photos.flatMap<SearchResult>((photo) => {
          const photoText = [photo.caption || '', photo.location || '', photo.category || '', ...(photo.tags || [])]
          const relevance = rankMatch(normalized, photoText)
          if (relevance === 0) return []

          return [{
            id: photo.id,
            type: 'gallery',
            title: photo.caption || photo.category || 'Gallery moment',
            description: photo.location || photo.category || 'Open this moment in the gallery.',
            url: `/gallery?photo=${photo.id}${normalized ? `&q=${encodeURIComponent(searchQuery)}` : ''}`,
            relevance: relevance + 1,
            badge: 'Gallery',
          } satisfies SearchResult]
        })

      const rankedGuestbook = guestbookMessages.flatMap<SearchResult>((message) => {
          const relevance = rankMatch(normalized, [message.name, message.content])
          if (relevance === 0) return []

          return [{
            id: message.id,
            type: 'guestbook',
            title: message.name,
            description: message.content.slice(0, 110),
            url: `/guestbook?message=${message.id}`,
            relevance: relevance + 1,
            badge: 'Guestbook',
          } satisfies SearchResult]
        })

      const merged = [...rankedStatic, ...rankedPhotos, ...rankedGuestbook]
        .sort((a, b) => b.relevance - a.relevance || a.title.localeCompare(b.title))
        .slice(0, maxResults)

      setResults(merged)
      setSelectedIndex(-1)
      setLoading(false)
    },
    [guestbookMessages, maxResults, photos, staticResults]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void search(query)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [query, search])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
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

  return (
    <div className={cn('relative w-full max-w-2xl', className)}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 160)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-12 w-full rounded-full border border-gold-200/70 bg-white/86 px-11 pr-11 text-sm text-charcoal-900 shadow-sm transition-all duration-200 placeholder:text-charcoal-400 focus:border-(--color-gold) focus:outline-none focus:ring-2 focus:ring-(--color-gold)"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults([])
                setSelectedIndex(-1)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-cream-50 hover:text-charcoal-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-gold-500" />
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (query || showSuggestions) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-[1.5rem] border border-gold-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(252,249,244,0.98))] shadow-[0_30px_70px_-44px_rgba(46,33,13,0.45)] backdrop-blur-xl"
          >
            {results.length > 0 ? (
              <ul className="max-h-[26rem] overflow-y-auto py-2">
                {results.map((result, index) => (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50/88',
                        index === selectedIndex && 'bg-cream-50/88'
                      )}
                    >
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-gold-200/70 bg-gold-50/80">
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-charcoal-900">{result.title}</p>
                          <span className="rounded-full border border-gold-200 bg-gold-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gold-700">
                            {result.badge}
                          </span>
                        </div>
                        {result.description && (
                          <p className="mt-1 text-sm leading-6 text-charcoal-500">{result.description}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-charcoal-600">No real results yet for “{query}”.</p>
                <p className="mt-2 text-sm text-charcoal-400">
                  Try a chapter name, a guest name, a collection, or one of the memory trails below.
                </p>
              </div>
            ) : (
              <div className="px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Try one of these</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {defaultSuggestions.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="rounded-full border border-gold-200/70 bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600 transition-colors hover:border-gold-300 hover:bg-gold-50"
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
