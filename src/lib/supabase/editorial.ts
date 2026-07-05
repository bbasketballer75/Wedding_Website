/**
 * Site editorial features — the curated content slots that appear on the
 * home page (newest standout upload, featured guestbook note, moment of the
 * week) and film page (featured guest video). Admin-only mutations; public
 * reads via the home/film sections.
 */
import { supabase } from './client'
import type {
  RecordSiteEditorialFeatureHistoryInput,
  SiteEditorialFeature,
  SiteEditorialFeatureHistoryEntry,
  SiteEditorialFeatureSlot,
  UpsertSiteEditorialFeatureInput,
} from './types'

export async function fetchSiteEditorialFeatures(slot?: SiteEditorialFeatureSlot) {
  let query = supabase
    .from('site_editorial_features')
    .select('*')
    .order('display_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (slot) {
    query = query.eq('slot', slot)
  }

  return await query.returns<SiteEditorialFeature[]>()
}

export async function fetchSiteEditorialFeatureHistory(slot?: SiteEditorialFeatureSlot) {
  let query = supabase
    .from('site_editorial_feature_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  if (slot) {
    query = query.eq('slot', slot)
  }

  return await query.returns<SiteEditorialFeatureHistoryEntry[]>()
}

export async function fetchSiteEditorialFeatureBySlot(slot: SiteEditorialFeatureSlot) {
  return await supabase
    .from('site_editorial_features')
    .select('*')
    .eq('slot', slot)
    .maybeSingle<SiteEditorialFeature>()
}

export async function recordSiteEditorialFeatureHistory(
  input: RecordSiteEditorialFeatureHistoryInput
) {
  return await supabase
    .from('site_editorial_feature_history')
    .insert({
      slot: input.slot,
      feature_id: input.featureId ?? null,
      actor_user_id: input.actor?.userId ?? null,
      actor_email: input.actor?.email ?? null,
      actor_name: input.actor?.name ?? null,
      change_summary: input.changeSummary,
      previous_feature: input.previousFeature ?? {},
      next_feature: input.nextFeature ?? {},
    })
    .select('*')
    .single<SiteEditorialFeatureHistoryEntry>()
}

export async function upsertSiteEditorialFeature(input: UpsertSiteEditorialFeatureInput) {
  return await supabase
    .from('site_editorial_features')
    .upsert(
      {
        slot: input.slot,
        title: input.title,
        summary: input.summary ?? null,
        trail: input.trail ?? null,
        memory_trail: input.memoryTrail ?? null,
        badge_label: input.badgeLabel ?? null,
        cta_label: input.ctaLabel ?? null,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        source_label: input.sourceLabel ?? null,
        source_url: input.sourceUrl ?? null,
        is_active: input.isActive ?? true,
        display_order: input.displayOrder ?? 0,
        metadata: input.metadata ?? {},
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        updated_by_user_id: input.actor?.userId ?? null,
        updated_by_email: input.actor?.email ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'slot',
      }
    )
    .select('*')
    .single<SiteEditorialFeature>()
}
