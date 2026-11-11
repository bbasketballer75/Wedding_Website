/**
 * Admin routing helpers (Wave 7 W7-1).
 *
 * The app router (Lead-owned) mounts this feature at `/admin` and `/admin/$`
 * (splat). All child navigation therefore goes through the splat route, which
 * keeps this module decoupled from the exact child-route declarations while
 * preserving real URLs (`/admin/photos`, `/admin/audit`, …).
 *
 * `/admin/login` is a separate route.
 */
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { ADMIN_SECTIONS, type AdminSection } from './data'

export type AdminNavigate = ReturnType<typeof useNavigate>

const KNOWN_SECTIONS = new Set<string>(ADMIN_SECTIONS)

/** `/admin/photos?x=1` -> 'photos'; `/admin` -> 'dashboard'; unknown -> 'dashboard'. */
export function adminSectionFromPathname(pathname: string): AdminSection {
  const clean = pathname.replace(/\/+$/, '')
  if (clean === '/admin' || clean === '') return 'dashboard'

  const segment = clean.split('/')[2]
  if (segment && KNOWN_SECTIONS.has(segment) && segment !== 'dashboard') {
    return segment as AdminSection
  }
  return 'dashboard'
}

/** Canonical URL path for a section. */
export function adminPathForSection(section: AdminSection): string {
  return section === 'dashboard' ? '/admin' : `/admin/${section}`
}

/**
 * Resolve the post-login destination from the login URL.
 *
 * Frozen contract: only `/admin*` targets are honoured (open-redirect guard) and
 * the login page itself is not a valid target.
 */
export function parseAdminLoginFrom(searchStr: string): string {
  const params = new URLSearchParams(searchStr)
  const from = params.get('from')
  if (!from) return '/admin'
  if (!from.startsWith('/admin')) return '/admin'
  if (from === '/admin/login' || from.startsWith('/admin/login/')) return '/admin'
  return from
}

export function useAdminRouteSection(): AdminSection {
  return useRouterState({
    select: state => adminSectionFromPathname(state.location.pathname),
  })
}

export function useAdminNavigate(): AdminNavigate {
  return useNavigate()
}

/** Navigate to an admin section (dashboard has its own route, others use splat). */
export function navigateToAdminSection(
  navigate: AdminNavigate,
  section: AdminSection,
  options: { replace?: boolean } = {}
): void {
  if (section === 'dashboard') {
    void navigate({ to: '/admin', replace: options.replace ?? false })
    return
  }
  void navigate({
    to: '/admin/$',
    params: { _splat: section },
    replace: options.replace ?? false,
  })
}

/** Redirect to the login page remembering the attempted admin target. */
export function navigateToAdminLogin(
  navigate: AdminNavigate,
  from: string,
  options: { replace?: boolean } = {}
): void {
  void navigate({
    to: '/admin/login',
    search: { from },
    replace: options.replace ?? false,
  })
}
