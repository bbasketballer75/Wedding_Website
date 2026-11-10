import { Suspense, lazy, useEffect, useRef } from 'react'
import type { PhotoViewerEngagement, ViewerPhoto } from '@/features/photo-viewer'

// The viewer is a heavy modal (faces, comments, print/share); keep it out of the
// gallery route chunk so /gallery stays inside the 120 KiB per-route budget.
const PhotoLightbox = lazy(() =>
  import('@/features/photo-viewer').then(module => ({ default: module.PhotoLightbox }))
)

export interface GalleryLightboxSlotProps {
  /** Photo id requested through `?photo=` (or the resolved `?shared=` row). */
  requestedPhotoId: string | null
  /** The page opens the viewer for that id (URL contract). */
  onOpen: (photoId: string) => void
  /** Viewer photos (the filtered gallery collection, frozen lightbox source). */
  photos?: ViewerPhoto[]
  isOpen?: boolean
  initialIndex?: number
  onClose?: () => void
  engagement?: PhotoViewerEngagement
  verifiedNames?: string[]
}

/**
 * Mount point for the W5-2 `PhotoLightbox` (one implementation only — the
 * gallery page never renders a second viewer).
 *
 * The slot keeps the Wave-5 URL bridge (`?photo=` / `?shared=` request ->
 * `onOpen` once per requested id) and renders the real viewer for the page-owned
 * open state. When closed the viewer renders nothing, so the frozen DOM is
 * unchanged.
 */
export function GalleryLightboxSlot({
  requestedPhotoId,
  onOpen,
  photos = [],
  isOpen = false,
  initialIndex = 0,
  onClose,
  engagement,
  verifiedNames,
}: GalleryLightboxSlotProps) {
  const lastOpenedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!requestedPhotoId) {
      lastOpenedRef.current = null
      return
    }
    if (lastOpenedRef.current === requestedPhotoId) return
    lastOpenedRef.current = requestedPhotoId
    onOpen(requestedPhotoId)
  }, [onOpen, requestedPhotoId])

  return (
    <Suspense fallback={null}>
      <PhotoLightbox
        photos={photos}
        isOpen={isOpen}
        initialIndex={initialIndex}
        onClose={onClose ?? (() => undefined)}
        {...(engagement ? { engagement } : {})}
        {...(verifiedNames ? { verifiedNames } : {})}
      />
    </Suspense>
  )
}
