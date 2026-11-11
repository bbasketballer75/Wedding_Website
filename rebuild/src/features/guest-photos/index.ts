/**
 * Public API for the Guest Photos feature (Wave 6 W6-3).
 *
 * Route wiring (Lead, no route edits here):
 *   `src/app/router.tsx` guestPhotosRoute component:
 *     const { GuestPhotosPage } = await import('@/features/guest-photos')
 *     // data wiring: pass `api` (adapter over shared/data/guestUploads)
 */
export { GuestPhotosPage, default } from './GuestPhotosPage'
export { useGuestPhotosData } from './data'
export {
  computeGuestPhotosStats,
  createStubGuestPhotosApi,
  filterApprovedUploads,
  formatUploadDate,
  selectFeaturedPhotos,
} from './data'
export {
  createGuestPhotosFixture,
  createMixedStatusFixture,
  GUEST_PHOTOS_APPROVED_FIXTURE,
  GUEST_PHOTOS_UNAPPROVED_FIXTURE,
} from './fixtures'
export { FEATURED_PHOTO_LIMIT, GUEST_PHOTOS_COPY } from './constants'
export { getMediaPath } from './media'
export type {
  FeaturedGuestPhoto,
  GuestPhotoUpload,
  GuestPhotosApi,
  GuestPhotosStats,
  GuestUploadStatus,
} from './types'
