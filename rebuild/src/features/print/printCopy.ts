/**
 * Frozen copy, labels and control bounds for `/print` (Memory Book).
 *
 * Oracle: `src/pages/Print.tsx` (legacy-freeze-2026-11-08, lines 39-40 and
 * 217-377) and `contracts/content/rendered/print.json` (the captured visitor
 * text). Copy lives here — not inline in the component — so the rendered-text
 * parity harness can diff one module and so Wave 7 can move it into
 * `contracts/content/` without touching JSX.
 *
 * Every string below appears verbatim in the frozen page. Do not reword; the
 * rendered snapshot is the acceptance oracle.
 */

/** Page tab title (frozen `PrintSEO` title, prefixed with the site name by usePageMeta). */
export const PRINT_PAGE_TITLE = 'Memory Book'

/** Frozen `PrintSEO` description. */
export const PRINT_PAGE_DESCRIPTION =
  "Print a photo book or guestbook keepsake from Austin & Jordyn's wedding archive."

/** Canonical path (frozen `PrintSEO` canonical + noindex). */
export const PRINT_PAGE_CANONICAL = '/print'

/** Frozen page constants (`src/pages/Print.tsx:39-40`). */
export const PRINT_WEDDING_DATE = 'May 10, 2025'
export const PRINT_COUPLE_NAMES = 'Austin & Jordyn Porada'

/**
 * Frozen copy for the control panel and the print book.
 *
 * `settingsBody` is split because the frozen paragraph wraps the button label
 * in a `<span class='font-medium text-charcoal-700'>`; keeping the three parts
 * separate preserves that DOM structure exactly.
 */
export const PRINT_COPY = {
  controlPanelTitle: 'Memory Book',
  printButtonLabel: 'Print / Save PDF',
  settingsHeading: 'Choose what to include',
  settingsBodyBefore: 'Select albums and sections, then click ',
  settingsBodyHighlight: 'Print / Save PDF',
  settingsBodyAfter: ". Your browser's print dialog lets you save as a PDF or send to any printer.",
  photoAlbumsLabel: 'Photo albums',
  maxPhotosLabel: 'Max photos per album',
  guestbookToggleLabel: 'Guestbook messages',
  guestbookHeading: 'Words from our guests',
  archiveEyebrow: 'A wedding archive',
  emptyBookMessage: 'Select at least one album above to include photos.',
  loadingGuestbookLabel: 'Loading guestbook…',
  loadingAlbumPrefix: 'Loading ',
} as const

/** Frozen initial/reset value (`useState(40)` in the oracle). */
export const PRINT_MAX_PHOTOS_DEFAULT = 40

/** Frozen range input bounds (`src/pages/Print.tsx:280-283`). */
export const PRINT_MAX_PHOTOS_SLIDER = {
  min: 6,
  max: 200,
  step: 2,
} as const

/** Frozen numeric input bounds (`src/pages/Print.tsx:288-292`). */
export const PRINT_MAX_PHOTOS_NUMBER = {
  min: 1,
  max: 500,
} as const

/**
 * Clamp a user-entered max-photos value to the frozen numeric bounds.
 *
 * The oracle clamps on every numeric-input change with
 * `Math.max(1, Math.min(500, Number(value)))`. Two robustness deltas:
 * non-finite input (e.g. an empty field) falls back to the minimum instead of
 * becoming `NaN`, and fractional values are truncated — neither changes any
 * behaviour a visitor can reach with the frozen bounds in place.
 */
export function clampPrintMaxPhotos(value: number): number {
  if (!Number.isFinite(value)) return PRINT_MAX_PHOTOS_NUMBER.min
  return Math.max(
    PRINT_MAX_PHOTOS_NUMBER.min,
    Math.min(PRINT_MAX_PHOTOS_NUMBER.max, Math.trunc(value))
  )
}

/** Pluralised counter copy ("1 photo" / "6 photos"). */
export function formatPhotoCount(count: number): string {
  return `${count} ${count === 1 ? 'photo' : 'photos'}`
}

/** Pluralised counter copy ("1 message" / "3 messages"). */
export function formatMessageCount(count: number): string {
  return `${count} ${count === 1 ? 'message' : 'messages'}`
}
