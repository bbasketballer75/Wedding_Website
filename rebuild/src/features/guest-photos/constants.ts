/**
 * Guest Photos constants — frozen copy/timing oracle.
 *
 * Source: `src/pages/GuestPhotos.tsx` (frozen tag `legacy-freeze-2026-11-08`) and
 * `contracts/content/rendered/guest-photos.json`. Labels rendered through the
 * `uppercase` utility are stored in sentence case here, exactly as the oracle
 * stores them (the captured text is uppercased by CSS).
 */

/** Frozen featured-thumbnail cap (`featuredPhotos` = first 6 photos). */
export const FEATURED_PHOTO_LIMIT = 6

/** Frozen date formatting for upload cards (`formatUploadDate`). */
export const UPLOAD_DATE_LOCALE = 'en-US'

export const UPLOAD_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

export const GUEST_PHOTOS_COPY = {
  metaTitle: 'Guest Photos',
  metaDescription:
    'Browse the photos and notes shared by family and friends from Austin and Jordyn Porada wedding celebrations.',
  canonical: '/guest-photos',
  eyebrow: 'Guest Memories',
  title: 'A contact sheet of the night as everyone saw it',
  description:
    'Candid tables, quick notes, blurry dance-floor joy, and the small details only guests could catch.',
  approvedUploadsLabel: 'Approved uploads',
  guestPhotosLabel: 'Guest photos',
  shareCta: 'Share yours',
  shareHref: '/upload',
  loadingLabel: 'Loading guest photos',
  loadingSrText: 'Loading guest photos...',
  errorTitle: 'Guest photos are taking a moment',
  errorBody:
    'The archive could not load approved guest uploads just now. Please refresh and try again.',
  emptyTitle: 'No guest photos published yet',
  emptyBody: 'Approved guest uploads will appear here after moderation.',
} as const
