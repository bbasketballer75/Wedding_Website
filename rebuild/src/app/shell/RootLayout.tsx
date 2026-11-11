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
 * The footer stays out of the first frame and is revealed only once `main` has
 * real route content (scroll height above the 70vh Suspense fallback, so a
 * suspended route cannot trigger it). It is mounted at all times but starts
 * `display:none`, so revealing it below content never moves an element above it
 * — that is what removes the measured footer layout shift (CLS 0.64–1.0).
 *
 * A long fallback ensures the footer still appears on tiny error/unknown pages
 * or a route that never renders; the timeout is well above the slowest measured
 * first-content time so it cannot reveal early on a slow network.
 */
const CONTENT_READY_MIN_HEIGHT_PX = 700
const CONTENT_READY_FALLBACK_MS = 10_000

export function RootLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isHome = pathname === '/'
  const isPrint = pathname === '/print'
  const isAdmin = pathname === '/admin/login' || pathname.startsWith('/admin/')
  const mainRef = useRef<HTMLElement | null>(null)
  const [contentReady, setContentReady] = useState(false)

  useEffect(() => {
    // One-way latch: once revealed, the footer never hides again (hiding it
    // after paint is itself a layout shift).
    if (contentReady) return
    const element = mainRef.current
    const markReady = () => setContentReady(true)
    const timer = window.setTimeout(markReady, CONTENT_READY_FALLBACK_MS)
    if (!element) return () => window.clearTimeout(timer)

    const check = () => {
      if (element.scrollHeight > CONTENT_READY_MIN_HEIGHT_PX) markReady()
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
  }, [contentReady])

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
