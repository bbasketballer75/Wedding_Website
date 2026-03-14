import { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
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
  source: 'professional' | 'guest'
  collection: 'Engagement' | 'Bach+ette' | 'Wedding Day' | 'Guest Uploads'
}

interface DetectedFace {
  id: string
  name: string
  photoCount: number
  confidence?: number
  thumbnail?: string
  latestMoment?: string
}

type CollectionTab = 'All' | 'Professional' | 'Guest Uploads' | 'Engagement' | 'Bach+ette' | 'Wedding Day'

const collectionTabs: CollectionTab[] = ['All', 'Professional', 'Guest Uploads', 'Engagement', 'Bach+ette', 'Wedding Day']

const collectionMeta: Record<
  CollectionTab,
  {
    eyebrow: string
    title: string
    description: string
    supporting: string
    sourceHint: string
  }
> = {
  All: {
    eyebrow: 'Full archive',
    title: 'Everything we have so far',
    description: 'The complete mix of curated portraits, approved guest submissions, and the in-between frames that keep the day feeling alive.',
    supporting: 'Use this when you want the whole story in one pass.',
    sourceHint: 'Mixed source',
  },
  Professional: {
    eyebrow: 'Curated work',
    title: 'Professional coverage and polished edits',
    description: 'The formal portraits, ceremony coverage, and editorial frames that anchor the archive with the photographer’s eye.',
    supporting: 'Best for the big portraits and the polished storytelling beats.',
    sourceHint: 'Curated source',
  },
  'Guest Uploads': {
    eyebrow: 'From everyone we love',
    title: 'Guest uploads and personal camera-roll angles',
    description: 'Phone photos, table candids, dance floor snapshots, and the little perspectives only family and friends would catch.',
    supporting: 'Approved uploads stay clearly marked as guest-submitted so they never blur into the curated set.',
    sourceHint: 'Guest source',
  },
  Engagement: {
    eyebrow: 'Before the wedding',
    title: 'Proposal and engagement portraits',
    description: 'The proposal, the yes, the blue-hour portraits, and all the frames from the season when everything started feeling official.',
    supporting: 'This collection can now hold both photographer coverage and approved guest angles from engagement events.',
    sourceHint: 'Engagement chapter',
  },
  'Bach+ette': {
    eyebrow: 'Pre-wedding weekends',
    title: 'Bachelor and bachelorette memories',
    description: 'A dedicated lane for the pre-wedding celebrations, with room for both professional keepsakes and guest-submitted highlights.',
    supporting: 'As the album grows, this tab becomes the easiest way to revisit the full weekend energy.',
    sourceHint: 'Bach+ette chapter',
  },
  'Wedding Day': {
    eyebrow: 'The day itself',
    title: 'Ceremony, portraits, reception, and dance floor',
    description: 'The main wedding-day archive, where polished coverage and approved guest uploads can sit together without losing their source labels.',
    supporting: 'This is the best place to browse the day as one continuous story.',
    sourceHint: 'Wedding-day chapter',
  },
}

const curatedPhotos: Photo[] = [
  { 
    id: 'curated-1', 
    url: '/images/engagement/PoradaProposal-29.webp', 
    thumbnail: '/images/engagement/PoradaProposal-29.webp', 
    caption: 'The walk into the surprise', 
    category: 'Arrival', 
    likes: 24, 
    aspectRatio: 1.5,
    time: 'Golden hour',
    location: 'Proposal spot',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:00:00',
    faces: [
      { id: 'f1', name: 'Jordyn', x: 40, y: 35 },
      { id: 'f2', name: 'Austin', x: 65, y: 40 }
    ],
    tags: ['engagement', 'proposal', 'arrival'],
    comments: [
      { id: 'c1', author: 'Emma Photography', content: 'The exact moment the surprise started to click.', timestamp: 'Curated note' }
    ],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-2', 
    url: '/images/engagement/PoradaProposal-11.webp', 
    thumbnail: '/images/engagement/PoradaProposal-11.webp', 
    caption: 'A quiet pause before forever', 
    category: 'Portraits', 
    likes: 56, 
    aspectRatio: 0.67,
    time: 'Golden hour',
    location: 'Proposal spot',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:05:00',
    faces: [{ id: 'f3', name: 'Jordyn', x: 50, y: 45 }],
    tags: ['engagement', 'portrait', 'jordyn'],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-3', 
    url: '/images/engagement/PoradaProposal-150.webp', 
    thumbnail: '/images/engagement/PoradaProposal-150.webp', 
    caption: 'The question already answered in her smile', 
    category: 'Proposal', 
    likes: 42, 
    aspectRatio: 1.5,
    time: 'Proposal',
    location: 'Proposal spot',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:08:00',
    faces: [
      { id: 'f4', name: 'Austin', x: 35, y: 40 },
      { id: 'f5', name: 'Jordyn', x: 65, y: 40 }
    ],
    tags: ['engagement', 'proposal', 'yes'],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-4', 
    url: '/images/engagement/PoradaProposal-181.webp', 
    thumbnail: '/images/engagement/PoradaProposal-181.webp', 
    caption: 'Right after the yes', 
    category: 'Proposal', 
    likes: 89, 
    aspectRatio: 1.5,
    time: 'Immediately after',
    location: 'Proposal spot',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:10:00',
    faces: [
      { id: 'f6', name: 'Austin', x: 45, y: 45 },
      { id: 'f7', name: 'Jordyn', x: 55, y: 45 }
    ],
    tags: ['engagement', 'celebration', 'couple'],
    comments: [
      { id: 'c2', author: 'Emma Photography', content: 'The easiest smiles of the whole session.', timestamp: 'Curated note' }
    ],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-5', 
    url: '/images/engagement/PoradaProposal-255.webp', 
    thumbnail: '/images/engagement/PoradaProposal-255.webp', 
    caption: 'Calling the people who had to know first', 
    category: 'Celebration', 
    likes: 31, 
    aspectRatio: 1,
    time: 'Blue hour',
    location: 'After the proposal',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:18:00',
    faces: [
      { id: 'f8', name: 'Austin', x: 30, y: 50 },
      { id: 'f9', name: 'Jordyn', x: 70, y: 50 }
    ],
    tags: ['engagement', 'celebration', 'phone call'],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-6', 
    url: '/images/engagement/PoradaProposal-277.webp', 
    thumbnail: '/images/engagement/PoradaProposal-277.webp', 
    caption: 'The just-engaged portraits', 
    category: 'Portraits', 
    likes: 67, 
    aspectRatio: 0.75,
    time: 'Blue hour',
    location: 'Portraits',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:22:00',
    faces: [
      { id: 'f10', name: 'Austin', x: 40, y: 45 },
      { id: 'f11', name: 'Jordyn', x: 60, y: 45 }
    ],
    tags: ['engagement', 'portrait', 'romantic'],
    comments: [
      { id: 'c3', author: 'Emma Photography', content: 'These are the frames that already felt like them.', timestamp: 'Curated note' }
    ],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-7', 
    url: '/images/engagement/PoradaProposal-310.webp', 
    thumbnail: '/images/engagement/PoradaProposal-310.webp', 
    caption: 'A closer look at the ring', 
    category: 'Details', 
    likes: 45, 
    aspectRatio: 1.5,
    time: 'Detail frame',
    location: 'Portraits',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:26:00',
    faces: [
      { id: 'f12', name: 'Austin', x: 45, y: 40 },
      { id: 'f13', name: 'Jordyn', x: 55, y: 40 }
    ],
    tags: ['engagement', 'ring', 'details'],
    source: 'professional',
    collection: 'Engagement',
  },
  { 
    id: 'curated-8', 
    url: '/images/engagement/PoradaProposal-375.webp', 
    thumbnail: '/images/engagement/PoradaProposal-375.webp', 
    caption: 'The exhale after everything changed', 
    category: 'Portraits', 
    likes: 38, 
    aspectRatio: 1.5,
    time: 'End of the session',
    location: 'Portraits',
    photographer: 'Emma Photography',
    date: '2024-10-31',
    createdAt: '2024-10-31T18:32:00',
    faces: [
      { id: 'f14', name: 'Jordyn', x: 25, y: 50 },
      { id: 'f15', name: 'Austin', x: 50, y: 45 }
    ],
    tags: ['engagement', 'portrait', 'quiet moment'],
    source: 'professional',
    collection: 'Engagement',
  },
]

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
const deriveCollection = (photo: Pick<SupabasePhoto, 'is_professional' | 'category' | 'caption' | 'tags' | 'location'>): Photo['collection'] => {
  const normalizedCategory = (photo.category || '').trim().toLowerCase()

  if (normalizedCategory === 'engagement') {
    return 'Engagement'
  }

  if (
    normalizedCategory === 'bach+ette' ||
    normalizedCategory === 'bach' ||
    normalizedCategory === 'bachelorette' ||
    normalizedCategory === 'bachelor'
  ) {
    return 'Bach+ette'
  }

  if (normalizedCategory === 'wedding day') {
    return 'Wedding Day'
  }

  if (normalizedCategory === 'guest uploads' || normalizedCategory === 'guest upload') {
    return 'Guest Uploads'
  }

  const haystack = [
    photo.category,
    photo.caption,
    photo.location,
    ...(photo.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes('engagement') || haystack.includes('proposal')) {
    return 'Engagement'
  }

  if (
    haystack.includes('bach') ||
    haystack.includes('bachelorette') ||
    haystack.includes('bachelor') ||
    haystack.includes('ette')
  ) {
    return 'Bach+ette'
  }

  if (
    haystack.includes('wedding day') ||
    haystack.includes('wedding') ||
    haystack.includes('ceremony') ||
    haystack.includes('reception') ||
    haystack.includes('first dance') ||
    haystack.includes('dance floor') ||
    haystack.includes('portraits')
  ) {
    return 'Wedding Day'
  }

  if (!photo.is_professional) {
    return 'Guest Uploads'
  }

  return 'Wedding Day'
}

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
  source: photo.is_professional ? 'professional' : 'guest',
  collection: deriveCollection(photo),
})

export default function Gallery() {
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<CollectionTab>('All')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'masonry' | 'grid' | 'timeline' | 'map'>('masonry')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showFavorites, setShowFavorites] = useState(false)
  const [faceFilter, setFaceFilter] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [photos, setPhotos] = useState<Photo[]>(curatedPhotos)
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
          setLoadError('Could not load the live gallery right now. The curated collections below are still ready to browse.')
          return
        }

        const livePhotos = (data || []).map(mapSupabasePhoto)
        const mergedPhotos = [...curatedPhotos, ...livePhotos].reduce<Photo[]>((acc, photo) => {
          const duplicateIndex = acc.findIndex(existing =>
            existing.id === photo.id ||
            existing.url === photo.url ||
            existing.thumbnail === photo.thumbnail
          )

          if (duplicateIndex >= 0) {
            acc[duplicateIndex] = {
              ...acc[duplicateIndex],
              ...photo,
            }
          } else {
            acc.push(photo)
          }

          return acc
        }, [])

        setPhotos(mergedPhotos)
      } catch {
        setLoadError('Could not connect to the live gallery right now. The curated collections below are still ready to browse.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPhotos()
  }, [])

  useEffect(() => {
    const requestedQuery = searchParams.get('q') || ''
    const requestedCollection = searchParams.get('collection') as CollectionTab | null
    const requestedPhotoId = searchParams.get('photo')

    setSearchQuery((current) => (current !== requestedQuery ? requestedQuery : current))

    if (requestedCollection && collectionTabs.includes(requestedCollection)) {
      setSelectedCollection((current) => (current !== requestedCollection ? requestedCollection : current))
      return
    }

    if (!requestedCollection && requestedPhotoId) {
      const targetPhoto = photos.find((photo) => photo.id === requestedPhotoId)
      if (targetPhoto) {
        setSelectedCollection((current) => (current !== targetPhoto.collection ? targetPhoto.collection : current))
      }
    }
  }, [photos, searchParams])

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

  const collectionScopedPhotos = useMemo(() => {
    switch (selectedCollection) {
      case 'Professional':
        return sortedPhotos.filter(photo => photo.source === 'professional')
      case 'Guest Uploads':
        return sortedPhotos.filter(photo => photo.source === 'guest')
      case 'Engagement':
      case 'Bach+ette':
      case 'Wedding Day':
        return sortedPhotos.filter(photo => photo.collection === selectedCollection)
      default:
        return sortedPhotos
    }
  }, [selectedCollection, sortedPhotos])

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        collectionScopedPhotos
          .map(photo => photo.category)
          .filter(Boolean)
      )
    )

    return ['All', ...uniqueCategories]
  }, [collectionScopedPhotos])

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    return collectionScopedPhotos.filter((photo) => {
      const searchableText = [
        photo.caption,
        photo.location,
        photo.photographer,
        photo.collection,
        photo.source,
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
  }, [collectionScopedPhotos, deferredSearchQuery, selectedCategory, showFavorites, faceFilter])

  useEffect(() => {
    const requestedPhotoId = searchParams.get('photo')
    if (!requestedPhotoId || isLoading) {
      return
    }

    const photoIndex = filteredPhotos.findIndex((photo) => photo.id === requestedPhotoId)
    if (photoIndex >= 0 && lightboxIndex !== photoIndex) {
      setLightboxIndex(photoIndex)
    }
  }, [filteredPhotos, isLoading, lightboxIndex, searchParams])

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

  const peopleCount = useMemo(
    () => new Set(photos.flatMap(photo => (photo.faces || []).map(face => face.name))).size,
    [photos]
  )

  const detectedFaces = useMemo<DetectedFace[]>(
    () =>
      Array.from(
        photos.reduce<Map<string, DetectedFace>>((acc, photo) => {
          for (const face of photo.faces || []) {
            const existing = acc.get(face.name)
            if (existing) {
              existing.photoCount += 1
              if (!existing.thumbnail) {
                existing.thumbnail = photo.thumbnail || photo.url
              }
              if (!existing.latestMoment && photo.caption) {
                existing.latestMoment = photo.caption
              }
            } else {
              acc.set(face.name, {
                id: face.id || face.name.toLowerCase().replace(/\s+/g, '-'),
                name: face.name,
                photoCount: 1,
                thumbnail: photo.thumbnail || photo.url,
                latestMoment: photo.caption,
              })
            }
          }

          return acc
        }, new Map()).values()
      ).sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name)),
    [photos]
  )

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<string, number>>((acc, category) => {
      acc[category] = category === 'All'
        ? collectionScopedPhotos.length
        : collectionScopedPhotos.filter(photo => photo.category === category).length
      return acc
    }, {})
  }, [categories, collectionScopedPhotos])

  const collectionCounts = useMemo(() => {
    return collectionTabs.reduce<Record<CollectionTab, number>>((acc, tab) => {
      if (tab === 'All') {
        acc[tab] = photos.length
      } else if (tab === 'Professional') {
        acc[tab] = photos.filter(photo => photo.source === 'professional').length
      } else if (tab === 'Guest Uploads') {
        acc[tab] = photos.filter(photo => photo.source === 'guest').length
      } else {
        acc[tab] = photos.filter(photo => photo.collection === tab).length
      }

      return acc
    }, {
      All: 0,
      Professional: 0,
      'Guest Uploads': 0,
      Engagement: 0,
      'Bach+ette': 0,
      'Wedding Day': 0,
    })
  }, [photos])

  const selectedCollectionMeta = collectionMeta[selectedCollection]
  const selectedCollectionPreview = useMemo(() => {
    if (selectedCollection === 'All') {
      return photos[0] ?? null
    }

    if (selectedCollection === 'Professional') {
      return photos.find(photo => photo.source === 'professional') ?? null
    }

    if (selectedCollection === 'Guest Uploads') {
      return photos.find(photo => photo.source === 'guest') ?? null
    }

    return photos.find(photo => photo.collection === selectedCollection) ?? null
  }, [photos, selectedCollection])

  const visiblePhotoCount = viewMode === 'masonry' || viewMode === 'grid'
    ? displayedItems.length
    : filteredPhotos.length

  const activeView = viewOptions.find(option => option.key === viewMode) || viewOptions[0]
  const hasActiveFilters = Boolean(searchQuery || selectedCollection !== 'All' || selectedCategory !== 'All' || showFavorites || faceFilter)

  useEffect(() => {
    if (selectedCategory !== 'All' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All')
    }
  }, [categories, selectedCategory])

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
    setSelectedCollection('All')
    setSelectedCategory('All')
    setShowFavorites(false)
    setFaceFilter(null)
  }

  const currentPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null
  const emptyStateTitle =
    selectedCollection === 'All'
      ? 'No moments match this mix yet'
      : `${selectedCollectionMeta.title} is waiting for the next upload`

  const emptyStateBody =
    selectedCollection === 'All'
      ? 'Try a wider collection, clear the face filter, or switch back to the full gallery.'
      : `${selectedCollectionMeta.description} ${selectedCollectionMeta.supporting}`

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
                  Move between curated collections, guest-submitted memories, and the growing archive of portraits,
                  candids, and celebration frames without losing the core search and lightbox experience.
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
                    {collectionTabs.length - 1} named collections
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[ 
                  { label: 'Captured', value: photos.length.toString(), detail: 'Curated frames plus approved live uploads' },
                  { label: 'Showing', value: filteredPhotos.length.toString(), detail: hasActiveFilters ? 'Matching the current collection and filters' : 'Visible in the full archive' },
                  { label: 'Guest uploads', value: collectionCounts['Guest Uploads'].toString(), detail: 'Approved photos submitted by family and friends' },
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
              <div className="mb-4 overflow-hidden rounded-[1.6rem] border border-gold-200/65 bg-[linear-gradient(135deg,rgba(255,252,247,0.9),rgba(248,242,233,0.95)_52%,rgba(243,234,221,0.88))] shadow-[0_22px_58px_-46px_rgba(46,33,13,0.3)]">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                  <div className="p-5 sm:p-6">
                    <p className="text-[10px] uppercase tracking-[0.34em] text-gold-700">
                      {selectedCollectionMeta.eyebrow}
                    </p>
                    <h2 className="mt-3 font-display text-3xl text-charcoal-900 sm:text-[2.25rem]">
                      {selectedCollectionMeta.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-charcoal-600 sm:text-[0.98rem]">
                      {selectedCollectionMeta.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-charcoal-500">
                        {collectionCounts[selectedCollection]} visible in this lane
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-charcoal-500">
                        {selectedCollectionMeta.sourceHint}
                      </span>
                    </div>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-charcoal-500">
                      {selectedCollectionMeta.supporting}
                    </p>
                  </div>

                  <div className="border-t border-gold-200/60 bg-white/55 p-4 lg:border-l lg:border-t-0">
                    {selectedCollectionPreview ? (
                      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/80 bg-charcoal-200 shadow-sm">
                        <img
                          src={selectedCollectionPreview.thumbnail || selectedCollectionPreview.url}
                          alt={selectedCollectionPreview.caption || selectedCollectionMeta.title}
                          className="aspect-[1.25/1] w-full object-cover"
                          loading="lazy"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(27,22,16,0.02),rgba(27,22,16,0.18)_40%,rgba(27,22,16,0.72))]" />
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-200/92">
                            {selectedCollectionPreview.source === 'professional' ? 'Professional frame' : 'Guest-submitted frame'}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/92">
                            {selectedCollectionPreview.caption || selectedCollectionMeta.title}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[13rem] flex-col items-start justify-between rounded-[1.35rem] border border-dashed border-gold-200/80 bg-cream-50/80 p-5 text-left">
                        <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-gold-700">
                          Collection cover
                        </div>
                        <div>
                          <p className="font-display text-2xl text-charcoal-900">
                            Ready for the next standout frame
                          </p>
                          <p className="mt-2 text-sm leading-6 text-charcoal-500">
                            The structure is live. Once more images land in this collection, the cover spot will update automatically.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                  <div className="mb-4 rounded-[1.25rem] border border-gold-200/80 bg-cream-50/80 p-3">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">
                      Collections
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {collectionTabs.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSelectedCollection(tab)}
                          aria-pressed={selectedCollection === tab}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                            selectedCollection === tab
                              ? 'cinematic-toggle-active'
                              : 'bg-white text-charcoal-600 hover:bg-gold-50/80 hover:text-charcoal-800'
                          )}
                        >
                          <span>{tab}</span>
                          <span className={cn('text-xs', selectedCollection === tab ? 'text-charcoal-700/80' : 'text-charcoal-400')}>
                            {collectionCounts[tab]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

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
                      <FaceRecognition onPhotoFilter={handleFaceFilter} detectedFaces={detectedFaces} />
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
                      {selectedCollection !== 'All' && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-charcoal-600">
                          Collection: {selectedCollection}
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
                      Start with a collection, then narrow by chapter, favorites, or face search without losing your place in the archive.
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
              {selectedCollection !== 'All' && (
                <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500">
                  {selectedCollection}
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
                  Pulling in curated collections, approved uploads, and the latest archive updates.
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
                  {emptyStateTitle}
                </p>
                <p className="mt-2 max-w-md text-charcoal-500">
                  {emptyStateBody}
                </p>
                <Button variant="secondary" className="mt-6" onClick={clearAllFilters}>
                  Return to all collections
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
