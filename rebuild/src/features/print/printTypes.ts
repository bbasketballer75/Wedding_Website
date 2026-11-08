/**
 * Types for the `/print` Memory Book feature.
 *
 * Data comes from the Wave-3 typed data layer (`@/shared/data`) through two
 * injectable loader seams. The page accepts optional loaders so tests (and the
 * Lead's route wiring) can supply deterministic data without touching the
 * data layer:
 *
 * - `usePrintAlbums({ loadAlbumPhotos })`
 * - `usePrintGuestbook({ loadGuestbook })`
 *
 * TODO(Wave4 Lead): wire the route (`rebuild/src/app/router.tsx`) to
 * `PrintPage`. The default loaders already bind to the real data layer, so the
 * route needs no data props; the seams stay for parity/e2e fixtures.
 */
import type { GuestbookPrintEntry } from '@/shared/data/guestbook'
import type { Photo, PhotoAlbum } from '@/shared/data/photos'

/** One selectable album row in the control panel (frozen `AlbumState`). */
export interface PrintAlbumState {
  readonly album: PhotoAlbum
  readonly included: boolean
  readonly photos: readonly Photo[]
  readonly loading: boolean
}

/** Loader seam for a single album; resolves to the album's photos in frozen order. */
export type LoadPrintAlbumPhotos = (album: PhotoAlbum) => Promise<readonly Photo[]>

/** Loader seam for the guestbook keepsake; resolves chronologically. */
export type LoadPrintGuestbook = () => Promise<readonly GuestbookPrintEntry[]>

/** Options accepted by `usePrintAlbums`. */
export interface UsePrintAlbumsOptions {
  /** Defaults to `fetchAlbumPhotos` from the typed data layer. */
  readonly loadAlbumPhotos?: LoadPrintAlbumPhotos
}

/** State + actions returned by `usePrintAlbums`. */
export interface UsePrintAlbumsResult {
  /** All four albums in frozen DB order, with inclusion/loading/photo state. */
  readonly albumStates: readonly PrintAlbumState[]
  /** Loaded-and-included albums, in frozen order (drives the printed book). */
  readonly includedAlbums: readonly PrintAlbumState[]
  /** `sum(min(photos.length, maxPhotosPerAlbum))` over included albums. */
  readonly totalPhotoCount: number
  /** Current max-photos-per-album value (always clamped to 1–500). */
  readonly maxPhotosPerAlbum: number
  /** Set the max-photos value; clamps to `PRINT_MAX_PHOTOS_NUMBER`. */
  readonly setMaxPhotosPerAlbum: (value: number) => void
  /** Toggle inclusion; lazily loads the album on first include. */
  readonly toggleAlbum: (album: PhotoAlbum) => void
  /** The bound album loader (exposed for retry/prefetch call sites). */
  readonly loadAlbumPhotos: LoadPrintAlbumPhotos
}

/** Options accepted by `usePrintGuestbook`. */
export interface UsePrintGuestbookOptions {
  /** Defaults to `fetchGuestbookForPrint` from the typed data layer. */
  readonly loadGuestbook?: LoadPrintGuestbook
}

/** State + actions returned by `usePrintGuestbook`. */
export interface UsePrintGuestbookResult {
  /** Chronological keeper messages (frozen `.order('created_at', ascending)`). */
  readonly messages: readonly GuestbookPrintEntry[]
  /** True while the one-shot guestbook read is in flight. */
  readonly loading: boolean
  /** Frozen default: guestbook included in the book. */
  readonly includeGuestbook: boolean
  readonly setIncludeGuestbook: (included: boolean) => void
  /** Flip inclusion (the frozen toggle button). */
  readonly toggleGuestbook: () => void
}
