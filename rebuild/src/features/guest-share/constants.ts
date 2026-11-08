/**
 * Guest Share constants — frozen copy oracle.
 *
 * Source: `src/pages/GuestShare.tsx` (frozen tag `legacy-freeze-2026-11-08`) and
 * `contracts/content/rendered/guest-token.json`. Every user-visible string in
 * the page comes from here so text parity is checkable in one place.
 */

export const COPY_FEEDBACK_MS = 2000

export const GUEST_SHARE_COPY = {
  /** Per-route metadata (noindex; the frozen page never set a canonical). */
  metaTitleSuffix: "'s Album",
  metaDescription: (guestName: string) =>
    `Explore the photo uploads, photo claims, and handwritten guestbook notes contributed by ${guestName} to our wedding archive.`,
  backToGallery: 'Back to Gallery',
  galleryHref: '/gallery',
  eyebrow: 'Guest Memory Album',
  titleSuffix: "'s Showcase",
  photosShared: (count: number) => `${count} ${count === 1 ? 'Photo' : 'Photos'} Shared`,
  messagesWritten: (count: number) => `${count} ${count === 1 ? 'Message' : 'Messages'} Written`,
  bullet: '•',
  shareCta: 'Share This Album',
  copiedCta: 'Copied Album Link',
  copySuccessMessage: 'Album link copied to clipboard!',
  copyFailureMessage: "Couldn't copy — please copy the URL from your address bar.",
  photosTab: (count: number) => `Photos (${count})`,
  guestbookTab: (count: number) => `Guestbook Note (${count})`,
  tabsLabel: 'Album sections',
  loadingMessage: 'Curating guest memories...',
  invalidTitle: 'Album Link Unresolved',
  invalidBody:
    'This showcase album token is invalid, expired, or the guest contributions are not public. Please double-check the URL or return to the main gallery.',
  networkTitle: 'Connection Trouble',
  networkBody:
    "We couldn't reach the archive just now. Check your connection and try again — your album will be right here.",
  retry: 'Try Again',
  noPhotosTitle: 'No photos shared yet',
  noPhotosBody:
    'Photos uploaded by this guest, or claimed in the gallery, will appear here once approved by the administrators.',
  noNotesTitle: 'No guestbook messages yet',
  noNotesBody:
    'Personalized handwritten notes or well-wishes submitted to the guestbook will appear here once approved.',
  withLove: 'With Love',
} as const

/** Frozen date formatting for note headers (short month / day / year). */
export const NOTE_DATE_LOCALE = 'en-US'
export const NOTE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}
