import { useEffect, useRef } from 'react'

export interface GalleryLightboxSlotProps {
  /** Photo id requested through `?photo=` (or the resolved `?shared=` row). */
  requestedPhotoId: string | null
  /** W5-2 mounts the real lightbox here; the page provides the open callback. */
  onOpen: (photoId: string) => void
}

/**
 * Placeholder mount point for the lightbox (W5-2 owns the lightbox itself).
 *
 * The page passes the id requested by the URL contract (`?photo=` / `?shared=`)
 * and an `onOpen` callback; this component only bridges the request to that
 * callback once per requested id, so the URL contract is already exercised in
 * Wave 5 tests. W5-2 replaces the inner placeholder with the real overlay while
 * keeping this seam.
 */
export function GalleryLightboxSlot({ requestedPhotoId, onOpen }: GalleryLightboxSlotProps) {
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

  return <div data-testid='gallery-lightbox-slot' hidden aria-hidden='true' />
}
