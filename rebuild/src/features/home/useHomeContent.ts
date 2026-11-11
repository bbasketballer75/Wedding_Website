/**
 * Typed boundary for the data-driven Home sections (guest highlight reel and
 * the three editorial slots), now wired to the typed data layer (Wave 3).
 *
 * Sections receive plain props, so the page composition never had to change.
 * The frozen Home reads: top-6 photos by likes, the 10 newest guestbook notes,
 * and three `site_editorial_features` slots. Query caching/staleness lives in
 * `shared/data/hooks`; this module only shapes the view state.
 */
import { useMemo } from 'react'
import { mediaPaths } from '@/shared/data/media'
import { useEditorialFeatures, useGuestbookMessages, useTopPhotos } from '@/shared/data/hooks'

export interface HomeEditorialFeature {
  title: string
  summary?: string | null
  badge_label?: string | null
  cta_label?: string | null
  source_url?: string | null
}

export interface HomeGuestPhoto {
  id: string
  url: string
  thumbnail?: string | null
  caption?: string | null
}

export interface HomeGuestQuote {
  id: string
  content: string
  name: string
}

export interface HomeEditorialSlots {
  momentOfTheWeek: HomeEditorialFeature | null
  standoutUpload: HomeEditorialFeature | null
  featuredNote: HomeEditorialFeature | null
}

export interface HomeContentState extends HomeEditorialSlots {
  loading: boolean
  error: string | null
  guestPhotos: HomeGuestPhoto[]
  guestQuotes: HomeGuestQuote[]
}

const SLOTS = {
  momentOfTheWeek: 'home_moment_of_the_week',
  standoutUpload: 'home_newest_standout_upload',
  featuredNote: 'home_featured_guestbook_note',
} as const

function toFeature(
  features: readonly HomeEditorialFeature[] | undefined,
  slot: string
): HomeEditorialFeature | null {
  if (!features) return null
  const match = features.find(feature => {
    const candidate = feature as HomeEditorialFeature & { slot?: string; is_active?: boolean }
    return candidate.slot === slot && candidate.is_active !== false
  })
  return match ?? null
}

export function useHomeContent(): HomeContentState {
  // The frozen Home renders the top 6 photos by likes, the newest notes, and the
  // three editorial slots. `useTopPhotos` already applies the likes ordering.
  const photosQuery = useTopPhotos(6)
  const guestbookQuery = useGuestbookMessages()
  const editorialQuery = useEditorialFeatures()

  const guestPhotos = useMemo<HomeGuestPhoto[]>(
    () =>
      (photosQuery.data ?? []).slice(0, 6).map(photo => ({
        id: photo.id,
        // DB media paths are relative (`media/...`) and must resolve like the
        // frozen mapper: same-origin for `/images/`, CDN for offloaded prefixes.
        url: mediaPaths.getMediaPath(photo.url),
        thumbnail: mediaPaths.getMediaPath(photo.thumbnail || photo.url),
        caption: photo.caption,
      })),
    [photosQuery.data]
  )

  const guestQuotes = useMemo<HomeGuestQuote[]>(
    () =>
      (guestbookQuery.data ?? []).slice(0, 10).map(message => ({
        id: message.id,
        content: message.content,
        name: message.name,
      })),
    [guestbookQuery.data]
  )

  const editorial = useMemo(() => {
    const features = editorialQuery.data as HomeEditorialFeature[] | undefined
    return {
      momentOfTheWeek: toFeature(features, SLOTS.momentOfTheWeek),
      standoutUpload: toFeature(features, SLOTS.standoutUpload),
      featuredNote: toFeature(features, SLOTS.featuredNote),
    }
  }, [editorialQuery.data])

  const error = photosQuery.error ?? guestbookQuery.error ?? editorialQuery.error

  return {
    loading: photosQuery.isLoading || guestbookQuery.isLoading || editorialQuery.isLoading,
    error: error ? error.message : null,
    guestPhotos,
    guestQuotes,
    ...editorial,
  }
}
