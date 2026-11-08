import { Outlet, useRouterState } from '@tanstack/react-router'
import { QueryProvider } from '../providers/QueryProvider'
import { AccessibilityProvider } from './AccessibilityProvider'
import { Footer } from './Footer'
import { Header } from './Header'
import { PageTransition } from './PageTransition'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { SkipLink } from './SkipLink'
import { ThemeProvider } from './ThemeProvider'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/film': 'Wedding Film',
  '/gallery': 'Photo Gallery',
  '/upload': 'Share Memories',
  '/guestbook': 'Guestbook',
  '/guest-photos': 'Guest Memories',
  '/activity': 'Activity',
  '/admin/login': 'Admin Login',
  '/admin': 'Admin Dashboard',
  '/print': 'Memory Book',
}

export function pageTitle(pathname: string): string {
  if (pathname.startsWith('/guest/')) return 'Guest Album'
  if (pathname.startsWith('/admin')) return PAGE_TITLES['/admin'] ?? 'Admin Dashboard'
  return PAGE_TITLES[pathname] ?? 'Page Not Found'
}

/**
 * Shell chrome rules mirrored from the frozen app (`src/App.tsx`):
 * header hidden on `/`, `/print` and admin; footer hidden on `/print` and admin.
 */
export function RootLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isHome = pathname === '/'
  const isPrint = pathname === '/print'
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

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
              aria-label={pageTitle(pathname)}
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
