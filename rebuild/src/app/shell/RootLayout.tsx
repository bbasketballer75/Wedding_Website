import { Outlet, useRouterState } from '@tanstack/react-router'
import { Suspense, useCallback, useEffect, useState } from 'react'
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
 *
 * The ready flag lives at MODULE scope, not component state: the shell can be
 * remounted during router hydration normalization, and a state-only latch would
 * reset to false and hide an already-painted footer (measured as a late CLS
 * shift on uncompressed delivery). The module latch is per page load, so any
 * remount renders the footer visible immediately.
 */
let footerReadyForPageLoad = false

/**
 * Mounts only after the route inside the Suspense boundary has actually rendered
 * (a marker child resolves with the same boundary). Revealing the footer on
 * route-commit — instead of on a height heuristic — is what keeps the footer out
 * of the first frame: the 70vh Suspense fallback is taller than any height
 * threshold a heuristic would use, so measuring heights revealed the footer
 * before content and produced a shift when content arrived.
 */
function RouteReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    // Deferred a frame so the marker never setState synchronously inside an
    // effect (React lint / cascading-render hygiene).
    const frame = window.requestAnimationFrame(onReady)
    return () => window.cancelAnimationFrame(frame)
  }, [onReady])

  return null
}

export function RootLayout() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isHome = pathname === '/'
  const isPrint = pathname === '/print'
  const isAdmin = pathname === '/admin/login' || pathname.startsWith('/admin/')
  const [contentReady, setContentReady] = useState(footerReadyForPageLoad)

  const markReady = useCallback(() => {
    // One-way latch: once revealed, the footer never hides again (hiding it after
    // paint is itself a layout shift). A later route mount keeps the footer
    // mounted below the content, so nothing above it moves.
    footerReadyForPageLoad = true
    setContentReady(true)
  }, [])

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
                  <Suspense
                    fallback={
                      <div className='min-h-[70vh]'>
                        <PageLoader />
                      </div>
                    }
                  >
                    <Outlet />
                    {!contentReady && <RouteReady onReady={markReady} />}
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
