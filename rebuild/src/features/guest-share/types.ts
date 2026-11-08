/**
 * Guest Share feature types (Wave 6 W6-3).
 *
 * Shapes mirror the typed data layer's normalised `/guest/:token` aggregation
 * (`shared/data/claims.ts`: `GuestContributions` + `resolveGuestContributions`)
 * so the Lead's wiring is mechanical:
 *
 *   guestName     <- GuestContributions.guestName
 *   photos        <- fetchPhotosByUrls(upload photo urls) + claimedPhotos,
 *                    deduped by id (the frozen page's merge order)
 *   notes         <- GuestContributions.guestbook
 *
 * Deliberately decoupled: this feature never imports `shared/data`.
 */
import type { PhotoViewerEngagement, ViewerPhoto } from '@/features/photo-viewer'

/** Frozen error taxonomy: unresolved token vs transport failure. */
export type GuestShareErrorKind = 'invalid' | 'network'

/** Load lifecycle used by the page + hook. */
export type GuestShareStatus = 'loading' | 'ready' | 'invalid' | 'network'

/** Photo tab / guestbook-note tab. */
export type GuestShareTab = 'photos' | 'guestbook'

/**
 * One photo in the album. Structurally a subset of the W5-2 `ViewerPhoto`
 * contract, so the album can be handed to `PhotoLightbox` without conversion.
 */
export interface GuestSharePhoto {
  id: string
  url: string
  thumbnail: string
  caption: string | null
  likes: number
}

/** One handwritten guestbook note (the frozen page renders name/date/content). */
export interface GuestShareNote {
  id: string
  name: string
  content: string
  createdAt: string
}

/** Aggregated album payload (the page's whole data dependency). */
export interface GuestShareAlbum {
  guestName: string
  photos: GuestSharePhoto[]
  notes: GuestShareNote[]
}

/**
 * Injected typed data boundary. The single method maps to
 * `fetchGuestContributionsByToken(token)` + photo-by-url enrichment in
 * `shared/data/claims.ts`; `null` means the token was not found ("invalid").
 * Thrown errors mean the archive was unreachable ("network").
 */
export interface GuestShareApi {
  loadAlbum: (token: string) => Promise<GuestShareAlbum | null>
}

/**
 * Typed seam for the W5-2 lightbox.
 *
 * The page owns the open/close + like/comment state and hands the album to this
 * slot; the Lead mounts `<PhotoLightbox {...} />` here (do NOT implement a
 * second lightbox — the frozen page mounted `PhotoLightbox` at page level).
 */
export interface GuestShareLightboxSlotProps {
  photos: ViewerPhoto[]
  isOpen: boolean
  initialIndex: number
  onClose: () => void
  engagement?: PhotoViewerEngagement
}
