/**
 * `/admin/*` route wrappers (lazy chunk).
 *
 * The admin portal (shell + login + dashboard + moderation + W7-2 pages) is the
 * heaviest feature tree, so it must never be part of the public entry chunk.
 */
import { AdminApp, AdminLoginPage } from '@/features/admin'
import { createSupabaseAdminApi } from './admin-api'
import { useAuth } from '@/shared/data/auth'
import { useMemo } from 'react'
import { Suspense, lazy, type ComponentType } from 'react'
import {
  createSnapshotAuthClient,
  type AdminAuthSnapshot,
  type AdminPageOverrides,
  type AdminRuntime,
  type AdminUser,
} from '@/features/admin'

// W7-2 surfaces are split into their own chunks inside the admin chunk: the
// public bundle never references them and `/admin` stays under the 120 KiB
// per-route budget.
const AlbumOrganizerPage = lazy(() =>
  import('@/features/admin/album-organizer/AlbumOrganizerPage').then(module => ({
    default: module.AlbumOrganizerPage,
  }))
)
const PeopleReviewPage = lazy(() =>
  import('@/features/admin/media-review/PeopleReviewPage').then(module => ({
    default: module.PeopleReviewPage,
  }))
)
const FeaturedContentPage = lazy(() =>
  import('@/features/admin/featured-content/FeaturedContentPage').then(module => ({
    default: module.FeaturedContentPage,
  }))
)
const AnalyticsPage = lazy(() =>
  import('@/features/admin/analytics/AnalyticsPage').then(module => ({
    default: module.AnalyticsPage,
  }))
)
const SettingsPage = lazy(() =>
  import('@/features/admin/settings').then(module => ({ default: module.SettingsPage }))
)

function withAdminSuspense(Component: ComponentType) {
  return function AdminPageBoundary() {
    return (
      <Suspense
        fallback={
          <div className='py-16 text-center text-sm text-charcoal-500' role='status'>
            Loading section…
          </div>
        }
      >
        <Component />
      </Suspense>
    )
  }
}

const ADMIN_PAGES: AdminPageOverrides = {
  albums: withAdminSuspense(AlbumOrganizerPage),
  review: withAdminSuspense(PeopleReviewPage),
  featured: withAdminSuspense(FeaturedContentPage),
  analytics: withAdminSuspense(AnalyticsPage),
  settings: withAdminSuspense(SettingsPage),
}

function toAdminUser(user: ReturnType<typeof useAuth>['user']): AdminUser | null {
  if (!user) return null
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const appMetadata = user.app_metadata as Record<string, unknown> | undefined
  const name =
    (typeof metadata?.full_name === 'string' && metadata.full_name) ||
    (typeof metadata?.name === 'string' && metadata.name) ||
    user.email?.split('@')[0] ||
    'Admin'

  return {
    id: user.id,
    email: user.email ?? null,
    name,
    role: typeof appMetadata?.role === 'string' ? appMetadata.role : null,
  }
}

function useAdminRuntime(): AdminRuntime {
  const auth = useAuth()

  const authClient = useMemo(() => {
    const snapshot: AdminAuthSnapshot = {
      user: toAdminUser(auth.user),
      isLoading: auth.isLoading,
      isAuthenticated: auth.isAuthenticated,
      isAdmin: auth.isAdmin,
    }

    return createSnapshotAuthClient(snapshot, {
      signIn: async (email, password) => {
        const result = await auth.signIn(email, password)
        return result.success
          ? { success: true }
          : { success: false, error: result.error.message ?? 'Unable to sign in' }
      },
      signOut: async () => {
        await auth.signOut()
      },
    })
  }, [auth])

  const api = useMemo(() => createSupabaseAdminApi(), [])

  return useMemo(() => ({ auth: authClient, api }), [api, authClient])
}

export function AdminPageRoute() {
  const runtime = useAdminRuntime()
  return <AdminApp runtime={runtime} pages={ADMIN_PAGES} />
}

export function AdminLoginPageRoute() {
  const runtime = useAdminRuntime()
  return <AdminLoginPage runtime={runtime} />
}
