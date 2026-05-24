import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import OfflineIndicator from '@/components/ui/OfflineIndicator'
import { PageLoader } from '@/components/ui/PageLoader'
import { SkipLink } from '@/components/accessibility/SkipLink'
import { KeyboardShortcutsModal } from '@/components/accessibility/KeyboardShortcutsModal'
import { AccessibilityProvider, useAccessibility } from '@/accessibility/AccessibilityProvider'
import { trackPageView } from '@/services/AnalyticsService'
import { RouteErrorBoundary } from '@/components/error/ErrorBoundary'

// Lazy load pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Film = lazy(() => import('@/pages/Film'))
const Gallery = lazy(() => import('@/pages/Gallery'))
const Upload = lazy(() => import('@/pages/Upload'))
const Guestbook = lazy(() => import('@/pages/Guestbook'))
const Admin = lazy(() => import('@/pages/Admin'))
const AdminLogin = lazy(() => import('@/pages/AdminLogin'))
const People = lazy(() => import('@/pages/People'))
const Activity = lazy(() => import('@/pages/Activity'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const GuestShare = lazy(() => import('@/pages/GuestShare'))
const Print = lazy(() => import('@/pages/Print'))

// Page transition wrapper
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// Wrapper component that combines Suspense with PageTransition
function LazyPage({ children, title }: { children: React.ReactNode; title?: string }) {
  const { announce } = useAccessibility()

  useEffect(() => {
    if (!title) {
      return
    }

    announce(`Navigated to ${title}`, 'polite')
  }, [announce, title])

  return (
    <Suspense fallback={<PageLoader />}>
      <PageTransition>{children}</PageTransition>
    </Suspense>
  )
}

function AppContent() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isAdminRoute =
    location.pathname === '/admin/login' || location.pathname.startsWith('/admin/')

  // Page titles for screen reader announcements
  const getPageTitle = (path: string): string | undefined => {
    if (path.startsWith('/guest/')) {
      return 'Guest Album'
    }
    const titles: Record<string, string> = {
      '/': 'Home',
      '/film': 'Wedding Film',
      '/gallery': 'Photo Gallery',
      '/upload': 'Share Memories',
      '/guestbook': 'Guestbook',
      '/guest-photos': 'Guest Memories',
      '/people': 'People',
      '/activity': 'Activity',
      '/admin/login': 'Admin Login',
      '/admin': 'Admin Dashboard',
      '/print': 'Memory Book',
    }
    return titles[path]
  }

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`
    trackPageView(path, getPageTitle(location.pathname))
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    if (location.hash) {
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, location.hash])

  return (
    <div className='min-h-screen bg-cream-50'>
      {/* Skip Link for keyboard navigation */}
      <SkipLink />
      <KeyboardShortcutsModal />

      {/* Header with navigation role */}
      {!isHome && !isAdminRoute && <Header />}
      {!isAdminRoute && <OfflineIndicator />}

      {/* Main content area with proper ARIA landmarks */}
      <main
        id='main-content'
        role='main'
        aria-label={getPageTitle(location.pathname) || 'Page content'}
        tabIndex={-1}
        className='outline-none'
      >
        {/* Outer boundary: last-resort catch-all */}
        <RouteErrorBoundary>
          <AnimatePresence mode='wait'>
            <Routes location={location} key={location.pathname}>
              <Route
                path='/'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Home'>
                      <Home />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/film'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Wedding Film'>
                      <Film />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/gallery'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Photo Gallery'>
                      <Gallery />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/upload'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Share Memories'>
                      <Upload />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/guestbook'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Guestbook'>
                      <Guestbook />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/guest-photos'
                element={<Navigate to='/gallery?collection=Guest+Photos' replace />}
              />
              <Route
                path='/people'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='People'>
                      <People />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/activity'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Activity'>
                      <Activity />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/admin/login'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Admin Login'>
                      <AdminLogin />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/admin/*'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Admin Dashboard'>
                      <Admin />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/guest/:token'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Guest Album'>
                      <GuestShare />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='/print'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Memory Book'>
                      <Print />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path='*'
                element={
                  <RouteErrorBoundary>
                    <LazyPage title='Page Not Found'>
                      <NotFound />
                    </LazyPage>
                  </RouteErrorBoundary>
                }
              />
            </Routes>
          </AnimatePresence>
        </RouteErrorBoundary>
      </main>

      {/* Footer with contentinfo role */}
      {!isAdminRoute && <Footer />}
    </div>
  )
}

function App() {
  return (
    <AccessibilityProvider>
      <AppContent />
    </AccessibilityProvider>
  )
}

export default App
