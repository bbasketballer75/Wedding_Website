/**
 * Gallery data boundary (Wave 5 W5-1).
 *
 * This module is the ONLY place the gallery page talks to data. Wave 5 ships
 * deterministic, fixture-shaped stubs so the page, tests and parity captures are
 * stable before the typed data layer exists.
 *
 * TODO(Wave3): replace every hook in this module with the `shared/data` hooks
 * (`useGalleryPhotos` → photos by collection + engagement RPCs, `lookupUploadStatus`
 * → guestUploads status by email, engagement → photo likes/comments). The pure
 * helpers (alias mapping, merge/dedupe, search matcher, URL parsing, download
 * strategy) are data-shape independent and stay as-is.
 */
import { useCallback, useMemo, useState } from 'react'
import { CLIENT_ZIP_LIMIT, MAX_SELECTION, collectionTabs, type CollectionTab } from './constants'
import { CURATED_PHOTOS, LIVE_PHOTOS, UPLOAD_STATUS_FIXTURE } from './fixtures'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface PhotoFace {
  id: string
  name: string
  x: number
  y: number
  box?: { width: number }
}

/**
 * Gallery display row. Mirrors the frozen `GalleryPhoto` (constants.ts) with the
 * generated Supabase `photos` columns narrowed to the display surface only.
 */
export interface GalleryPhoto {
  id: string
  url: string
  thumbnail: string
  downloadUrl?: string
  caption?: string
  album?: string
  category?: string
  likes: number
  liked?: boolean
  commentCount?: number
  aspectRatio: number
  time?: string
  location?: string
  photographer?: string
  date?: string
  createdAt?: string
  faces: PhotoFace[]
  tags: string[]
  source: 'professional' | 'guest'
  collection: CollectionTab
  albumSortOrder?: number
}

/** Frozen download-queue entry (`src/stores/downloadStore.ts` QueuedPhoto). */
export interface QueuedPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  downloadUrl?: string
  collection: CollectionTab
}

export interface GuestUploadStatus {
  guest_name: string
  guest_email: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  photo_urls: string[]
}

export type DownloadBatchStrategy = 'client-zip' | 'server-pack' | 'none'

export interface GalleryUrlState {
  collection: CollectionTab | null
  q: string
  photoId: string | null
  sharedId: string | null
  shareIds: string[]
}

/* -------------------------------------------------------------------------- */
/* Collection alias mapping                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Frozen `normalizeCollectionValue` (src/components/gallery/data.ts): maps the
 * raw album/category values stored in Supabase (and legacy URL-ish vocabulary)
 * onto the 4 display collections. 21 raw aliases in total; unknown → null.
 */
export function normalizeCollectionValue(value?: string | null): CollectionTab | null {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null

  if (normalized === 'engagement' || normalized === 'proposal') return 'Proposal'

  if (
    normalized === 'bach+ette' ||
    normalized === 'bach' ||
    normalized === 'bachelorette' ||
    normalized === 'bachelor'
  ) {
    return 'Bach+ette'
  }

  if (
    normalized === 'wedding day' ||
    normalized === 'wedding-day' ||
    normalized === 'wedding photos' ||
    normalized === 'couple' ||
    normalized === 'parents' ||
    normalized === 'rings' ||
    normalized === 'film' ||
    normalized === 'home' ||
    normalized === 'parent-film-cards' ||
    normalized === 'wedding-party' ||
    normalized === 'shared-gallery-new'
  ) {
    return 'Wedding Photos'
  }

  if (
    normalized === 'guest uploads' ||
    normalized === 'guest-upload' ||
    normalized === 'guest' ||
    normalized === 'guest photos'
  ) {
    return 'Guest Photos'
  }

  return null
}

/**
 * Frozen `deriveCollection` fallback order: album → category → guest default →
 * URL/thumbnail/tags keyword heuristics → Wedding Photos.
 */
export function deriveCollection(
  row: Pick<GalleryPhoto, 'tags' | 'url' | 'thumbnail' | 'source'> & {
    // Supabase row values can be null even though the display type is optional.
    album?: string | null
    category?: string | null
    caption?: string | null
    location?: string | null
  }
): CollectionTab {
  const byAlbum = normalizeCollectionValue(row.album)
  if (byAlbum) return byAlbum

  const byCategory = normalizeCollectionValue(row.category)
  if (byCategory) return byCategory

  if (row.source === 'guest') return 'Guest Photos'

  const haystack = [row.url, row.thumbnail, ...(row.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (haystack.includes('engagement') || haystack.includes('proposal')) return 'Proposal'
  if (
    haystack.includes('bach') ||
    haystack.includes('bachelorette') ||
    haystack.includes('bachelor') ||
    haystack.includes('ette')
  ) {
    return 'Bach+ette'
  }
  return 'Wedding Photos'
}

/* -------------------------------------------------------------------------- */
/* Merge + search                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Frozen merge rule (`useGalleryData.ts`): curated rows first, then live rows;
 * a row is a duplicate when id OR url OR thumbnail matches; later rows update
 * the existing entry.
 */
export function mergeGalleryPhotos(
  curated: readonly GalleryPhoto[],
  live: readonly GalleryPhoto[] = []
): GalleryPhoto[] {
  return [...curated, ...live].reduce<GalleryPhoto[]>((acc, photo) => {
    const duplicateIndex = acc.findIndex(
      existing =>
        existing.id === photo.id ||
        existing.url === photo.url ||
        existing.thumbnail === photo.thumbnail
    )
    if (duplicateIndex >= 0) {
      acc[duplicateIndex] = { ...acc[duplicateIndex], ...photo }
    } else {
      acc.push(photo)
    }
    return acc
  }, [])
}

/**
 * Frozen search predicate (`useGallerySearchFilters.ts`): case-insensitive
 * substring match over caption, location, photographer, collection, source,
 * face names and tags.
 */
export function matchesGallerySearch(photo: GalleryPhoto, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  const searchableText = [
    photo.caption,
    photo.location,
    photo.photographer,
    photo.collection,
    photo.source,
    ...(photo.faces ?? []).map(face => face.name),
    ...(photo.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return searchableText.includes(normalizedQuery)
}

export function countByCollection(photos: readonly GalleryPhoto[]): Record<CollectionTab, number> {
  const counts: Record<CollectionTab, number> = {
    Proposal: 0,
    'Bach+ette': 0,
    'Wedding Photos': 0,
    'Guest Photos': 0,
  }
  for (const photo of photos) {
    if (collectionTabs.includes(photo.collection)) counts[photo.collection] += 1
  }
  return counts
}

/* -------------------------------------------------------------------------- */
/* URL / query-param handling                                                 */
/* -------------------------------------------------------------------------- */

function isCollectionTab(value: string | null): value is CollectionTab {
  return value !== null && (collectionTabs as string[]).includes(value)
}

/**
 * Parse the frozen gallery query contract (contracts/routes.json):
 * `?collection=<CollectionTab>`, `?q=<search>`, `?photo=<id>`, `?shared=<id>`,
 * `?share=<comma separated ids>` (selection incl. OG share image).
 */
export function parseGallerySearch(
  input: string | URLSearchParams | Record<string, unknown> = ''
): GalleryUrlState {
  let params: URLSearchParams
  if (typeof input === 'string') {
    params = new URLSearchParams(input)
  } else if (input instanceof URLSearchParams) {
    params = input
  } else {
    params = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') params.set(key, value)
    }
  }

  const collectionValue = params.get('collection')
  const q = (params.get('q') ?? '').trim()
  const photoId = params.get('photo')?.trim() || null
  const sharedId = params.get('shared')?.trim() || null
  const shareIds = [...new Set((params.get('share') ?? '').split(',').map(v => v.trim()))]
    .filter(Boolean)
    .slice(0, MAX_SELECTION)

  return {
    collection: isCollectionTab(collectionValue) ? collectionValue : null,
    q,
    photoId,
    sharedId,
    shareIds,
  }
}

/** TanStack Router `validateSearch` contract for the future `/gallery` route. */
export function validateGallerySearch(search: Record<string, unknown>): Record<string, string> {
  const parsed = parseGallerySearch(search)
  const result: Record<string, string> = {}
  if (parsed.collection) result.collection = parsed.collection
  if (parsed.q) result.q = parsed.q
  if (parsed.photoId) result.photo = parsed.photoId
  if (parsed.sharedId) result.shared = parsed.sharedId
  if (parsed.shareIds.length > 0) result.share = parsed.shareIds.join(',')
  return result
}

/** Frozen share-link shape (`useGalleryDownloads.ts`). */
export function buildSelectionShareUrl(origin: string, ids: readonly string[]): string {
  const base = origin.replace(/\/+$/, '')
  return `${base}/gallery?share=${ids.join(',')}`
}

/* -------------------------------------------------------------------------- */
/* Batch download strategy                                                    */
/* -------------------------------------------------------------------------- */

export interface BatchDownloadPlan {
  strategy: DownloadBatchStrategy
  count: number
  /** Server-side zip endpoint (frozen `/.netlify/functions/download-pack`). */
  endpoint: string | null
}

/** Frozen split: <=20 → client zip, 21–50 → server `download-pack`, else invalid. */
export function resolveDownloadStrategy(count: number): DownloadBatchStrategy {
  if (!Number.isFinite(count) || count <= 0 || count > MAX_SELECTION) return 'none'
  return count <= CLIENT_ZIP_LIMIT ? 'client-zip' : 'server-pack'
}

export function planBatchDownload(ids: readonly string[]): BatchDownloadPlan {
  const strategy = resolveDownloadStrategy(ids.length)
  return {
    strategy,
    count: ids.length,
    endpoint: strategy === 'server-pack' ? '/.netlify/functions/download-pack' : null,
  }
}

/**
 * TODO(Wave3/Wave8): execute the plan. Byte packaging needs either the
 * `download-pack` Netlify function contract or a client zip dependency (the
 * frozen app uses jszip, which the greenfield dependency policy has not approved).
 * Wave 5 implements the strategy/progress state only; no bytes are produced here.
 */
export async function runBatchDownloadStub(
  plan: BatchDownloadPlan,
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  if (plan.strategy === 'none') throw new Error('Select between 1 and 50 photos to download.')
  onProgress?.(0, `Preparing ${plan.count} photo${plan.count === 1 ? '' : 's'}...`)
  await Promise.resolve()
  onProgress?.(100, 'Download packaging is wired in a later wave (no bytes written in Wave 5).')
}

/* -------------------------------------------------------------------------- */
/* Stub hooks (TODO(Wave3): swap for shared/data hooks)                       */
/* -------------------------------------------------------------------------- */

export interface GalleryPhotosSource {
  curated?: readonly GalleryPhoto[]
  live?: readonly GalleryPhoto[]
  isLoading?: boolean
  loadError?: string | null
}

/** Deterministic default source: curated Proposal + live Wedding-day rows. */
export const STUB_GALLERY_SOURCE: GalleryPhotosSource = {
  curated: CURATED_PHOTOS,
  live: LIVE_PHOTOS,
  isLoading: false,
  loadError: null,
}

export interface GalleryPhotosResult {
  photos: GalleryPhoto[]
  curatedPhotos: GalleryPhoto[]
  isLoading: boolean
  loadError: string | null
  refetch: () => void
}

/**
 * Frozen data behavior: curated photos are ALWAYS available (the page renders
 * them even when the live fetch fails); live rows merge on top, deduped.
 */
export function useGalleryPhotos(source: GalleryPhotosSource = STUB_GALLERY_SOURCE) {
  const curated = source.curated ?? CURATED_PHOTOS
  const live = source.live ?? LIVE_PHOTOS
  const photos = useMemo(() => mergeGalleryPhotos(curated, live), [curated, live])
  const refetch = useCallback(() => {
    // TODO(Wave3): refetch the live query once the data layer exists.
  }, [])
  return {
    photos,
    curatedPhotos: [...curated],
    isLoading: source.isLoading ?? false,
    loadError: source.loadError ?? null,
    refetch,
  } satisfies GalleryPhotosResult
}

export function useCuratedPhotos(): GalleryPhoto[] {
  return CURATED_PHOTOS
}

export interface GalleryEngagementActions {
  toggleLike: (photoId: string) => Promise<void>
  submitComment: (photoId: string, content: string) => Promise<void>
}

/** TODO(Wave3): route likes/comments through the engagement RPCs. */
export function useGalleryEngagement(): GalleryEngagementActions {
  const toggleLike = useCallback(async () => {
    await Promise.resolve()
  }, [])
  const submitComment = useCallback(async () => {
    await Promise.resolve()
  }, [])
  return { toggleLike, submitComment }
}

function toQueueEntry(photo: GalleryPhoto): QueuedPhoto {
  return {
    id: photo.id,
    url: photo.url,
    thumbnail: photo.thumbnail || photo.url,
    caption: photo.caption,
    downloadUrl: photo.downloadUrl ?? photo.url,
    collection: photo.collection,
  }
}

/** Resolve `?share=` ids against the loaded photos (frozen page behavior). */
export function queuedPhotosForIds(
  photos: readonly GalleryPhoto[],
  ids: readonly string[]
): QueuedPhoto[] {
  const byId = new Map(photos.map(photo => [photo.id, photo] as const))
  return ids
    .map(id => byId.get(id))
    .filter((photo): photo is GalleryPhoto => Boolean(photo))
    .slice(0, MAX_SELECTION)
    .map(toQueueEntry)
}

export interface GalleryDownloadQueue {
  queue: QueuedPhoto[]
  selectedIds: ReadonlySet<string>
  count: number
  isFull: boolean
  add: (photo: GalleryPhoto) => boolean
  remove: (photoId: string) => void
  toggle: (photo: GalleryPhoto) => void
  /** Selects as many visible photos as the 50-item cap allows; returns the count added. */
  selectAll: (photos: readonly GalleryPhoto[]) => number
  clear: () => void
}

/**
 * The frozen selection queue IS the download queue (`downloadStore`). Additions
 * are capped at 50; duplicates are ignored. Each hook instance owns its queue —
 * the page instantiates exactly one and passes it down as props.
 */
export function useDownloadQueue(initialQueue: readonly QueuedPhoto[] = []): GalleryDownloadQueue {
  const [queue, setQueue] = useState<QueuedPhoto[]>(() => [...initialQueue].slice(0, MAX_SELECTION))

  const selectedIds = useMemo(() => new Set(queue.map(entry => entry.id)), [queue])

  const add = useCallback(
    (photo: GalleryPhoto): boolean => {
      if (queue.length >= MAX_SELECTION) return false
      if (queue.some(entry => entry.id === photo.id)) return false
      setQueue(previous => [...previous, toQueueEntry(photo)])
      return true
    },
    [queue]
  )

  const remove = useCallback((photoId: string) => {
    setQueue(previous => previous.filter(entry => entry.id !== photoId))
  }, [])

  const toggle = useCallback((photo: GalleryPhoto) => {
    setQueue(previous =>
      previous.some(entry => entry.id === photo.id)
        ? previous.filter(entry => entry.id !== photo.id)
        : previous.length >= MAX_SELECTION
          ? previous
          : [...previous, toQueueEntry(photo)]
    )
  }, [])

  const selectAll = useCallback(
    (photos: readonly GalleryPhoto[]): number => {
      const remaining = MAX_SELECTION - queue.length
      const alreadySelected = new Set(queue.map(entry => entry.id))
      const additions = photos
        .filter(photo => !alreadySelected.has(photo.id))
        .slice(0, Math.max(0, remaining))
      if (additions.length > 0) {
        setQueue(previous => [...previous, ...additions.map(toQueueEntry)])
      }
      return additions.length
    },
    [queue]
  )

  const clear = useCallback(() => setQueue([]), [])

  return {
    queue,
    selectedIds,
    count: queue.length,
    isFull: queue.length >= MAX_SELECTION,
    add,
    remove,
    toggle,
    selectAll,
    clear,
  }
}

/** The frozen app models the download queue as the selection set; alias kept for the task contract. */
export const useGallerySelection = useDownloadQueue

/* -------------------------------------------------------------------------- */
/* Upload-status lookup                                                       */
/* -------------------------------------------------------------------------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Returns the visible validation message, or null when the email is usable. */
export function validateUploadLookupEmail(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter the email address you used when uploading.'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.'
  return null
}

/**
 * Deterministic failure address for the e2e/unit error path (the frozen form
 * surfaces a toast + inline error when the lookup throws).
 */
export const UPLOAD_LOOKUP_FAILURE_EMAIL = 'lookup-error@example.com'

/** TODO(Wave3): call `fetchGuestUploadStatus` from the typed `shared/data` layer. */
export function lookupUploadStatus(email: string): Promise<GuestUploadStatus> {
  const trimmed = email.trim()
  const validationError = validateUploadLookupEmail(trimmed)
  if (validationError) return Promise.reject(new Error(validationError))
  if (trimmed.toLowerCase() === UPLOAD_LOOKUP_FAILURE_EMAIL) {
    return Promise.reject(new Error('Unable to look up status right now. Please try again.'))
  }
  return Promise.resolve({ ...UPLOAD_STATUS_FIXTURE, guest_email: trimmed })
}
