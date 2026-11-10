import { Outlet, useRouterState } from '@tanstack/react-router'
import { Suspense, useEffect, useRef, useState } from 'react'
import { PageLoader } from '@/shared/ui/PageLoader'
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
 *
 * The footer is held back until the route content has a real height. The app is
 * client rendered, so the shell paints before a tall route mounts; rendering the
 * footer on the first empty frame made it jump thousands of pixels when content
 * arrived (measured CLS 0.64, source `footer`). Mounting it below real content
 * removes the shift; a 1.5 s fallback guarantees the footer still appears if a
 * route errors or never loads.
 */
export function RootLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isHome = pathname === '/'
  const isPrint = pathname === '/print'
  const isAdmin = pathname === '/admin/login' || pathname.startsWith('/admin/')
  const mainRef = useRef<HTMLElement | null>(null)
  const [readyPath, setReadyPath] = useState<string | null>(null)
  const contentReady = readyPath === pathname

  useEffect(() => {
    const element = mainRef.current
    const markReady = () => setReadyPath(pathname)
    const timer = window.setTimeout(markReady, 1500)
    if (!element) return () => window.clearTimeout(timer)

    const check = () => {
      if (element.scrollHeight > 400) markReady()
    }
    // Deferred one frame so the initial measurement never setState synchronously
    // inside the effect (React lint + cascading-render hygiene).
    const frame = window.requestAnimationFrame(check)
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(check)
      observer.observe(element)
    }
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      observer?.disconnect()
    }
  }, [pathname])

  return (
    <AccessibilityProvider>
      <QueryProvider>
        <ThemeProvider>
          <div className='theme-canvas min-h-screen'>
            <SkipLink />
            {!isHome && !isPrint && !isAdmin && <Header />}

            <main
              id='main-content'
              ref={mainRef}
              role='main'
              aria-label={pageTitle(pathname) ?? 'Page content'}
              tabIndex={-1}
              className='outline-none'
            >
              <RouteErrorBoundary>
                <PageTransition>
                  <Suspense
                    fallback={
                      <div className='min-h-[70vh]'>
                        <PageLoader />
                      </div>
                    }
                  >
                    <Outlet />
                  </Suspense>
                </PageTransition>
              </RouteErrorBoundary>
            </main>

            {!isAdmin && !isPrint && (
              <div style={{ display: contentReady ? undefined : 'none' }}>
                <Footer />
              </div>
            )}
          </div>
        </ThemeProvider>
      </QueryProvider>
    </AccessibilityProvider>
  )
}
