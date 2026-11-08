/**
 * Public API for the photo viewer feature.
 *
 * The gallery page (shell-eng) mounts `<PhotoLightbox />` from its
 * `GalleryLightboxSlot` using these props; the Lead's data wiring supplies the
 * photos/engagement/verified-name loader. Keep this surface small.
 */
export { PhotoLightbox, COMMENT_AUTHOR_STORAGE_KEY } from './PhotoLightbox'
export { ShareModal } from './ShareModal'
export { PrintModal } from './PrintModal'
export {
  useVerifiedNames,
  isVerifiedName,
  normalizeVerifiedNames,
  type VerifiedNamesLoader,
} from './useVerifiedNames'
export { useFocusTrap, getFocusableElements, handleTabTrap } from './useFocusTrap'
export { useTouchGestures, type TouchGesturesOptions } from './useTouchGestures'
export type {
  ViewerFace,
  ViewerComment,
  ViewerExif,
  ViewerPhoto,
  PhotoViewerEngagement,
  PhotoLightboxProps,
  ShareModalProps,
  PrintModalProps,
} from './types'
