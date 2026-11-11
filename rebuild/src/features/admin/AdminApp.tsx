/**
 * Admin app composition for Wave 7 W7-1.
 *
 * Wired by the Lead at `/admin` and `/admin/$`; the login page is wired at
 * `/admin/login`. Everything below the gate/layout is injected:
 *   - `runtime` supplies the auth client + data API (`data.ts` seams);
 *   - `pages` lets W7-2 (album organizer, media review, featured content,
 *     analytics, settings) plug its pages in without this file importing them
 *     while they are being ported in parallel.
 *
 * The shell, gate, nav and page header are frozen-parity ports; W7-1 pages are
 * dashboard, uploads moderation, guestbook moderation, claims moderation and
 * the audit trail.
 */
import type { ComponentType } from 'react'
import { AdminApiProvider } from './api'
import { AdminAuthProvider } from './auth'
import { AdminGate } from './AdminGate'
import type { AdminRuntime, AdminSection } from './data'
import { AdminDashboard } from './dashboard/AdminDashboard'
import { AuditLogPage } from './audit/AuditLogPage'
import { ClaimsModerationPage } from './claims/ClaimsModerationPage'
import { GuestbookModerationPage } from './guestbook/GuestbookModerationPage'
import { AdminLayout } from './layout/AdminLayout'
import { useAdminRouteSection } from './routing'
import { getDefaultAdminRuntime } from './runtime'
import { AdminPageSkeleton, AdminSectionPlaceholder } from './shared/AdminUi'
import { UploadModerationPage } from './uploads/UploadModerationPage'
import { RouteErrorBoundary } from '@/app/shell/RouteErrorBoundary'

/** The five sections this work package ships. */
const W7_1_PAGES: Partial<Record<AdminSection, ComponentType>> = {
  dashboard: AdminDashboard,
  photos: UploadModerationPage,
  claims: ClaimsModerationPage,
  guestbook: GuestbookModerationPage,
  audit: AuditLogPage,
}

export type AdminPageOverrides = Partial<Record<AdminSection, ComponentType>>

function AdminPageSwitch({ pages }: { pages: AdminPageOverrides }) {
  const section = useAdminRouteSection()
  const Page = pages[section] ?? W7_1_PAGES[section]

  return (
    <RouteErrorBoundary key={section}>
      {Page ? <Page /> : <AdminSectionPlaceholder section={section} />}
    </RouteErrorBoundary>
  )
}

export interface AdminAppProps {
  /** Auth client + admin data API; defaults to the deterministic Wave-7 stub. */
  runtime?: AdminRuntime
  /** W7-2 page injection (album-organizer, media-review, featured-content, analytics, settings). */
  pages?: AdminPageOverrides
}

export function AdminApp({ runtime, pages = {} }: AdminAppProps) {
  const resolvedRuntime = runtime ?? getDefaultAdminRuntime()

  return (
    <AdminAuthProvider auth={resolvedRuntime.auth}>
      <AdminApiProvider api={resolvedRuntime.api}>
        <AdminGate>
          <AdminLayout>
            <AdminPageSwitch pages={pages} />
          </AdminLayout>
        </AdminGate>
      </AdminApiProvider>
    </AdminAuthProvider>
  )
}

export { AdminLoadingSkeleton, AdminGate } from './AdminGate'
export { AdminLayout } from './layout/AdminLayout'
export { AdminPageSkeleton }
