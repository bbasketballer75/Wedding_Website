/**
 * Public API for the Guest Share feature (Wave 6 W6-3).
 *
 * Route wiring (Lead, no route edits here):
 *   `src/app/router.tsx` guestTokenRoute component:
 *     const { GuestTokenRoute } = await import('@/features/guest-share')
 *     // Lead wires `token` from `Route.useParams()` and `api` from shared/data.
 *
 * Lightbox wiring: replace the marker inside `GuestShareLightboxSlot` with
 * `<PhotoLightbox {...props} />` from `@/features/photo-viewer` (W5-2). Do not
 * add a second lightbox implementation.
 */
export { GuestSharePage, default } from './GuestSharePage'
export { useGuestShareAlbum } from './data'
export {
  countAlbumStats,
  createStubGuestShareApi,
  dedupePhotos,
  normalizeAlbum,
  resolveDefaultTab,
  STUB_VALID_TOKEN,
} from './data'
export {
  cloneAlbum,
  createDuplicatePhotoAlbum,
  createGuestShareAlbumFixture,
  createNotesOnlyAlbum,
  createPhotosOnlyAlbum,
  GUEST_SHARE_ALBUM_FIXTURE,
} from './fixtures'
export {
  copyAlbumLink,
  createBrowserClipboardAdapter,
  type ClipboardAdapter,
  type CopyResult,
} from './clipboard'
export { COPY_FEEDBACK_MS, GUEST_SHARE_COPY } from './constants'
export { GuestShareLightboxSlot } from './GuestShareLightboxSlot'
export { GuestShareTabs } from './GuestShareTabs'
export { GuestShareIdentityHeader } from './GuestShareIdentityHeader'
export { GuestShareNotesPanel, GuestSharePhotosPanel } from './GuestSharePanels'
export { GuestShareErrorState, GuestShareLoadingState } from './GuestShareStates'
export type {
  GuestShareAlbum,
  GuestShareApi,
  GuestShareErrorKind,
  GuestShareLightboxSlotProps,
  GuestShareNote,
  GuestSharePhoto,
  GuestShareStatus,
  GuestShareTab,
} from './types'
