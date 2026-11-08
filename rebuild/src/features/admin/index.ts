/**
 * Public API of the admin feature (Wave 7 W7-1).
 *
 * Route wiring (Lead):
 *   /admin/login -> <AdminLoginPage />
 *   /admin       -> <AdminApp />
 *   /admin/$     -> <AdminApp />
 *
 * The Lead passes `runtime` (auth client + admin data API adapters over
 * `shared/data`, see `data.ts` TODOs) and `pages` (W7-2 page components for
 * album-organizer / media-review / featured-content / analytics / settings).
 * Omitting `runtime` uses the deterministic in-memory stub.
 */
export { AdminApp, AdminGate, AdminLayout } from './AdminApp'
export { AdminApiProvider } from './api'
export { AdminAuthProvider } from './auth'
export { useAdminApi } from './api-context'
export { useAdminAuth } from './auth-context'
export { AdminLoginPage } from './AdminLoginPage'
export type { AdminAppProps, AdminPageOverrides } from './AdminApp'

export {
  ADMIN_SECTIONS,
  W7_1_SECTIONS,
  createInMemoryAdminApi,
  createInMemoryAuthClient,
  createSnapshotAuthClient,
  getAdminAuditActor,
  isAdminRoleMetadata,
} from './data'
export type {
  AdminApi,
  AdminAuditActor,
  AdminAuditEntry,
  AdminAuthClient,
  AdminAuthSnapshot,
  AdminClaim,
  AdminDashboardCounts,
  AdminGuestbookMessage,
  AdminRuntime,
  AdminSection,
  AdminSignInResult,
  AdminUpload,
  AdminUploadStatus,
  AdminUser,
  BulkModerateInput,
  DeleteGuestbookInput,
  InMemoryAdminApiOptions,
  LogAuditInput,
  ModerateClaimInput,
  ModerateUploadInput,
  PublishToAlbumInput,
  StubAuthCredentials,
} from './data'

export { createAdminRuntime, getDefaultAdminRuntime, resetDefaultAdminRuntime } from './runtime'
export {
  ADMIN_FIXED_NOW,
  ADMIN_FIXTURES,
  FIXTURE_ADMIN_USER,
  FIXTURE_CREDENTIALS,
  FIXTURE_NON_ADMIN_USER,
} from './fixtures'

export {
  ADMIN_NAV_ITEMS,
  ADMIN_NAV_SECTIONS,
  ADMIN_ROUTE_META,
  AUDIT_ACTION_LABELS,
  formatAuditTimestamp,
  getAdminRouteMeta,
  getAuditActorLabel,
  getAuditEntityLabel,
} from './utils'
export { adminPathForSection, adminSectionFromPathname, parseAdminLoginFrom } from './routing'
