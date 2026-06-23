/**
 * Activity feed — recent photos, guestbook entries, and featured moments.
 * Drives the /activity page and the home page activity widget.
 */
import { supabase } from './client'
import type { ActivityLogItem } from './types'

export async function fetchActivityFeed(limit = 100): Promise<ActivityLogItem[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function fetchActivityItem(
  sourceType: string,
  sourceId: string
): Promise<ActivityLogItem | null> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle()
  if (error) return null
  return data
}