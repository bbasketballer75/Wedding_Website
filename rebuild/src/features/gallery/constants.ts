/**
 * Gallery constants — parity port of the frozen `src/components/gallery/constants.ts`
 * (types, collection vocabulary, collection metadata and cover art).
 *
 * The collection vocabulary is EXACTLY `Proposal | Bach+ette | Wedding Photos |
 * Guest Photos` — it is both the tab order and the `?collection=` URL vocabulary
 * (contracts/routes.json gallery notes). DB album aliases are mapped by
 * `normalizeCollectionValue` in ./data.ts; they are never URL values.
 */

import { mediaPaths } from '@/shared/data/media'

export const COLLECTION_TABS = ['Proposal', 'Bach+ette', 'Wedding Photos', 'Guest Photos'] as const

export type CollectionTab = (typeof COLLECTION_TABS)[number]

/** Frozen `collectionTabs` array (same order/values). */
export const collectionTabs: CollectionTab[] = [...COLLECTION_TABS]

export type ViewMode = 'masonry' | 'grid' | 'timeline'

/** Frozen view-mode options + labels + icon names (icons resolved in the UI). */
export const VIEW_OPTIONS = [
  { key: 'masonry', label: 'Masonry' },
  { key: 'grid', label: 'Grid' },
  { key: 'timeline', label: 'Timeline' },
] as const satisfies ReadonlyArray<{ key: ViewMode; label: string }>

/** Frozen `collectionMeta` copy, used by the empty state per collection. */
export const collectionMeta: Record<
  CollectionTab,
  { eyebrow: string; title: string; description: string; supporting: string; sourceHint: string }
> = {
  Proposal: {
    eyebrow: 'Before the wedding',
    title: 'Proposal and engagement portraits',
    description: 'The proposal, portraits, and the whole season before the wedding day.',
    supporting: 'Everything from the engagement chapter lives here.',
    sourceHint: 'Proposal album',
  },
  'Bach+ette': {
    eyebrow: 'Pre-wedding weekends',
    title: 'Bachelor and bachelorette memories',
    description: 'The full pre-wedding weekend album.',
    supporting: 'Everything from the bachelor and bachelorette events lives here.',
    sourceHint: 'Bach+ette album',
  },
  'Wedding Photos': {
    eyebrow: 'The day itself',
    title: 'Wedding day coverage',
    description: 'The photographer-led archive for the day itself.',
    supporting: 'This is the main album for ceremony, portraits, and reception coverage.',
    sourceHint: 'Wedding-day album',
  },
  'Guest Photos': {
    eyebrow: 'From family and friends',
    title: 'Guest Perspectives',
    description: 'A collection of memories and angles shared by our loved ones.',
    supporting: 'This stays separate from the photographer coverage on purpose.',
    sourceHint: 'Guest album',
  },
}

/**
 * Frozen `COLLECTION_COVERS`. The oracle resolves the non-engagement covers
 * through the media CDN (`getMediaPath`); Wave 5 stubs use same-origin files so
 * the page renders without a data/media layer.
 *
 * TODO(Wave3): switch to `shared/data/media`'s `getMediaPath` once the typed
 * data layer owns media URL normalization (parity re-captures with the CDN mock).
 */
export const COLLECTION_COVERS: Record<CollectionTab, string> = {
  Proposal: '/images/engagement/PoradaProposal-29.webp',
  // Frozen non-engagement covers resolve through the media CDN (`getMediaPath`).
  'Bach+ette': mediaPaths.getMediaPath(
    '/media/_thumbs/Bach+ette/Photos/PXL_20240816_221115487.MP.webp'
  ),
  'Wedding Photos': mediaPaths.getMediaPath(
    '/media/_thumbs/Professional/Wedding Day/Photos/DSC06261.webp'
  ),
  'Guest Photos': mediaPaths.getMediaPath(
    '/media/_thumbs/Guest Uploads/Wedding Day/Live Photos/Stills/20250511_180812-0b9c.webp'
  ),
}

/** Frozen batch-download limits (`Gallery.tsx` select-all + `utils/download.ts`). */
export const MAX_SELECTION = 50
/** <= this many selected photos are zipped client-side; above uses download-pack. */
export const CLIENT_ZIP_LIMIT = 20

/** Frozen infinite-scroll page size: grid = 18, masonry/timeline = 12. */
export const PAGE_SIZE: Record<ViewMode, number> = {
  masonry: 12,
  grid: 18,
  timeline: 12,
}

/** Frozen button labels (also the text-layout oracle for `/gallery`). */
export const GALLERY_COPY = {
  eyebrow: 'Gallery',
  title: 'Browse the archive',
  description:
    'Start with the album you want, then use search or people browsing only when you need it.',
  searchPlaceholder: 'Search by caption, location, photographer, or tags',
  selectLabel: 'Select',
  selectAllLabel: 'Select All Visible',
  clearSelectionLabel: 'Clear Selection',
  clearSearchLabel: 'Clear gallery search',
  loadMoreLabel: 'Load more',
  emptyActionLabel: 'Return to all collections',
  queueFilledLabel: 'Download Queue',
} as const
