import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
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
import { Search, Grid3X3, LayoutGrid, Heart, Filter, Sparkles, Share2, Clock, MapPin, Loader2 } from 'lucide-react'
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
          // Error handled via UI
          setLoadError('Could not load photos from database. Using sample photos.')
          // Keep using sample photos as fallback
          return
        }

        if (data && data.length > 0) {
          // Map Supabase photos to local format
          const mappedPhotos = data.map(mapSupabasePhoto)
          setPhotos(mappedPhotos)
        }
        // If no data, keep using sample photos
      } catch {
        // Error handled via UI
        setLoadError('Could not connect to database. Using sample photos.')
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

  // Filter photos
  const filteredPhotos = useMemo(() => {
    return sortedPhotos.filter((photo) => {
      const matchesSearch = photo.caption?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || photo.category === selectedCategory
      const matchesFavorites = !showFavorites || (photo.likes && photo.likes > 40)
      const matchesFace = !faceFilter || photo.faces?.some(f => f.name === faceFilter)
      
      return matchesSearch && matchesCategory && matchesFavorites && matchesFace
    })
  }, [sortedPhotos, searchQuery, selectedCategory, showFavorites, faceFilter])

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

  const currentPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null

  return (
    <div className="min-h-screen bg-cream-50 pt-24 pb-20">
      {/* Header */}
      <section className="px-4 mb-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <span className="text-gold-600 text-sm uppercase tracking-[0.3em] font-medium">
              Our Gallery
            </span>
            <h1 className="font-display text-5xl md:text-7xl text-charcoal-900 mt-4 mb-4">
              {photos.length} Moments
            </h1>
            <p className="text-charcoal-600 max-w-xl mx-auto">
              Every laugh, every tear, every dance move captured from our perfect day
            </p>
          </motion.div>

          {/* Loading Indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center py-4"
            >
              <div className="flex items-center gap-2 text-charcoal-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading photos...</span>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {loadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-xl mx-auto"
            >
              <p className="text-amber-700 text-sm text-center">{loadError}</p>
            </motion.div>
          )}

          {/* Search & Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6"
          >
            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              <Input
                type="text"
                placeholder="Search photos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* Sort Dropdown */}
              <SortDropdown value={sortBy} onChange={setSortBy} />

              {/* Face Recognition Button */}
              <FaceRecognition onPhotoFilter={handleFaceFilter} />
              
              {/* Share Gallery Button */}
              <Button variant="glass" size="sm" onClick={() => setShareModalOpen(true)}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-white rounded-full p-1 border border-gold-200/60">
                <button
                  onClick={() => setViewMode('masonry')}
                  type="button"
                  aria-label="Switch to masonry view"
                  aria-pressed={viewMode === 'masonry'}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    viewMode === 'masonry' ? "bg-gold-100 text-gold-700" : "text-charcoal-400 hover:text-charcoal-600"
                  )}
                  title="Masonry view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  type="button"
                  aria-label="Switch to grid view"
                  aria-pressed={viewMode === 'grid'}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    viewMode === 'grid' ? "bg-gold-100 text-gold-700" : "text-charcoal-400 hover:text-charcoal-600"
                  )}
                  title="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  type="button"
                  aria-label="Switch to timeline view"
                  aria-pressed={viewMode === 'timeline'}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    viewMode === 'timeline' ? "bg-gold-100 text-gold-700" : "text-charcoal-400 hover:text-charcoal-600"
                  )}
                  title="Timeline view"
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  type="button"
                  aria-label="Switch to map view"
                  aria-pressed={viewMode === 'map'}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    viewMode === 'map' ? "bg-gold-100 text-gold-700" : "text-charcoal-400 hover:text-charcoal-600"
                  )}
                  title="Map view"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>

              {/* Favorites Toggle */}
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                type="button"
                aria-pressed={showFavorites}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all",
                  showFavorites 
                    ? "bg-rose-100 text-rose-700" 
                    : "bg-white border border-gold-200/60 text-charcoal-600 hover:bg-gold-50"
                )}
              >
                <Heart className={cn("w-4 h-4", showFavorites && "fill-current")} />
                Favorites
              </button>
            </div>
          </motion.div>

          {/* Face Filter Active Indicator */}
          {faceFilter && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 mb-4"
            >
              <span className="text-charcoal-600 text-sm">Showing photos of:</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gold-100 text-gold-800 rounded-full text-sm font-medium">
                <Sparkles className="w-3 h-3" />
                {faceFilter}
                <button 
                  onClick={clearFaceFilter}
                  type="button"
                  aria-label="Clear face filter"
                  className="ml-1 hover:text-gold-600"
                >
                  ×
                </button>
              </span>
              <span className="text-charcoal-400 text-sm">
                ({filteredPhotos.length} photos)
              </span>
            </motion.div>
          )}

          {/* Category Filters - Only show for non-timeline/map views */}
          {viewMode !== 'timeline' && viewMode !== 'map' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-wrap justify-center gap-2 mb-8"
            >
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  type="button"
                  aria-pressed={selectedCategory === category}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm transition-all",
                    selectedCategory === category
                      ? "bg-gold-500 text-white"
                      : "bg-white border border-gold-200/60 text-charcoal-600 hover:border-gold-400"
                  )}
                >
                  {category}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Photo Grid / Timeline / Map */}
      <section className="px-4">
        <div className="max-w-7xl mx-auto">
          {filteredPhotos.length > 0 ? (
            <>
              {viewMode === 'map' ? (
                <MapView
                  photos={filteredPhotos.map(p => ({
                    id: p.id,
                    url: p.url,
                    thumbnail: p.thumbnail,
                    caption: p.caption,
                    location: p.location || 'Reception Hall',
                    likes: p.likes,
                    x: 50,
                    y: 50,
                  }))}
                  onPhotoClick={(photo) => openLightbox(filteredPhotos.findIndex(p => p.id === photo.id))}
                />
              ) : viewMode === 'timeline' ? (
                <TimelineView
                  photos={filteredPhotos}
                  onPhotoClick={(photo) => openLightbox(filteredPhotos.findIndex((galleryPhoto) => galleryPhoto.id === photo.id))}
                />
              ) : (
                <>
                  <PhotoGrid
                    photos={displayedItems.map(p => ({
                      ...p,
                      comments: p.comments?.length
                    }))}
                    viewMode={viewMode as 'masonry' | 'grid'}
                    onPhotoClick={(_, index) => openLightbox(index)}
                  />
                  
                  {/* Infinite Scroll Observer */}
                  {hasMore && (
                    <div
                      ref={observerRef}
                      className="flex justify-center py-8"
                    >
                      {isLoadingMore ? (
                        <div className="flex items-center gap-2 text-charcoal-400">
                          <div className="w-5 h-5 border-2 border-gold-300 border-t-gold-500 rounded-full animate-spin" />
                          <span>Loading more...</span>
                        </div>
                      ) : (
                        <Button variant="secondary" onClick={loadMore}>
                          Load More
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <Filter className="w-12 h-12 text-gold-300 mx-auto mb-4" />
              <p className="text-charcoal-600 text-lg mb-2">No photos match your filters</p>
              <p className="text-charcoal-400 text-sm">Try adjusting your search or category</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-gold-100/50 to-cream-100 rounded-2xl p-8 md:p-12">
            <h3 className="font-display text-2xl md:text-3xl text-charcoal-900 mb-4">
              Have Photos From Our Day?
            </h3>
            <p className="text-charcoal-600 mb-6 max-w-lg mx-auto">
              We would love to see your perspective! Share your photos and videos to help us complete our wedding album.
            </p>
            <Button size="lg" to="/upload">
              Share Your Photos
            </Button>
          </div>
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
