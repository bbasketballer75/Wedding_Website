/**
 * Admin route adapters (Wave 7 W7-4).
 *
 * - `runtime.auth` is backed by the real Supabase session (`shared/data/auth`),
 *   so `admin` is decided by `app_metadata.role` exactly like the frozen app.
 * - `runtime.api` currently uses the deterministic in-memory admin API; the
 *   Wave 8 pass maps it onto `shared/data/moderation` (the pages already speak
 *   only the `AdminApi` interface, so that swap is local to this file).
 */
import { useMemo } from 'react'
import {
  AdminApp,
  AdminLoginPage,
  createInMemoryAdminApi,
  createSnapshotAuthClient,
  type AdminAuthSnapshot,
  type AdminPageOverrides,
  type AdminRuntime,
  type AdminUser,
} from '@/features/admin'
import { AlbumOrganizerPage } from '@/features/admin/album-organizer/AlbumOrganizerPage'
import { AnalyticsPage } from '@/features/admin/analytics/AnalyticsPage'
import { FeaturedContentPage } from '@/features/admin/featured-content/FeaturedContentPage'
import { PeopleReviewPage } from '@/features/admin/media-review/PeopleReviewPage'
import { SettingsPage } from '@/features/admin/settings'
import { useAuth } from '@/shared/data/auth'

const ADMIN_PAGES: AdminPageOverrides = {
  albums: AlbumOrganizerPage,
  review: PeopleReviewPage,
  featured: FeaturedContentPage,
  analytics: AnalyticsPage,
  settings: SettingsPage,
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

  const api = useMemo(() => createInMemoryAdminApi(), [])

  return useMemo(() => ({ auth: authClient, api }), [api, authClient])
}

export function AdminRoute() {
  const runtime = useAdminRuntime()
  return <AdminApp runtime={runtime} pages={ADMIN_PAGES} />
}

export function AdminLoginRoute() {
  const runtime = useAdminRuntime()
  return <AdminLoginPage runtime={runtime} />
}
