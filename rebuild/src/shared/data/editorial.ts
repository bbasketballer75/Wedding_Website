/**
 * Site editorial features — the curated home-page / film-page slots and their
 * append-only edit history.
 *
 * Frozen surface: `src/lib/supabase/editorial.ts` + the admin featured-content
 * screens. Public reads are time-window aware (RLS: active AND inside
 * `[starts_at, ends_at]`), so the pure `isEditorialFeatureLive` helper encodes
 * the same rule for client-side filtering/parity.
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { DataError, toDataError, unwrapResult } from './errors'
import type { Json, TableRow } from './schema'
import { isJsonObject } from './schema'

export type SiteEditorialFeatureRow = TableRow<'site_editorial_features'>
export type SiteEditorialFeatureHistoryRow = TableRow<'site_editorial_feature_history'>

/** The four editorial slots (mirrors the DB CHECK constraint + unique key). */
export const EDITORIAL_SLOTS = [
  'home_newest_standout_upload',
  'home_featured_guestbook_note',
  'home_moment_of_the_week',
  'film_featured_guest_video',
] as const
export type EditorialSlot = (typeof EDITORIAL_SLOTS)[number]

/** Where a slot's content comes from. */
export const EDITORIAL_SOURCE_TYPES = [
  'guest_upload',
  'guestbook_message',
  'film_chapter',
  'custom',
] as const
export type EditorialSourceType = (typeof EDITORIAL_SOURCE_TYPES)[number]

/** Memory trails shared by guest uploads and editorial slots. */
export const MEMORY_TRAILS = [
  'ceremony',
  'family',
  'dance-floor',
  'engagement-season',
  'bach-ette',
] as const
export type MemoryTrail = (typeof MEMORY_TRAILS)[number]

export function isEditorialSlot(value: string | null | undefined): value is EditorialSlot {
  return typeof value === 'string' && (EDITORIAL_SLOTS as readonly string[]).includes(value)
}

export function isEditorialSourceType(
  value: string | null | undefined
): value is EditorialSourceType {
  return typeof value === 'string' && (EDITORIAL_SOURCE_TYPES as readonly string[]).includes(value)
}

export function isMemoryTrail(value: string | null | undefined): value is MemoryTrail {
  return typeof value === 'string' && (MEMORY_TRAILS as readonly string[]).includes(value)
}

/** Normalised editorial feature consumed by the home/film/admin UI. */
export interface EditorialFeature {
  id: string
  slot: EditorialSlot
  title: string
  summary: string | null
  trail: string | null
  sourceType: EditorialSourceType
  sourceId: string | null
  sourceLabel: string | null
  sourceUrl: string | null
  isActive: boolean
  displayOrder: number
  metadata: Json
  memoryTrail: MemoryTrail | null
  badgeLabel: string | null
  ctaLabel: string | null
  startsAt: string | null
  endsAt: string | null
  updatedByEmail: string | null
  createdAt: string
  updatedAt: string
}

/** Normalised editorial history entry (admin history drawer). */
export interface EditorialHistoryEntry {
  id: string
  slot: EditorialSlot
  featureId: string | null
  actorEmail: string | null
  actorName: string | null
  changeSummary: string
  createdAt: string
}

/** Input for the admin upsert (one row per slot). */
export interface UpsertEditorialFeatureInput {
  slot: EditorialSlot
  title: string
  summary?: string | null
  trail?: string | null
  sourceType: EditorialSourceType
  sourceId?: string | null
  sourceLabel?: string | null
  sourceUrl?: string | null
  isActive?: boolean
  displayOrder?: number
  metadata?: Json
  memoryTrail?: MemoryTrail | null
  badgeLabel?: string | null
  ctaLabel?: string | null
  startsAt?: string | null
  endsAt?: string | null
  actor?: { userId?: string | null; email?: string | null; name?: string | null } | null
}

/** Input for appending an edit-history entry. */
export interface RecordEditorialHistoryInput {
  slot: EditorialSlot
  featureId?: string | null
  changeSummary: string
  previousFeature?: Json
  nextFeature?: Json
  actor?: { userId?: string | null; email?: string | null; name?: string | null } | null
}

const EDITORIAL_READ_ERROR = 'Featured content is taking a moment. Please try again.'
const EDITORIAL_WRITE_ERROR = 'That featured-content change could not be saved. Please try again.'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Parse one editorial row (tolerant: the admin fixture ships `title: null` for
 * unconfigured slots, while the DB column is NOT NULL).
 */
export function parseEditorialFeature(raw: unknown): EditorialFeature | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const slot = asString(record.slot)
  if (!id || !isEditorialSlot(slot)) return null

  const sourceType = asString(record.source_type)
  const memoryTrail = asString(record.memory_trail)

  return {
    id,
    slot,
    title: asString(record.title) ?? '',
    summary: asString(record.summary),
    trail: asString(record.trail),
    sourceType: isEditorialSourceType(sourceType) ? sourceType : 'custom',
    sourceId: asString(record.source_id),
    sourceLabel: asString(record.source_label),
    sourceUrl: asString(record.source_url),
    isActive: record.is_active === true,
    displayOrder: typeof record.display_order === 'number' ? record.display_order : 0,
    metadata: isJsonObject(record.metadata) ? record.metadata : {},
    memoryTrail: isMemoryTrail(memoryTrail) ? memoryTrail : null,
    badgeLabel: asString(record.badge_label),
    ctaLabel: asString(record.cta_label),
    startsAt: asString(record.starts_at),
    endsAt: asString(record.ends_at),
    updatedByEmail: asString(record.updated_by_email),
    createdAt: asString(record.created_at) ?? '',
    updatedAt: asString(record.updated_at) ?? '',
  }
}

/** Parse a list, dropping malformed entries (duplicate slots are allowed here; DB is unique). */
export function parseEditorialFeatures(raw: readonly unknown[]): EditorialFeature[] {
  const features: EditorialFeature[] = []
  for (const entry of raw) {
    const feature = parseEditorialFeature(entry)
    if (feature) features.push(feature)
  }
  return features
}

function parseIso(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Public-visibility rule (mirrors the RLS `Public users can read active
 * editorial features` policy): active AND started AND not finished.
 */
export function isEditorialFeatureLive(feature: EditorialFeature, now: Date): boolean {
  if (!feature.isActive) return false

  const nowMs = now.getTime()
  const startsAt = parseIso(feature.startsAt)
  if (startsAt !== null && startsAt > nowMs) return false

  const endsAt = parseIso(feature.endsAt)
  if (endsAt !== null && endsAt < nowMs) return false

  return true
}

/** Filter + order live features the way the public pages consume them. */
export function selectLiveEditorialFeatures(
  features: readonly EditorialFeature[],
  now: Date
): EditorialFeature[] {
  return features.filter(feature => isEditorialFeatureLive(feature, now))
}

/** Read all slots (or one slot) ordered like the public/admin UI. */
export async function fetchSiteEditorialFeatures(
  slot?: EditorialSlot,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<EditorialFeature[]> {
  let query = client
    .from('site_editorial_features')
    .select('*')
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (slot) query = query.eq('slot', slot)

  const rows = unwrapResult(await query, EDITORIAL_READ_ERROR)
  return parseEditorialFeatures(rows ?? [])
}

/**
 * Read editorial slots and keep only the live ones (public visibility window).
 * This is what the home/film routes consume: the DB RLS already enforces the
 * window for anon selects, but seeding/admin reads can see more, so the filter
 * is applied client-side too for deterministic rendering.
 */
export async function fetchLiveEditorialFeatures(
  slot?: EditorialSlot,
  now: Date = new Date(),
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<EditorialFeature[]> {
  const features = await fetchSiteEditorialFeatures(slot, client)
  return selectLiveEditorialFeatures(features, now)
}

/** Read one slot (the DB unique key makes this a single row). */ export async function fetchSiteEditorialFeatureBySlot(
  slot: EditorialSlot,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<EditorialFeature | null> {
  const { data, error } = await client
    .from('site_editorial_features')
    .select('*')
    .eq('slot', slot)
    .maybeSingle()

  if (error) throw toDataError(error, EDITORIAL_READ_ERROR)
  return data ? parseEditorialFeature(data) : null
}

/** Read the edit history (newest first, capped like the frozen admin drawer). */
export async function fetchSiteEditorialFeatureHistory(
  slot?: EditorialSlot,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<EditorialHistoryEntry[]> {
  let query = client
    .from('site_editorial_feature_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  if (slot) query = query.eq('slot', slot)

  const rows = unwrapResult(await query, EDITORIAL_READ_ERROR) ?? []
  const entries: EditorialHistoryEntry[] = []
  for (const row of rows) {
    const slotValue = row.slot
    if (!isEditorialSlot(slotValue)) continue
    entries.push({
      id: row.id,
      slot: slotValue,
      featureId: row.feature_id,
      actorEmail: row.actor_email,
      actorName: row.actor_name,
      changeSummary: row.change_summary,
      createdAt: row.created_at,
    })
  }
  return entries
}

/** Append one edit-history entry. */
export async function recordSiteEditorialFeatureHistory(
  input: RecordEditorialHistoryInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<SiteEditorialFeatureHistoryRow> {
  const actor = input.actor ?? null
  const rows = unwrapResult(
    await client
      .from('site_editorial_feature_history')
      .insert({
        slot: input.slot,
        feature_id: input.featureId ?? null,
        change_summary: input.changeSummary,
        previous_feature: input.previousFeature ?? {},
        next_feature: input.nextFeature ?? {},
        ...(actor?.userId != null ? { actor_user_id: actor.userId } : {}),
        ...(actor?.email != null ? { actor_email: actor.email } : {}),
        ...(actor?.name != null ? { actor_name: actor.name } : {}),
      })
      .select('*'),
    EDITORIAL_WRITE_ERROR
  )

  const row = (rows ?? [])[0]
  if (!row) {
    throw new DataError({
      message: EDITORIAL_WRITE_ERROR,
      code: 'insert:empty-result',
      cause: { table: 'site_editorial_feature_history', slot: input.slot },
    })
  }
  return row
}

/** Upsert one slot (one row per slot; admin featured-content editor). */
export async function upsertSiteEditorialFeature(
  input: UpsertEditorialFeatureInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<SiteEditorialFeatureRow> {
  const actor = input.actor ?? null

  const rows = unwrapResult(
    await client
      .from('site_editorial_features')
      .upsert(
        {
          slot: input.slot,
          title: input.title,
          summary: input.summary ?? null,
          trail: input.trail ?? null,
          source_type: input.sourceType,
          source_id: input.sourceId ?? null,
          source_label: input.sourceLabel ?? null,
          source_url: input.sourceUrl ?? null,
          is_active: input.isActive ?? true,
          display_order: input.displayOrder ?? 0,
          metadata: input.metadata ?? {},
          memory_trail: input.memoryTrail ?? null,
          badge_label: input.badgeLabel ?? null,
          cta_label: input.ctaLabel ?? null,
          starts_at: input.startsAt ?? null,
          ends_at: input.endsAt ?? null,
          updated_at: new Date().toISOString(),
          ...(actor?.userId != null ? { updated_by_user_id: actor.userId } : {}),
          ...(actor?.email != null ? { updated_by_email: actor.email } : {}),
        },
        { onConflict: 'slot' }
      )
      .select('*'),
    EDITORIAL_WRITE_ERROR
  )

  const row = (rows ?? [])[0]
  if (!row) {
    throw new DataError({
      message: EDITORIAL_WRITE_ERROR,
      code: 'upsert:empty-result',
      cause: { table: 'site_editorial_features', slot: input.slot },
    })
  }
  return row
}
