/**
 * Admin auth gate, ported from the frozen `src/pages/Admin.tsx`:
 * - loading -> skeleton with the frozen visible copy;
 * - unauthenticated OR authenticated-but-not-admin -> redirect to
 *   `/admin/login` preserving the attempted target (`from`);
 * - admin role comes from app_metadata only (A2/A4 security invariant).
 *
 * DELTA (documented): the frozen page redirected during render with
 * react-router `<Navigate>`; TanStack Router owns navigation, so the redirect is
 * an effect. The visible loader and destination are unchanged.
 */
import { useEffect, type ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useAdminAuth } from './auth-context'
import { navigateToAdminLogin, useAdminNavigate } from './routing'

export interface AdminGateProps {
  children: ReactNode
}

export function AdminLoadingSkeleton() {
  return (
    <div className='theme-canvas flex min-h-screen items-center justify-center px-4'>
      <div className='theme-panel w-full max-w-2xl rounded-[1.25rem] p-5'>
        <div className='theme-skeleton h-5 w-36 rounded-full' />
        <div className='theme-skeleton mt-5 h-10 w-2/3 rounded-2xl' />
        <div className='theme-skeleton mt-6 h-28 rounded-xl' />
        <span className='sr-only'>Loading admin workspace...</span>
      </div>
    </div>
  )
}

export function AdminGate({ children }: AdminGateProps) {
  const auth = useAdminAuth()
  const navigate = useAdminNavigate()
  const attemptedHref = useRouterState({ select: state => state.location.href })
  const pathname = useRouterState({ select: state => state.location.pathname })

  // Never bounce from inside the login route (a route-matching edge case can
  // mount the workspace container on the login path; redirecting from there
  // would loop). The login page owns its own already-admin redirect.
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login/')
  const mustRedirect = !isLoginRoute && !auth.isLoading && (!auth.isAuthenticated || !auth.isAdmin)

  useEffect(() => {
    if (!mustRedirect) return
    navigateToAdminLogin(navigate, attemptedHref, { replace: true })
  }, [attemptedHref, mustRedirect, navigate])

  if (isLoginRoute) {
    return null
  }

  if (auth.isLoading) {
    return <AdminLoadingSkeleton />
  }

  if (mustRedirect) {
    // The redirect effect above has already scheduled the navigation; render the
    // loader meanwhile instead of a flash of admin chrome.
    return <AdminLoadingSkeleton />
  }

  return <>{children}</>
}
