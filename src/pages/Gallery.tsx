import { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { GallerySEO } from '@/components/seo/SEOHead'
import { PhotoGrid } from '@/components/gallery/PhotoGrid'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { FaceRecognition } from '@/components/face-recognition/FaceRecognition'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { downloadFile } from '@/utils/download'
import { getMediaPath } from '@/utils/media'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { Search, Grid3X3, LayoutGrid, Filter, Loader2, Images, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addPhotoComment,
  fetchPhotoEngagementSummary,
  fetchPhotoComments,
  fetchPhotoLikeStatuses,
  supabase,
  togglePhotoLike,
  Photo as SupabasePhoto,
} from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'

// Extended photo type with faces and comments
interface Photo {
  id: string
  url: string
  thumbnail: string
  downloadUrl?: string
  album?: string
  albumSortOrder?: number
  caption?: string
  category: string
  likes: number
  aspectRatio: number
  time?: string
  photographer?: string
  faces?: Array<{
    id: string
    name: string
    x: number
    y: number
    box?: {
      left: number
      top: number
      width: number
      height: number
    } | null
  }>
  tags?: string[]
  location?: string
  date?: string
  comments?: Array<{ id: string; author: string; content: string; timestamp: string }>
  commentCount?: number
  createdAt?: string
  liked?: boolean
  likeCount?: number
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
  collections?: string[]
  professionalCount?: number
  guestCount?: number
}

type CollectionTab = 'All' | 'Guest Uploads' | 'Engagement' | 'Bach+ette' | 'Wedding Day'

const collectionTabs: CollectionTab[] = ['All', 'Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads']

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
    description: 'The full wedding archive in one place.',
    supporting: 'Use this when you want every published moment in one pass.',
    sourceHint: 'Mixed source',
  },
  'Guest Uploads': {
    eyebrow: 'From family and friends',
    title: 'Guest uploads',
    description: 'Approved uploads and camera-roll angles from everyone who was there.',
    supporting: 'This stays separate from the photographer coverage on purpose.',
    sourceHint: 'Guest album',
  },
  Engagement: {
    eyebrow: 'Before the wedding',
    title: 'Proposal and engagement portraits',
    description: 'The proposal, portraits, and the whole season before the wedding day.',
    supporting: 'Everything from the engagement chapter lives here.',
    sourceHint: 'Engagement album',
  },
  'Bach+ette': {
    eyebrow: 'Pre-wedding weekends',
    title: 'Bachelor and bachelorette memories',
    description: 'The full pre-wedding weekend album.',
    supporting: 'Everything from the bachelor and bachelorette events lives here.',
    sourceHint: 'Bach+ette album',
  },
  'Wedding Day': {
    eyebrow: 'The day itself',
    title: 'Wedding day coverage',
    description: 'The photographer-led archive for the day itself.',
    supporting: 'This is the main album for ceremony, portraits, and reception coverage.',
    sourceHint: 'Wedding-day album',
  },
}

const curatedPhotos = ([
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
 ] satisfies Array<Omit<Photo, 'albumSortOrder'>>).map((photo, index): Photo => ({
  ...photo,
  albumSortOrder: index + 1,
}))

const viewOptions = [
  {
    key: 'masonry',
    label: 'Masonry',
    icon: LayoutGrid,
  },
  {
    key: 'grid',
    label: 'Grid',
    icon: Grid3X3,
  },
] as const

const normalizeGalleryMediaPath = (path?: string | null): string => {
  if (!path) {
    return ''
  }

  return getMediaPath(path)
}

const normalizeGalleryPhoto = (photo: Photo): Photo => ({
  ...photo,
  url: normalizeGalleryMediaPath(photo.url),
  thumbnail: normalizeGalleryMediaPath(photo.thumbnail || photo.url),
  downloadUrl: normalizeGalleryMediaPath(photo.downloadUrl || photo.url),
})

const PHOTO_ENGAGEMENT_SESSION_KEY = 'wedding-gallery-engagement-session'
const PHOTO_COMMENT_AUTHOR_KEY = 'wedding-gallery-comment-author'

const getPhotoEngagementSessionId = () => {
  if (typeof window === 'undefined') {
    return 'server-preview-session'
  }

  const existingSessionId = window.localStorage.getItem(PHOTO_ENGAGEMENT_SESSION_KEY)
  if (existingSessionId) {
    return existingSessionId
  }

  const generatedSessionId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  window.localStorage.setItem(PHOTO_ENGAGEMENT_SESSION_KEY, generatedSessionId)
  return generatedSessionId
}

const formatPhotoCommentTimestamp = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

// Helper to convert Supabase photo to local Photo type
const normalizeCollectionValue = (value?: string | null): Photo['collection'] | null => {
  const normalized = (value || '').trim().toLowerCase()

  if (normalized === 'engagement') {
    return 'Engagement'
  }

  if (
    normalized === 'bach+ette' ||
    normalized === 'bach' ||
    normalized === 'bachelorette' ||
    normalized === 'bachelor'
  ) {
    return 'Bach+ette'
  }

  if (normalized === 'wedding day' || normalized === 'wedding-day') {
    return 'Wedding Day'
  }

  if (
    normalized === 'guest uploads' ||
    normalized === 'guest-upload' ||
    normalized === 'guest'
  ) {
    return 'Guest Uploads'
  }

  return null
}

const deriveCollection = (
  photo: Pick<SupabasePhoto, 'album' | 'is_professional' | 'category' | 'caption' | 'tags' | 'location' | 'url' | 'thumbnail'>
): Photo['collection'] => {
  const normalizedAlbum = normalizeCollectionValue(photo.album)
  if (normalizedAlbum) {
    return normalizedAlbum
  }

  const normalizedCategory = normalizeCollectionValue(photo.category)
  if (normalizedCategory) {
    return normalizedCategory
  }

  if (!photo.is_professional) {
    return 'Guest Uploads'
  }

  const pathAndTags = [
    photo.url,
    photo.thumbnail,
    ...(photo.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (pathAndTags.includes('engagement') || pathAndTags.includes('proposal')) {
    return 'Engagement'
  }

  if (
    pathAndTags.includes('bach') ||
    pathAndTags.includes('bachelorette') ||
    pathAndTags.includes('bachelor') ||
    pathAndTags.includes('ette')
  ) {
    return 'Bach+ette'
  }

  return 'Wedding Day'
}

const mapSupabasePhoto = (photo: SupabasePhoto): Photo => normalizeGalleryPhoto({
  id: photo.id,
  url: photo.url,
  thumbnail: photo.thumbnail,
  downloadUrl: photo.download_url ?? photo.url,
  caption: photo.caption,
  album: photo.album,
  albumSortOrder: photo.album_sort_order ?? undefined,
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
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<CollectionTab>('All')
  const [viewMode, setViewMode] = useState<'masonry' | 'grid'>('masonry')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [faceFilter, setFaceFilter] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>(() => curatedPhotos.map(normalizeGalleryPhoto))
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [engagementSessionId] = useState(getPhotoEngagementSessionId)
  const [submittingCommentPhotoId, setSubmittingCommentPhotoId] = useState<string | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const galleryScrollRef = useRef<HTMLDivElement>(null)

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
          setLoadError('The live gallery is taking a moment — the collections below are still ready to explore.')
          return
        }

        const livePhotos = (data || []).map(mapSupabasePhoto)
        const mergedPhotos = [...curatedPhotos.map(normalizeGalleryPhoto), ...livePhotos].reduce<Photo[]>((acc, photo) => {
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

        const [likeStatusResult, engagementSummaryResult] = await Promise.all([
          fetchPhotoLikeStatuses(
            mergedPhotos.map((photo) => photo.id),
            engagementSessionId
          ),
          fetchPhotoEngagementSummary(mergedPhotos.map((photo) => photo.id)),
        ])

        const likeStatusResponse = likeStatusResult.data
        const likeStatuses = Array.isArray(likeStatusResponse) ? likeStatusResponse : []
        const engagementSummaries = Array.isArray(engagementSummaryResult.data) ? engagementSummaryResult.data : []

        const likeStatusByPhotoId = new Map(
          likeStatuses.map((status) => [status.photo_key, status] as const)
        )
        const engagementSummaryByPhotoId = new Map(
          engagementSummaries.map((summary) => [summary.photo_key, summary] as const)
        )

        setPhotos(
          mergedPhotos.map((photo) => {
            const likeStatus = likeStatusByPhotoId.get(photo.id)
            const engagementSummary = engagementSummaryByPhotoId.get(photo.id)

            return {
              ...photo,
              likes: likeStatus?.likes_count ?? engagementSummary?.likes_count ?? photo.likes,
              likeCount: likeStatus?.likes_count ?? engagementSummary?.likes_count ?? photo.likes,
              liked: likeStatus?.liked ?? photo.liked,
              commentCount: engagementSummary?.comments_count ?? photo.comments?.length ?? 0,
            }
          })
        )
      } catch {
        setLoadError('Could not connect to the live gallery right now. The curated collections below are still ready to browse.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPhotos()
  }, [engagementSessionId])

  useEffect(() => {
    const requestedQuery = searchParams.get('q') || ''
    const requestedCollection = searchParams.get('collection') as CollectionTab | null
    const requestedPhotoId = searchParams.get('photo')
    const requestedPerson = searchParams.get('person')

    setSearchQuery((current) => (current !== requestedQuery ? requestedQuery : current))
    setFaceFilter((current) => (current !== requestedPerson ? requestedPerson : current))

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

  const newestFirstPhotos = useMemo(
    () => [...photos].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [photos],
  )

  const albumOrderedPhotos = useMemo(
    () =>
      [...photos].sort((a, b) => {
        const leftOrder = Number.isFinite(a.albumSortOrder) ? Number(a.albumSortOrder) : Number.MAX_SAFE_INTEGER
        const rightOrder = Number.isFinite(b.albumSortOrder) ? Number(b.albumSortOrder) : Number.MAX_SAFE_INTEGER

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      }),
    [photos],
  )

  const collectionScopedPhotos = useMemo(() => {
    switch (selectedCollection) {
      case 'Guest Uploads':
      case 'Engagement':
      case 'Bach+ette':
      case 'Wedding Day':
        return albumOrderedPhotos.filter(photo => photo.collection === selectedCollection)
      default:
        return newestFirstPhotos
    }
  }, [albumOrderedPhotos, newestFirstPhotos, selectedCollection])

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    return collectionScopedPhotos.filter((photo) => {
      const searchableText = [
        photo.caption,
        photo.location,
        photo.photographer,
        photo.collection,
        photo.source,
        ...(photo.faces || []).map((face) => face.name),
        ...(photo.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery)
      const matchesFace = !faceFilter || photo.faces?.some(f => f.name === faceFilter)
      
      return matchesSearch && matchesFace
    })
  }, [collectionScopedPhotos, deferredSearchQuery, faceFilter])

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
    itemsPerPage: viewMode === 'grid' ? 18 : 12,
    rootRef: galleryScrollRef,
  })

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
              if (!existing.collections?.includes(photo.collection)) {
                existing.collections = [...(existing.collections || []), photo.collection]
              }
              if (photo.source === 'professional') {
                existing.professionalCount = (existing.professionalCount || 0) + 1
              } else {
                existing.guestCount = (existing.guestCount || 0) + 1
              }
            } else {
              acc.set(face.name, {
                id: face.id || face.name.toLowerCase().replace(/\s+/g, '-'),
                name: face.name,
                photoCount: 1,
                thumbnail: photo.thumbnail || photo.url,
                latestMoment: photo.caption,
                collections: [photo.collection],
                professionalCount: photo.source === 'professional' ? 1 : 0,
                guestCount: photo.source === 'guest' ? 1 : 0,
              })
            }
          }

          return acc
        }, new Map()).values()
      ).sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name)),
    [photos]
  )
  const collectionCounts = useMemo(() => {
    return collectionTabs.reduce<Record<CollectionTab, number>>((acc, tab) => {
      if (tab === 'All') {
        acc[tab] = photos.length
      } else {
        acc[tab] = photos.filter(photo => photo.collection === tab).length
      }

      return acc
    }, {
      All: 0,
      'Guest Uploads': 0,
      Engagement: 0,
      'Bach+ette': 0,
      'Wedding Day': 0,
    })
  }, [photos])

  const selectedCollectionMeta = collectionMeta[selectedCollection]
  const hasActiveFilters = Boolean(searchQuery || selectedCollection !== 'All' || faceFilter)

  const openLightbox = (index: number) => {
    if (index >= 0) {
      setLightboxIndex(index)
    }
  }

  const closeLightbox = () => setLightboxIndex(null)

  const handleLike = (photoId: string) => {
    void (async () => {
      const { data } = await togglePhotoLike(photoId, engagementSessionId)

      if (!data) {
        return
      }

      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                liked: data.liked,
                likes: data.likes_count,
                likeCount: data.likes_count,
              }
            : photo
        )
      )
    })()
  }

  const handleDownload = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId)
    if (!photo) return
    
    setDownloadingId(photoId)
    try {
      const filename = `Austin-Jordyn-Wedding-${photo.caption || photo.id}.jpg`
      await downloadFile(photo.downloadUrl || photo.url, filename)
    } catch {
      // Error handled via UI
    }
    setDownloadingId(null)
  }

  const handleAddComment = async (photoId: string, payload: { author: string; content: string }) => {
    const normalizedContent = payload.content.trim()
    const normalizedAuthor = payload.author.trim() || 'Guest'

    if (!normalizedContent) {
      return false
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PHOTO_COMMENT_AUTHOR_KEY, normalizedAuthor)
    }

    const optimisticComment = {
      id: `pending-${Date.now()}`,
      author: normalizedAuthor,
      content: normalizedContent,
      timestamp: 'Sending...',
    }

    setSubmittingCommentPhotoId(photoId)
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              comments: [...(photo.comments || []), optimisticComment],
              commentCount: (photo.commentCount ?? photo.comments?.length ?? 0) + 1,
            }
          : photo
      )
    )

    const { data, error } = await addPhotoComment(photoId, normalizedContent, normalizedAuthor, engagementSessionId)

    if (error || !data) {
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                comments: (photo.comments || []).filter((comment) => comment.id !== optimisticComment.id),
                commentCount: Math.max((photo.commentCount ?? photo.comments?.length ?? 1) - 1, 0),
              }
            : photo
        )
      )
      setSubmittingCommentPhotoId((current) => (current === photoId ? null : current))
      addToast('That didn\'t go through — try again in a moment.', 'error')
      return false
    }

    const newComment = {
      id: data.id,
      author: data.author,
      content: data.content,
      timestamp: formatPhotoCommentTimestamp(data.created_at),
    }

    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              comments: (photo.comments || []).map((comment) =>
                comment.id === optimisticComment.id ? newComment : comment
              ),
            }
          : photo
      )
    )
    setSubmittingCommentPhotoId((current) => (current === photoId ? null : current))
    return true
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
    setFaceFilter(null)
  }

  const emptyStateTitle =
    selectedCollection === 'All'
      ? 'No moments match this mix yet'
      : `${selectedCollectionMeta.title} is waiting for the next upload`

  const emptyStateBody =
    selectedCollection === 'All'
      ? 'Try a wider collection, clear the face filter, or switch back to the full gallery.'
      : `${selectedCollectionMeta.description} ${selectedCollectionMeta.supporting}`

  useEffect(() => {
    galleryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedCollection, deferredSearchQuery, faceFilter, viewMode])

  useEffect(() => {
    if (lightboxIndex === null) {
      return
    }

    const activePhoto = filteredPhotos[lightboxIndex]
    if (!activePhoto || activePhoto.comments) {
      return
    }

    let cancelled = false

    void (async () => {
      const { data } = await fetchPhotoComments(activePhoto.id)
      if (cancelled || !data) {
        return
      }

      const mappedComments = data.map((comment) => ({
        id: comment.id,
        author: comment.author,
        content: comment.content,
        timestamp: formatPhotoCommentTimestamp(comment.created_at),
      }))

      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === activePhoto.id
            ? {
                ...photo,
                comments: mappedComments,
                commentCount: mappedComments.length,
              }
            : photo
        )
      )
    })()

    return () => {
      cancelled = true
    }
  }, [filteredPhotos, lightboxIndex])

  return (
    <div className="min-h-screen bg-cream-50 pt-24 pb-20">
      <GallerySEO />

      <section className="px-4 pb-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-gold-700">
                  Gallery
                </p>
                <h1 className="mt-2 font-display text-4xl text-charcoal-900 sm:text-5xl">
                  Browse the archive
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-charcoal-600 sm:text-base">
                  Start with the album you want, then use search or people browsing only when you need it.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500 shadow-sm">
                <Images className="h-4 w-4 text-gold-500" />
                {filteredPhotos.length} visible
              </div>
            </div>

            <div className="mt-8 border-t border-charcoal-900/8 pt-6">
              <div
                data-testid="gallery-control-bar"
                className="rounded-[1.6rem] border border-white/80 bg-white/78 p-4 shadow-[0_24px_64px_-48px_rgba(46,33,13,0.34)] backdrop-blur-sm sm:p-5"
              >
                <div className="flex flex-wrap gap-2">
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
                          : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70 hover:text-charcoal-800'
                      )}
                    >
                      <span>{tab}</span>
                      <span className={cn('text-xs', selectedCollection === tab ? 'text-charcoal-700/80' : 'text-charcoal-400')}>
                        {collectionCounts[tab]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
                    <Input
                      type="text"
                      placeholder="Search the archive"
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

                  <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-cream-50/90 p-1">
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
                            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                            isActive
                              ? 'bg-gold-500 text-white shadow-sm'
                              : 'text-charcoal-500 hover:bg-white hover:text-charcoal-700'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="justify-self-start xl:justify-self-end">
                    <FaceRecognition onPhotoFilter={handleFaceFilter} detectedFaces={detectedFaces} />
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-charcoal-900/8 pt-4">
                    <span className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">
                      Active filters
                    </span>
                    {selectedCollection !== 'All' && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600">
                        {selectedCollection}
                      </span>
                    )}
                    {searchQuery && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600">
                        “{searchQuery}”
                      </span>
                    )}
                    {faceFilter && (
                      <button
                        type="button"
                        onClick={clearFaceFilter}
                        className="inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600 transition-colors hover:text-gold-700"
                      >
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

            </div>
          </motion.div>
        </div>
      </section>

      <section className="flex-1 min-h-0 px-4 pb-8">
        <div className="mx-auto max-w-7xl">
          {loadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-700"
            >
              {loadError}
            </motion.div>
          )}

          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-3xl text-charcoal-900 sm:text-4xl">
                {selectedCollection}
              </h2>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500">
              <Images className="h-4 w-4 text-gold-500" />
              {displayedItems.length} on screen
            </div>
          </div>

          <div
            data-testid="gallery-results"
            className="rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-[0_28px_70px_-48px_rgba(46,33,13,0.38)] backdrop-blur-sm sm:p-6"
          >
            <div
              ref={galleryScrollRef}
              className="overflow-visible lg:h-[calc(100vh-18rem)] lg:min-h-[32rem] lg:overflow-y-auto lg:pr-1"
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
                <PhotoGrid
                  photos={displayedItems}
                  viewMode={viewMode}
                  onPhotoClick={(_, index) => openLightbox(index)}
                  onLike={handleLike}
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
        isSubmittingComment={submittingCommentPhotoId === filteredPhotos[lightboxIndex ?? 0]?.id}
        highlightedFaceName={faceFilter}
      />
    </div>
  )
}
