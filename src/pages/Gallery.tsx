import { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { motion } from 'framer-motion'
import { GallerySEO } from '@/components/seo/SEOHead'
import { PhotoGrid } from '@/components/gallery/PhotoGrid'
import { TimelineView } from '@/components/gallery/TimelineView'
import { MapView } from '@/components/gallery/MapView'
import { SortDropdown, SortOption } from '@/components/gallery/SortDropdown'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { FaceRecognition } from '@/components/face-recognition/FaceRecognition'
import { ShareModal } from '@/components/share/ShareModal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { downloadFile } from '@/utils/download'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { Search, Grid3X3, LayoutGrid, Heart, Filter, Sparkles, Share2, Clock, MapPin, Loader2, ArrowRight, Images, X, SlidersHorizontal, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, Photo as SupabasePhoto } from '@/lib/supabase'

// Extended photo type with faces and comments
interface Photo {
  id: string
  url: string
  thumbnail: string
  caption?: string
  category: string
  likes: number
  aspectRatio: number
  time?: string
  photographer?: string
  faces?: Array<{ id: string; name: string; x: number; y: number }>
  tags?: string[]
  location?: string
  date?: string
  comments?: Array<{ id: string; author: string; content: string; timestamp: string }>
  createdAt?: string
  liked?: boolean
}

const samplePhotos: Photo[] = [
  { 
    id: '1', 
    url: '/images/engagement/PoradaProposal-29.webp', 
    thumbnail: '/images/engagement/PoradaProposal-29.webp', 
    caption: 'The first look', 
    category: 'Getting Ready', 
    likes: 24, 
    aspectRatio: 1.5,
    time: '2:00 PM',
    location: 'Getting Ready',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T14:00:00',
    faces: [
      { id: 'f1', name: 'Jordyn', x: 40, y: 35 },
      { id: 'f2', name: 'Austin', x: 65, y: 40 }
    ],
    tags: ['first look', 'emotional', 'bride', 'groom'],
    comments: [
      { id: 'c1', author: 'Sarah M.', content: 'This moment was so beautiful!', timestamp: '2 days ago' }
    ]
  },
  { 
    id: '2', 
    url: '/images/engagement/PoradaProposal-11.webp', 
    thumbnail: '/images/engagement/PoradaProposal-11.webp', 
    caption: 'Walking down the aisle', 
    category: 'Ceremony', 
    likes: 56, 
    aspectRatio: 0.67,
    time: '3:30 PM',
    location: 'Ceremony Garden',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T15:30:00',
    faces: [{ id: 'f3', name: 'Jordyn', x: 50, y: 45 }],
    tags: ['ceremony', 'aisle', 'bride'],
  },
  { 
    id: '3', 
    url: '/images/engagement/PoradaProposal-150.webp', 
    thumbnail: '/images/engagement/PoradaProposal-150.webp', 
    caption: 'The vows', 
    category: 'Ceremony', 
    likes: 42, 
    aspectRatio: 1.5,
    time: '3:45 PM',
    location: 'Ceremony Garden',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T15:45:00',
    faces: [
      { id: 'f4', name: 'Austin', x: 35, y: 40 },
      { id: 'f5', name: 'Jordyn', x: 65, y: 40 }
    ],
    tags: ['vows', 'ceremony', 'emotional'],
  },
  { 
    id: '4', 
    url: '/images/engagement/PoradaProposal-181.webp', 
    thumbnail: '/images/engagement/PoradaProposal-181.webp', 
    caption: 'First kiss as married couple', 
    category: 'Ceremony', 
    likes: 89, 
    aspectRatio: 1.5,
    time: '4:00 PM',
    location: 'Ceremony Garden',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T16:00:00',
    faces: [
      { id: 'f6', name: 'Austin', x: 45, y: 45 },
      { id: 'f7', name: 'Jordyn', x: 55, y: 45 }
    ],
    tags: ['first kiss', 'ceremony', 'married'],
    comments: [
      { id: 'c2', author: 'Mike C.', content: 'Finally! 🎉', timestamp: '3 days ago' }
    ]
  },
  { 
    id: '5', 
    url: '/images/engagement/PoradaProposal-255.webp', 
    thumbnail: '/images/engagement/PoradaProposal-255.webp', 
    caption: 'Celebration', 
    category: 'Reception', 
    likes: 31, 
    aspectRatio: 1,
    time: '6:30 PM',
    location: 'Reception Hall',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T18:30:00',
    faces: [
      { id: 'f8', name: 'Christine', x: 30, y: 50 },
      { id: 'f9', name: 'Jerame', x: 70, y: 50 }
    ],
    tags: ['family', 'celebration', 'reception'],
  },
  { 
    id: '6', 
    url: '/images/engagement/PoradaProposal-277.webp', 
    thumbnail: '/images/engagement/PoradaProposal-277.webp', 
    caption: 'First dance', 
    category: 'Reception', 
    likes: 67, 
    aspectRatio: 0.75,
    time: '7:00 PM',
    location: 'Reception Hall',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T19:00:00',
    faces: [
      { id: 'f10', name: 'Austin', x: 40, y: 45 },
      { id: 'f11', name: 'Jordyn', x: 60, y: 45 }
    ],
    tags: ['first dance', 'reception', 'romantic'],
    comments: [
      { id: 'c3', author: 'Emma D.', content: 'Perfect song choice!', timestamp: '1 week ago' }
    ]
  },
  { 
    id: '7', 
    url: '/images/engagement/PoradaProposal-310.webp', 
    thumbnail: '/images/engagement/PoradaProposal-310.webp', 
    caption: 'Cutting the cake', 
    category: 'Reception', 
    likes: 45, 
    aspectRatio: 1.5,
    time: '8:00 PM',
    location: 'Reception Hall',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T20:00:00',
    faces: [
      { id: 'f12', name: 'Austin', x: 45, y: 40 },
      { id: 'f13', name: 'Jordyn', x: 55, y: 40 }
    ],
    tags: ['cake', 'reception', 'tradition'],
  },
  { 
    id: '8', 
    url: '/images/engagement/PoradaProposal-375.webp', 
    thumbnail: '/images/engagement/PoradaProposal-375.webp', 
    caption: 'Dancing the night away', 
    category: 'Reception', 
    likes: 38, 
    aspectRatio: 1.5,
    time: '9:30 PM',
    location: 'Reception Hall',
    photographer: 'Emma Photography',
    date: '2025-05-10',
    createdAt: '2025-05-10T21:30:00',
    faces: [
      { id: 'f14', name: 'Melony', x: 25, y: 50 },
      { id: 'f15', name: 'Christine', x: 50, y: 45 },
      { id: 'f16', name: 'Jerame', x: 75, y: 50 }
    ],
    tags: ['dancing', 'party', 'reception'],
  },
]

const categories = ['All', 'Getting Ready', 'Ceremony', 'Portraits', 'Reception', 'Dancing', 'Details']

const viewOptions = [
  {
    key: 'masonry',
    label: 'Masonry',
    description: 'A flowing wall of moments.',
    icon: LayoutGrid,
  },
  {
    key: 'grid',
    label: 'Grid',
    description: 'A tidy overview for quick browsing.',
    icon: Grid3X3,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    description: 'Follow the day as it unfolded.',
    icon: Clock,
  },
  {
    key: 'map',
    label: 'Map',
    description: 'Browse photos by place.',
    icon: MapPin,
  },
] as const

// Helper to convert Supabase photo to local Photo type
const mapSupabasePhoto = (photo: SupabasePhoto): Photo => ({
  id: photo.id,
  url: photo.url,
  thumbnail: photo.thumbnail,
  caption: photo.caption,
  category: photo.category || 'Uncategorized',
  likes: photo.likes,
  aspectRatio: 1, // Default, could be calculated from image dimensions
  time: photo.date ? new Date(photo.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
  location: photo.location,
  photographer: photo.photographer,
  date: photo.date,
  createdAt: photo.created_at,
  faces: photo.faces || [],
  tags: photo.tags,
})

export default function Gallery() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'masonry' | 'grid' | 'timeline' | 'map'>('masonry')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showFavorites, setShowFavorites] = useState(false)
  const [faceFilter, setFaceFilter] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [photos, setPhotos] = useState<Photo[]>(samplePhotos)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Fetch photos from Supabase on mount
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          setLoadError('Could not load photos from the database. Showing the curated highlight set instead.')
          return
        }

        if (data && data.length > 0) {
          setPhotos(data.map(mapSupabasePhoto))
        }
      } catch {
        setLoadError('Could not connect to the gallery database. Showing the curated highlight set instead.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPhotos()
  }, [])

  // Sort photos
  const sortedPhotos = useMemo(() => {
    const sorted = [...photos]
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      case 'popular':
        return sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0))
      default:
        return sorted
    }
  }, [photos, sortBy])

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    return sortedPhotos.filter((photo) => {
      const searchableText = [
        photo.caption,
        photo.location,
        photo.photographer,
        ...(photo.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery)
      const matchesCategory = selectedCategory === 'All' || photo.category === selectedCategory
      const matchesFavorites = !showFavorites || (photo.likes && photo.likes > 40)
      const matchesFace = !faceFilter || photo.faces?.some(f => f.name === faceFilter)
      
      return matchesSearch && matchesCategory && matchesFavorites && matchesFace
    })
  }, [sortedPhotos, deferredSearchQuery, selectedCategory, showFavorites, faceFilter])

  // Infinite scroll for masonry/grid views
  const {
    displayedItems,
    hasMore,
    isLoading: isLoadingMore,
    loadMore,
    observerRef,
  } = useInfiniteScroll({
    items: filteredPhotos,
    itemsPerPage: viewMode === 'grid' ? 16 : 12,
  })

  const favoritePhotoCount = useMemo(
    () => photos.filter(photo => (photo.likes ?? 0) > 40).length,
    [photos]
  )

  const peopleCount = useMemo(
    () => new Set(photos.flatMap(photo => (photo.faces || []).map(face => face.name))).size,
    [photos]
  )

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, category) => {
      acc[category] = category === 'All'
        ? photos.length
        : photos.filter(photo => photo.category === category).length
      return acc
    }, {})
  }, [photos])

  const visiblePhotoCount = viewMode === 'masonry' || viewMode === 'grid'
    ? displayedItems.length
    : filteredPhotos.length

  const activeView = viewOptions.find(option => option.key === viewMode) || viewOptions[0]
  const hasActiveFilters = Boolean(searchQuery || selectedCategory !== 'All' || showFavorites || faceFilter)

  const openLightbox = (index: number) => {
    if (index >= 0) {
      setLightboxIndex(index)
    }
  }

  const closeLightbox = () => setLightboxIndex(null)

  const handleLike = (photoId: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId 
        ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
        : p
    ))
  }

  const handleDownload = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId)
    if (!photo) return
    
    setDownloadingId(photoId)
    try {
      const filename = `Austin-Jordyn-Wedding-${photo.caption || photo.id}.jpg`
      await downloadFile(photo.url, filename)
    } catch {
      // Error handled via UI
    }
    setDownloadingId(null)
  }

  const handleAddComment = (photoId: string, content: string) => {
    const newComment = {
      id: `c${Date.now()}`,
      author: 'Guest',
      content,
      timestamp: 'Just now'
    }
    setPhotos(prev => prev.map(p => 
      p.id === photoId 
        ? { ...p, comments: [...(p.comments || []), newComment] }
        : p
    ))
  }

  const handleFaceFilter = (faceName: string) => {
    setFaceFilter(faceName)
    setSearchQuery('')
  }

  const clearFaceFilter = () => {
    setFaceFilter(null)
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setSelectedCategory('All')
    setShowFavorites(false)
    setFaceFilter(null)
  }

  const currentPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null

  return (
    <div className="min-h-screen bg-cream-50 pt-24 pb-20">
      <GallerySEO />

      <section className="relative overflow-hidden px-4 pb-10">
        <div className="absolute inset-x-0 top-0 h-[30rem] bg-gradient-to-b from-cream-100 via-cream-50 to-transparent" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute -left-16 top-20 h-56 w-56 rounded-full bg-gold-200/25 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -30, 0], y: [0, 50, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            className="absolute right-0 top-16 h-72 w-72 rounded-full bg-blush-200/30 blur-3xl"
          />
          <div className="absolute bottom-8 left-[8%] text-gold-500/10">
            <Heart className="h-24 w-24 fill-current" />
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(250,248,244,0.98)_58%,rgba(246,239,226,0.92))] p-6 shadow-[0_35px_90px_-48px_rgba(46,33,13,0.42)] backdrop-blur-xl sm:p-8 lg:p-10"
          >
            <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] 2xl:items-start">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/60 bg-white/75 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-gold-700 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Our wedding gallery
                </div>

                <h1 className="max-w-3xl font-display text-4xl text-charcoal-900 sm:text-5xl lg:text-6xl">
                  A living archive of the day, one angle at a time.
                </h1>

                <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                  Browse the portraits, find the loudest dance-floor photos, follow the day in sequence,
                  or jump straight to the moments that include the people you love most.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/75 px-4 py-2 text-xs uppercase tracking-[0.22em] text-charcoal-500">
                    <Images className="h-4 w-4 text-gold-500" />
                    {photos.length} captured moments
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/75 px-4 py-2 text-xs uppercase tracking-[0.22em] text-charcoal-500">
                    <Users className="h-4 w-4 text-gold-500" />
                    {peopleCount || 1} familiar faces
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/75 px-4 py-2 text-xs uppercase tracking-[0.22em] text-charcoal-500">
                    <SlidersHorizontal className="h-4 w-4 text-gold-500" />
                    4 ways to browse
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Captured', value: photos.length.toString(), detail: 'Total images ready to browse' },
                  { label: 'Showing', value: filteredPhotos.length.toString(), detail: hasActiveFilters ? 'Matching the current filters' : 'Visible in the full collection' },
                  { label: 'Favorites', value: favoritePhotoCount.toString(), detail: 'The most-loved moments so far' },
                  { label: 'View', value: activeView.label, detail: activeView.description },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 + index * 0.08 }}
                    className="rounded-[1.5rem] border border-white/80 bg-white/72 p-5 shadow-sm backdrop-blur-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.32em] text-charcoal-500">
                      {item.label}
                    </p>
                    <p className="mt-3 font-display text-4xl text-gold-600">
                      {item.value}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-charcoal-500">
                      {item.detail}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-charcoal-900/8 pt-6">
              {loadError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-700"
                >
                  {loadError}
                </motion.div>
              )}

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
                <div data-testid="gallery-control-bar" className="rounded-[1.5rem] border border-white/80 bg-white/72 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
                      <Input
                        type="text"
                        placeholder="Search by caption, location, photographer, or tags"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="h-12 rounded-full border-gold-200/70 bg-cream-50/85 pl-11 pr-11 shadow-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear gallery search"
                          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-white hover:text-charcoal-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <SortDropdown value={sortBy} onChange={setSortBy} />
                      <FaceRecognition onPhotoFilter={handleFaceFilter} />
                      <Button variant="glass" size="sm" className="sm:w-auto" onClick={() => setShareModalOpen(true)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share
                      </Button>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-gold-200/80 bg-cream-50/80 px-3 py-3">
                      <span className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">
                        Active filters
                      </span>
                      {searchQuery && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-charcoal-600">
                          Search: “{searchQuery}”
                        </span>
                      )}
                      {selectedCategory !== 'All' && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-charcoal-600">
                          Category: {selectedCategory}
                        </span>
                      )}
                      {showFavorites && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-charcoal-600">
                          Favorites
                        </span>
                      )}
                      {faceFilter && (
                        <button
                          type="button"
                          onClick={clearFaceFilter}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-charcoal-600 transition-colors hover:text-gold-700"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                          {faceFilter}
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-sm text-gold-700 transition-colors hover:text-gold-800 sm:ml-auto"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-1">
                  <div className="rounded-[1.5rem] border border-white/80 bg-white/72 p-4 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">
                      Browse mode
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {viewOptions.map((option) => {
                        const Icon = option.icon
                        const isActive = viewMode === option.key

                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setViewMode(option.key)}
                            aria-pressed={isActive}
                            className={cn(
                              'flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm transition-all',
                              isActive
                                ? 'cinematic-toggle-active'
                                : 'bg-cream-50 text-charcoal-500 hover:bg-gold-50/70 hover:text-charcoal-700'
                            )}
                          >
                            <Icon className={cn('h-4 w-4', isActive ? 'text-gold-300' : 'text-gold-500')} />
                            <span className="font-medium">{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/80 bg-white/72 p-4 shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">
                      Refine the story
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFavorites(!showFavorites)}
                        aria-pressed={showFavorites}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                          showFavorites
                            ? 'bg-[linear-gradient(145deg,rgba(248,227,233,0.95),rgba(255,247,235,0.92))] text-rose-700 shadow-[0_18px_38px_-26px_rgba(92,54,63,0.28)]'
                            : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70'
                        )}
                      >
                        <Heart className={cn('h-4 w-4', showFavorites && 'fill-current')} />
                        Favorites
                      </button>
                      <div className="inline-flex items-center gap-2 rounded-full bg-cream-50 px-4 py-2 text-sm text-charcoal-500">
                        <Filter className="h-4 w-4 text-gold-500" />
                        {filteredPhotos.length} visible
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-charcoal-500">
                      Mix categories, favorites, and face search to narrow the gallery without losing your place.
                    </p>
                  </div>
                </div>
              </div>

              {viewMode !== 'timeline' && viewMode !== 'map' && (
                <div className="mt-4 rounded-[1.5rem] border border-white/80 bg-white/72 p-4 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">
                    Chapters of the day
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        aria-pressed={selectedCategory === category}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                          selectedCategory === category
                            ? 'cinematic-toggle-active'
                            : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70 hover:text-charcoal-700'
                        )}
                      >
                        <span>{category}</span>
                        <span className={cn('text-xs', selectedCategory === category ? 'text-charcoal-700/80' : 'text-charcoal-400')}>
                          {categoryCounts[category] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-gold-700">
                Now viewing
              </p>
              <h2 className="mt-2 font-display text-3xl text-charcoal-900 sm:text-4xl">
                {activeView.label} view
              </h2>
              <p className="mt-2 max-w-2xl text-charcoal-600">
                {activeView.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500">
                <Images className="h-4 w-4 text-gold-500" />
                {visiblePhotoCount} on screen
              </div>
              {selectedCategory !== 'All' && (
                <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500">
                  {selectedCategory}
                </div>
              )}
            </div>
          </div>

          <div
            data-testid="gallery-results"
            className="rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-[0_28px_70px_-48px_rgba(46,33,13,0.38)] backdrop-blur-sm sm:p-6"
          >
            {isLoading ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <p className="mt-6 font-display text-2xl text-charcoal-900">
                  Gathering the gallery
                </p>
                <p className="mt-2 max-w-md text-charcoal-500">
                  Pulling in portraits, candids, and the loudest dance-floor moments.
                </p>
              </div>
            ) : filteredPhotos.length > 0 ? (
              <>
                {viewMode === 'map' ? (
                  <MapView
                    photos={filteredPhotos.map(photo => ({
                      id: photo.id,
                      url: photo.url,
                      thumbnail: photo.thumbnail,
                      caption: photo.caption,
                      location: photo.location || 'Reception Hall',
                      likes: photo.likes,
                      x: 50,
                      y: 50,
                    }))}
                    onPhotoClick={(photo) => openLightbox(filteredPhotos.findIndex(item => item.id === photo.id))}
                  />
                ) : viewMode === 'timeline' ? (
                  <TimelineView
                    photos={filteredPhotos}
                    onPhotoClick={(photo) => openLightbox(filteredPhotos.findIndex(item => item.id === photo.id))}
                  />
                ) : (
                  <>
                    <PhotoGrid
                      photos={displayedItems.map(photo => ({
                        ...photo,
                        comments: photo.comments?.length
                      }))}
                      viewMode={viewMode}
                      onPhotoClick={(_, index) => openLightbox(index)}
                    />

                    {hasMore && (
                      <div ref={observerRef} className="flex justify-center py-8">
                        {isLoadingMore ? (
                          <div className="flex items-center gap-2 rounded-full bg-cream-50 px-4 py-2 text-charcoal-500">
                            <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
                            Loading more moments...
                          </div>
                        ) : (
                          <Button variant="secondary" onClick={loadMore}>
                            Load more
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                  <Filter className="h-7 w-7" />
                </div>
                <p className="mt-6 font-display text-2xl text-charcoal-900">
                  No moments match this mix yet
                </p>
                <p className="mt-2 max-w-md text-charcoal-500">
                  Try a wider category, clear the face filter, or switch back to the full gallery.
                </p>
                <Button variant="secondary" className="mt-6" onClick={clearAllFilters}>
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 pt-8">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-[2rem] border border-charcoal-900/8 bg-[linear-gradient(135deg,rgba(247,241,232,0.92),rgba(252,250,246,0.98)_58%,rgba(244,232,213,0.86))] p-8 shadow-[0_28px_80px_-52px_rgba(46,33,13,0.45)] sm:p-10"
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-gold-700">
                  Add your angle
                </p>
                <h3 className="mt-3 font-display text-3xl text-charcoal-900 sm:text-4xl">
                  Help the gallery feel even more complete.
                </h3>
                <p className="mt-3 max-w-2xl text-charcoal-600">
                  We already have the portraits and the big moments. What we still love most are the in-between shots,
                  the table laughs, the phone candids, and the memories only your camera caught.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                <Button size="lg" to="/upload">
                  Share Your Photos
                </Button>
                <div className="inline-flex items-center gap-2 text-sm text-charcoal-500">
                  Review before publish
                  <ArrowRight className="h-4 w-4 text-gold-500" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Enhanced Lightbox */}
      <PhotoLightbox
        photos={filteredPhotos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={closeLightbox}
        onNavigate={setLightboxIndex}
        onLike={handleLike}
        onDownload={handleDownload}
        isDownloading={downloadingId !== null}
        onAddComment={handleAddComment}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Austin & Jordyn's Wedding Gallery"
        description="Check out these beautiful moments from our wedding day!"
        imageUrl={currentPhoto?.url}
      />
    </div>
  )
}
