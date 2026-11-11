/**
 * Data seam for the admin analytics page (`/admin/analytics`).
 *
 * The frozen page reads six exact PostgREST counts inside the selected
 * 7/30/90-day window and is explicitly not a traffic dashboard (GA4/Sentry own
 * traffic). The Wave-3 data layer does not expose windowed counters yet, so the
 * default binding queries the shared typed client directly (same six calls as
 * `src/pages/admin/Analytics.tsx:27-63`) and the tests inject fixtures.
 *
 * TODO(Wave3/Lead): move `fetchAnalyticsCounts` into `@/shared/data` (or
 * W7-1's `features/admin/data.ts`) once windowed admin counts land, then delete
 * the direct client access here. Semantics to preserve: `created_at >= now -
 * days`; approved/pending uploads filtered by status; photos split by
 * `is_professional` false/true.
 */
import { getSupabaseClient } from '@/shared/data/client'

export type AnalyticsWindow = '7d' | '30d' | '90d'

export const ANALYTICS_WINDOWS: readonly AnalyticsWindow[] = ['7d', '30d', '90d']

export const ANALYTICS_WINDOW_LABELS: Record<AnalyticsWindow, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
}

export interface AnalyticsCounts {
  approvedUploads: number
  pendingUploads: number
  guestbookEntries: number
  publishedPhotos: number
  guestPhotos: number
  professionalPhotos: number
}

export interface AnalyticsData {
  readonly fetchCounts: (window: AnalyticsWindow) => Promise<AnalyticsCounts>
}

const EMPTY_COUNTS: AnalyticsCounts = {
  approvedUploads: 0,
  pendingUploads: 0,
  guestbookEntries: 0,
  publishedPhotos: 0,
  guestPhotos: 0,
  professionalPhotos: 0,
}

function windowStart(window: AnalyticsWindow): string {
  const days = window === '7d' ? 7 : window === '30d' ? 30 : 90
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  return startDate.toISOString()
}

/** Default binding: the same six windowed count queries as the frozen page. */
export const analyticsData: AnalyticsData = {
  fetchCounts: async window => {
    const client = getSupabaseClient()
    const startIso = windowStart(window)

    const [
      approvedUploads,
      pendingUploads,
      guestbookEntries,
      publishedPhotos,
      guestPhotos,
      professionalPhotos,
    ] = await Promise.all([
      client
        .from('guest_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('created_at', startIso),
      client
        .from('guest_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('created_at', startIso),
      client
        .from('guestbook_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startIso),
      client.from('photos').select('*', { count: 'exact', head: true }).gte('created_at', startIso),
      client
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('is_professional', false)
        .gte('created_at', startIso),
      client
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('is_professional', true)
        .gte('created_at', startIso),
    ])

    const firstError =
      approvedUploads.error ??
      pendingUploads.error ??
      guestbookEntries.error ??
      publishedPhotos.error ??
      guestPhotos.error ??
      professionalPhotos.error
    if (firstError) throw firstError

    return {
      approvedUploads: approvedUploads.count ?? 0,
      pendingUploads: pendingUploads.count ?? 0,
      guestbookEntries: guestbookEntries.count ?? 0,
      publishedPhotos: publishedPhotos.count ?? 0,
      guestPhotos: guestPhotos.count ?? 0,
      professionalPhotos: professionalPhotos.count ?? 0,
    }
  },
}

/**
 * Deterministic fixtures keyed by window. The numbers intentionally differ per
 * window so tests can prove the window actually drives the request.
 */
export const FIXTURE_ANALYTICS_COUNTS: Record<AnalyticsWindow, AnalyticsCounts> = {
  '7d': {
    approvedUploads: 2,
    pendingUploads: 1,
    guestbookEntries: 3,
    publishedPhotos: 5,
    guestPhotos: 2,
    professionalPhotos: 3,
  },
  '30d': {
    approvedUploads: 12,
    pendingUploads: 4,
    guestbookEntries: 21,
    publishedPhotos: 42,
    guestPhotos: 17,
    professionalPhotos: 25,
  },
  '90d': {
    approvedUploads: 30,
    pendingUploads: 6,
    guestbookEntries: 55,
    publishedPhotos: 96,
    guestPhotos: 41,
    professionalPhotos: 55,
  },
}

export const ANALYTICS_FIXTURES: AnalyticsData = {
  fetchCounts: window => Promise.resolve({ ...FIXTURE_ANALYTICS_COUNTS[window] }),
}

/** The frozen page shows zeros for a failed read; the hook keeps that contract. */
export function emptyAnalyticsCounts(): AnalyticsCounts {
  return { ...EMPTY_COUNTS }
}
