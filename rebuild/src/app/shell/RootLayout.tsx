import { Outlet, useRouterState } from '@tanstack/react-router'
import { QueryProvider } from '../providers/QueryProvider'
import { AccessibilityProvider } from './AccessibilityProvider'
import { Footer } from './Footer'
import { Header } from './Header'
import { PageTransition } from './PageTransition'
import { pageTitle } from './pageTitle'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { SkipLink } from './SkipLink'
import { ThemeProvider } from './ThemeProvider'

/**
 * Shell chrome rules mirrored from the frozen app (`src/App.tsx`):
 * header hidden on `/`, `/print` and admin-login/admin children; footer hidden
 * on `/print` and admin-login/admin children (`/admin` itself renders both in
 * the frozen app, so it does here too).
 */
export function RootLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isHome = pathname === '/'
  const isPrint = pathname === '/print'
  const isAdmin = pathname === '/admin/login' || pathname.startsWith('/admin/')

  return (
    <AccessibilityProvider>
      <QueryProvider>
        <ThemeProvider>
          <div className='theme-canvas min-h-screen'>
            <SkipLink />
            {!isHome && !isPrint && !isAdmin && <Header />}

            <main
              id='main-content'
              role='main'
              aria-label={pageTitle(pathname) ?? 'Page content'}
              tabIndex={-1}
              className='outline-none'
            >
              <RouteErrorBoundary>
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </RouteErrorBoundary>
            </main>

            {!isAdmin && !isPrint && <Footer />}
          </div>
        </ThemeProvider>
      </QueryProvider>
    </AccessibilityProvider>
  )
}
