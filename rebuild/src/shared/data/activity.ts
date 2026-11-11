/**
 * Activity feed — recent photos, guestbook entries and featured moments, plus the
 * realtime INSERT subscription used by `/activity` and the home widget.
 *
 * Frozen surface: `src/lib/supabase/activity.ts` + `src/hooks/useActivityRealtime.ts`
 * (channel `activity_feed`, `postgres_changes` INSERT on `public.activity_log`).
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { toDataError, unwrapResult } from './errors'
import type { Json, TableRow } from './schema'
import { isJsonObject } from './schema'

export type ActivityLogRow = TableRow<'activity_log'>

/** Feed item kinds (mirrors the DB CHECK constraint). */
export const ACTIVITY_TYPES = ['photo_upload', 'guestbook_entry', 'featured_moment'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/** Source tables (mirrors the DB CHECK constraint). */
export const ACTIVITY_SOURCE_TYPES = [
  'guest_uploads',
  'guestbook_messages',
  'site_editorial_features',
] as const
export type ActivitySourceType = (typeof ACTIVITY_SOURCE_TYPES)[number]

export function isActivityType(value: string | null | undefined): value is ActivityType {
  return typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value)
}

export function isActivitySourceType(
  value: string | null | undefined
): value is ActivitySourceType {
  return typeof value === 'string' && (ACTIVITY_SOURCE_TYPES as readonly string[]).includes(value)
}

/** Normalised activity item (the feed renders this directly). */
export interface ActivityItem {
  id: string
  type: ActivityType
  sourceId: string
  sourceType: ActivitySourceType
  displayName: string | null
  thumbnailUrl: string | null
  contentPreview: string | null
  createdAt: string
}

/** Handle returned by the realtime subscription. */
export interface ActivitySubscription {
  unsubscribe: () => void
}

const ACTIVITY_READ_ERROR = 'The activity feed is taking a moment. Please try again.'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Parse one row (tolerant of malformed/unknown enum values: unknown → dropped). */
export function parseActivityItem(raw: unknown): ActivityItem | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const sourceId = asString(record.source_id)
  const type = asString(record.type)
  const sourceType = asString(record.source_type)
  if (!id || !sourceId || !isActivityType(type) || !isActivitySourceType(sourceType)) return null

  return {
    id,
    type,
    sourceId,
    sourceType,
    displayName: asString(record.display_name),
    thumbnailUrl: asString(record.thumbnail_url),
    contentPreview: asString(record.content_preview),
    createdAt: asString(record.created_at) ?? '',
  }
}

/** Parse a list, dropping malformed entries. */
export function parseActivityItems(raw: readonly unknown[]): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const entry of raw) {
    const item = parseActivityItem(entry)
    if (item) items.push(item)
  }
  return items
}

/** Newest-first feed. */
export async function fetchActivityFeed(
  limit = 100,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<ActivityItem[]> {
  const rows = unwrapResult(
    await client
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
    ACTIVITY_READ_ERROR
  )
  return parseActivityItems(rows ?? [])
}

/** One feed item by its source (used for deep links / de-dup on the client). */
export async function fetchActivityItem(
  sourceType: ActivitySourceType,
  sourceId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<ActivityItem | null> {
  const { data, error } = await client
    .from('activity_log')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle()

  if (error) throw toDataError(error, ACTIVITY_READ_ERROR)
  return data ? parseActivityItem(data) : null
}

/**
 * Subscribe to new activity rows (realtime INSERT).
 *
 * @param onItem called for every parsed insert
 * @param options `enabled: false` skips the websocket entirely (the parity/e2e
 *   harness sets this so screenshots are deterministic); `client` injects a
 *   test client.
 */
export function subscribeToActivityInserts(
  onItem: (item: ActivityItem) => void,
  options: { client?: TypedSupabaseClient; enabled?: boolean } = {}
): ActivitySubscription {
  if (options.enabled === false) {
    return { unsubscribe: () => undefined }
  }

  const client = options.client ?? getSupabaseClient()
  const channel: RealtimeChannel = client
    .channel('activity_feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      payload => {
        const item = parseActivityItem(payload.new)
        if (item) onItem(item)
      }
    )
    .subscribe()

  return {
    unsubscribe: () => {
      void client.removeChannel(channel)
    },
  }
}
