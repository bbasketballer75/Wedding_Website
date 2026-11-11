/**
 * Data seams for the admin featured-content manager (`/admin/featured`).
 *
 * Mirrors the frozen `src/pages/admin/FeaturedContentManager.tsx` read/write
 * surface: one row per editorial slot, an append-only history entry per save,
 * four fixed slots and four source types.
 *
 * Default bindings point at the typed Wave-3 data layer
 * (`@/shared/data/editorial`). Tests inject `FEATURED_CONTENT_FIXTURES`.
 *
 * TODO(Wave3/Lead): W7-1 owns `features/admin/data.ts`; if it grows the same
 * four calls, re-export from there and delete these bindings. The payload
 * shapes (`UpsertEditorialFeatureInput` / `RecordEditorialHistoryInput`) mirror
 * the DB columns and must stay identical.
 */
import {
  EDITORIAL_SLOTS,
  EDITORIAL_SOURCE_TYPES,
  fetchSiteEditorialFeatureBySlot,
  fetchSiteEditorialFeatureHistory,
  parseEditorialFeature,
  recordSiteEditorialFeatureHistory,
  upsertSiteEditorialFeature,
  type EditorialFeature,
  type EditorialHistoryEntry,
  type EditorialSlot,
  type EditorialSourceType,
  type RecordEditorialHistoryInput,
  type UpsertEditorialFeatureInput,
} from '@/shared/data/editorial'

export type {
  EditorialFeature,
  EditorialHistoryEntry,
  EditorialSlot,
  EditorialSourceType,
  RecordEditorialHistoryInput,
  UpsertEditorialFeatureInput,
}

export interface FeaturedContentData {
  readonly fetchFeature: (slot: EditorialSlot) => Promise<EditorialFeature | null>
  readonly fetchHistory: (slot: EditorialSlot) => Promise<EditorialHistoryEntry[]>
  readonly saveFeature: (input: UpsertEditorialFeatureInput) => Promise<EditorialFeature>
  readonly appendHistory: (input: RecordEditorialHistoryInput) => Promise<void>
}

/** Default bindings against the typed Wave-3 data layer. */
export const featuredContentData: FeaturedContentData = {
  fetchFeature: slot => fetchSiteEditorialFeatureBySlot(slot),
  fetchHistory: slot => fetchSiteEditorialFeatureHistory(slot),
  saveFeature: async input => {
    const row = await upsertSiteEditorialFeature(input)
    const parsed = parseEditorialFeature(row)
    if (!parsed) throw new Error(`Could not parse the saved ${input.slot} slot.`)
    return parsed
  },
  appendHistory: async input => {
    await recordSiteEditorialFeatureHistory(input)
  },
}

/** Frozen slot metadata (`FeaturedContentManager.tsx:29-54`). */
export interface EditorialSlotMeta {
  slot: EditorialSlot
  label: string
  description: string
  defaultBadge: string
}

export const FEATURED_SLOTS: readonly [EditorialSlotMeta, ...EditorialSlotMeta[]] = [
  {
    slot: 'home_moment_of_the_week',
    label: 'Moment of the Week',
    description: 'Appears as a cinematic card below the guest highlight reel on the homepage.',
    defaultBadge: 'Moment of the Week',
  },
  {
    slot: 'home_newest_standout_upload',
    label: 'Standout Upload',
    description: 'Highlights an outstanding guest photo or video submission on the homepage.',
    defaultBadge: 'Standout Upload',
  },
  {
    slot: 'home_featured_guestbook_note',
    label: 'Featured Note',
    description: 'Surfaces a guestbook message as a featured quote on the homepage.',
    defaultBadge: 'Featured Note',
  },
  {
    slot: 'film_featured_guest_video',
    label: 'Film Feature',
    description: 'Highlights a guest video within the film player page.',
    defaultBadge: 'Film Feature',
  },
]

/** Frozen source-type select options (`FeaturedContentManager.tsx:56-61`). */
export const EDITORIAL_SOURCE_TYPE_OPTIONS: readonly {
  value: EditorialSourceType
  label: string
}[] = [
  { value: 'custom', label: 'Custom (typed content)' },
  { value: 'guest_upload', label: 'Guest Upload' },
  { value: 'guestbook_message', label: 'Guestbook Message' },
  { value: 'film_chapter', label: 'Film Chapter' },
]

export { EDITORIAL_SLOTS, EDITORIAL_SOURCE_TYPES }

function fixtureFeature(
  slot: EditorialSlot,
  overrides: Partial<EditorialFeature> = {}
): EditorialFeature {
  return {
    id: `feature-${slot}`,
    slot,
    title: '',
    summary: null,
    trail: null,
    sourceType: 'custom',
    sourceId: null,
    sourceLabel: null,
    sourceUrl: null,
    isActive: false,
    displayOrder: 0,
    metadata: {},
    memoryTrail: null,
    badgeLabel: null,
    ctaLabel: null,
    startsAt: null,
    endsAt: null,
    updatedByEmail: null,
    createdAt: '2025-05-15T00:00:00.000Z',
    updatedAt: '2025-05-15T00:00:00.000Z',
    ...overrides,
  }
}

export const FIXTURE_FEATURES: Record<EditorialSlot, EditorialFeature> = {
  home_moment_of_the_week: fixtureFeature('home_moment_of_the_week', {
    id: 'feat-1',
    title: 'The First Dance',
    summary: 'A quiet moment before the lights came on.',
    badgeLabel: 'Moment of the Week',
    ctaLabel: 'See the photo',
    sourceType: 'custom',
    isActive: true,
  }),
  home_newest_standout_upload: fixtureFeature('home_newest_standout_upload', {
    id: 'feat-2',
    badgeLabel: 'Standout Upload',
  }),
  home_featured_guestbook_note: fixtureFeature('home_featured_guestbook_note', {
    id: 'feat-3',
    badgeLabel: 'Featured Note',
  }),
  film_featured_guest_video: fixtureFeature('film_featured_guest_video', {
    id: 'feat-4',
    badgeLabel: 'Film Feature',
  }),
}

export const FIXTURE_HISTORY: readonly EditorialHistoryEntry[] = [
  {
    id: 'history-1',
    slot: 'home_moment_of_the_week',
    featureId: 'feat-1',
    actorEmail: 'admin@test.wedding',
    actorName: 'Admin',
    changeSummary: 'Set "The First Dance" as the active Moment of the Week',
    createdAt: '2025-05-15T10:00:00.000Z',
  },
  {
    id: 'history-2',
    slot: 'home_moment_of_the_week',
    featureId: 'feat-1',
    actorEmail: 'admin@test.wedding',
    actorName: 'Admin',
    changeSummary: 'Updated "The First Dance" (inactive)',
    createdAt: '2025-05-14T10:00:00.000Z',
  },
]

/** Deterministic seam used by the featured-content tests. */
export const FEATURED_CONTENT_FIXTURES: FeaturedContentData = {
  fetchFeature: slot =>
    Promise.resolve(FIXTURE_FEATURES[slot] ? { ...FIXTURE_FEATURES[slot] } : null),
  fetchHistory: slot =>
    Promise.resolve(
      FIXTURE_HISTORY.filter(entry => entry.slot === slot).map(entry => ({ ...entry }))
    ),
  saveFeature: input =>
    Promise.resolve(
      fixtureFeature(input.slot, {
        id: FIXTURE_FEATURES[input.slot]?.id ?? `feature-${input.slot}`,
        title: input.title,
        summary: input.summary ?? null,
        badgeLabel: input.badgeLabel ?? null,
        ctaLabel: input.ctaLabel ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceType: input.sourceType,
        isActive: input.isActive ?? true,
        updatedAt: '2025-05-16T10:00:00.000Z',
      })
    ),
  appendHistory: () => Promise.resolve(),
}
