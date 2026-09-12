/**
 * useGalleryData — extracted from src/pages/Gallery.tsx.
 *
 * Owns the photo data state: initial curated photos, Supabase fetch + merge,
 * engagement hydration. Exposes the data + setters the page consumes.
 *
 * Returns:
 *   photos:               full filtered+merged+hydrated list
 *   collection:           currently selected collection tab (controls nothing internally yet)
 *   isLoading:            true while the initial Supabase fetch is in flight
 *   loadError:            non-null if the fetch failed
 *   setCollection:        collection setter (caller is responsible for filtering)
 *   reload:               refetch helper (used after like/comment mutations)
 *
 * NOTE: filtering (by collection / face / search) is intentionally NOT here —
 * it stays in the page component because it composes with search/face state
 * owned by the page. Keeping the hook narrowly scoped.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  fetchPhotoEngagementSummary,
  fetchPhotoLikeStatuses,
  supabase,
  type Photo,
} from '@/lib/supabase'
import { type CollectionTab } from '@/components/gallery/constants'
import { mapSupabasePhoto, type GalleryPhoto } from '@/components/gallery/data'
import { getPhotoEngagementSessionId } from '@/components/gallery/constants'

const PAGE_SIZE = 1000

export interface UseGalleryDataResult {
  photos: GalleryPhoto[]
  collection: CollectionTab
  isLoading: boolean
  loadError: string | null
  setCollection: (next: CollectionTab) => void
  setPhotos: Dispatch<SetStateAction<GalleryPhoto[]>>
  reload: () => void
}

export function useGalleryData(
  initialCollection: CollectionTab = 'Proposal',
  initialPhotos: GalleryPhoto[] = [],
  curatedPhotosNormalized: GalleryPhoto[] = []
): UseGalleryDataResult {
  const [collection, setCollection] = useState<CollectionTab>(initialCollection)
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Stable per-mount engagement session id (browser-only).
  const [engagementSessionId] = useState(() => getPhotoEngagementSessionId())

  const fetchPhotos = useCallback(async () => {
    const curated = curatedPhotosNormalized.length > 0 ? curatedPhotosNormalized : initialPhotos
    try {
      setIsLoading(true)
      setLoadError(null)

      let allRows: Photo[] = []
      let from = 0
      let fetchError: unknown = null

      while (true) {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)

        if (error) {
          fetchError = error
          break
        }
        if (!data || data.length === 0) break
        allRows = [...allRows, ...data]
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }

      if (fetchError) {
        setLoadError(
          'The live gallery is taking a moment — the collections below are still ready to explore.'
        )
        return
      }

      const livePhotos = (allRows || []).map(mapSupabasePhoto)
      const mergedPhotos = [...curated, ...livePhotos].reduce<GalleryPhoto[]>((acc, photo) => {
        const duplicateIndex = acc.findIndex(
          existing =>
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
          mergedPhotos.map(photo => photo.id),
          engagementSessionId
        ),
        fetchPhotoEngagementSummary(mergedPhotos.map(photo => photo.id)),
      ])

      const likeStatuses = Array.isArray(likeStatusResult.data) ? likeStatusResult.data : []
      const engagementSummaries = Array.isArray(engagementSummaryResult.data)
        ? engagementSummaryResult.data
        : []

      const likeStatusByPhotoId = new Map(
        likeStatuses.map(status => [status.photo_key, status] as const)
      )
      const engagementSummaryByPhotoId = new Map(
        engagementSummaries.map(summary => [summary.photo_key, summary] as const)
      )

      setPhotos(
        mergedPhotos.map(photo => {
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
      setLoadError(
        'Could not connect to the live gallery right now. The curated collections below are still ready to browse.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [engagementSessionId, curatedPhotosNormalized, initialPhotos])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  return {
    photos,
    collection,
    isLoading,
    loadError,
    setCollection,
    setPhotos,
    reload: fetchPhotos,
  }
}
