/**
 * Typed mount point for the W5-2 `PhotoLightbox` (do NOT implement a second
 * lightbox here — the frozen page mounted exactly one page-level viewer).
 *
 * W9-3 wiring: the slot now renders the real `PhotoLightbox` from
 * `@/features/photo-viewer` with the album photos / open index / engagement
 * handlers the page already owns. When closed the viewer renders nothing, so
 * the frozen DOM/copy are unchanged.
 */
import { PhotoLightbox } from '@/features/photo-viewer'
import type { GuestShareLightboxSlotProps } from './types'

export function GuestShareLightboxSlot({
  photos,
  isOpen,
  initialIndex,
  onClose,
  engagement,
  verifiedNames,
}: GuestShareLightboxSlotProps) {
  return (
    <PhotoLightbox
      photos={photos}
      isOpen={isOpen}
      initialIndex={initialIndex}
      onClose={onClose}
      {...(engagement ? { engagement } : {})}
      {...(verifiedNames ? { verifiedNames } : {})}
    />
  )
}
