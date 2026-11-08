/**
 * Typed mount point for the W5-2 `PhotoLightbox` (do NOT implement a second
 * lightbox here).
 *
 * The page owns the open/close state (`activePhotoIndex`) and the engagement
 * handlers; this slot is the single place the Lead wires the real overlay:
 *
 *   // TODO(Wave6 wiring — Lead)
 *   import { PhotoLightbox } from '@/features/photo-viewer'
 *   return (
 *     <PhotoLightbox
 *       photos={photos}
 *       isOpen={isOpen}
 *       initialIndex={initialIndex}
 *       onClose={onClose}
 *       engagement={engagement}
 *     />
 *   )
 *
 * Until then it renders an inert marker carrying the state so the page contract
 * (open index, photo count) is testable today and parity/DOM is unaffected
 * (the marker is `hidden` and aria-hidden).
 */
import type { GuestShareLightboxSlotProps } from './types'

export function GuestShareLightboxSlot({
  photos,
  isOpen,
  initialIndex,
}: GuestShareLightboxSlotProps) {
  return (
    <div
      data-testid='guest-share-lightbox-slot'
      data-is-open={isOpen ? 'true' : 'false'}
      data-initial-index={String(initialIndex)}
      data-photo-count={String(photos.length)}
      hidden
      aria-hidden='true'
    />
  )
}
