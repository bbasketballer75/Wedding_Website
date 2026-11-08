/**
 * Typed props boundary for the photo viewer feature.
 *
 * These types are the contract the gallery page (shell-eng) and the Lead's data
 * wiring use to inject photos/engagement/verified names into the lightbox.
 * They are intentionally decoupled from `shared/data` so the viewer renders
 * with stub data today and binds to the data layer later.
 */

export interface ViewerFace {
  id: string
  name: string
  x: number
  y: number
  box?: {
    left?: number
    top?: number
    width?: number
    height?: number
  }
}

export interface ViewerComment {
  id: string
  author: string
  content: string
  /** Frozen display string, e.g. "May 10, 2:31 PM" (formatted by the caller). */
  timestamp: string
  avatar?: string
  /** Moderation flag: hidden comments are not rendered (see README note). */
  is_hidden?: boolean
}

export interface ViewerExif {
  dateTaken?: string | null
  camera?: string | null
  lens?: string | null
  aperture?: string | null
  shutterSpeed?: string | null
  iso?: string | null
}

export interface ViewerPhoto {
  id: string
  url: string
  thumbnail?: string | null
  download_url?: string | null
  caption?: string | null
  album?: string | null
  album_sort_order?: number | null
  category?: string | null
  location?: string | null
  date?: string | null
  time?: string | null
  photographer?: string | null
  is_professional?: boolean
  tags?: string[]
  faces?: ViewerFace[]
  blurHash?: string | null
  created_at?: string
  /** Engagement fields (frozen optional UI-enrichment fields). */
  liked?: boolean
  likes?: number
  likeCount?: number
  commentCount?: number
  comments?: ViewerComment[]
  /**
   * EXIF metadata for the Details panel.
   *
   * Delta from the frozen app: the frozen lightbox parsed EXIF client-side with
   * `exifr` (a devDependency imported by shipped code — A2 finding). No new
   * dependencies are allowed in the rebuild, so the parsed EXIF is injected by
   * the caller instead. `undefined`/`null` renders the frozen
   * "No metadata available" fallback.
   */
  exif?: ViewerExif | null
}

export interface PhotoViewerEngagement {
  /** Toggle like for a photo. */
  onToggleLike?: (photoId: string) => void
  /** Submit a comment; resolve `false` to keep the composer text on failure. */
  onSubmitComment?: (
    photoId: string,
    payload: { author: string; content: string }
  ) => Promise<boolean> | boolean
  /** Comment submission is in flight (disables the submit button). */
  isSubmittingComment?: boolean
}

export interface PhotoLightboxProps {
  /** Whether the lightbox is open. */
  isOpen: boolean
  /** Photos to browse. Empty array renders nothing (frozen behavior). */
  photos: ViewerPhoto[]
  /** Photo index to select when the lightbox opens (default 0). */
  initialIndex?: number
  /** Called when the viewer should close (Esc, backdrop, close button). */
  onClose: () => void
  /** Like/comment side-effects injected by the gallery page. */
  engagement?: PhotoViewerEngagement
  /** Verified identity display names (lowercased by the caller or normalized here). */
  verifiedNames?: string[]
  /** Called when the user requests a download. */
  onDownload?: (photoId: string) => void
  /** Called when the user opens the share flow. */
  onShare?: (photoId: string) => void
  /** Download in flight (shows the frozen spinner and disables the button). */
  isDownloading?: boolean
  /** When set, only this face is highlighted and its hotspot is always shown. */
  highlightedFaceName?: string | null
}

export interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  url?: string
  imageUrl?: string
}

export interface PrintModalProps {
  isOpen: boolean
  onClose: () => void
  photoUrl: string
}
