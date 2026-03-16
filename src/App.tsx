import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PageLoader } from '@/components/ui/PageLoader'
import { SkipLink } from '@/components/accessibility/SkipLink'
import { AccessibilityProvider, useAccessibility } from '@/accessibility/AccessibilityProvider'
import { trackPageView } from '@/services/AnalyticsService'

// Lazy load pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Film = lazy(() => import('@/pages/Film'))
const Gallery = lazy(() => import('@/pages/Gallery'))
const Upload = lazy(() => import('@/pages/Upload'))
const Guestbook = lazy(() => import('@/pages/Guestbook'))
const Admin = lazy(() => import('@/pages/Admin'))
const AdminLogin = lazy(() => import('@/pages/AdminLogin'))
const NotFound = lazy(() => import('@/pages/NotFound'))

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
  const isAdminRoute = location.pathname === '/admin/login' || location.pathname.startsWith('/admin/')

  // Page titles for screen reader announcements
  const getPageTitle = (path: string): string | undefined => {
    const titles: Record<string, string> = {
      '/': 'Home',
      '/film': 'Wedding Film',
      '/gallery': 'Photo Gallery',
      '/upload': 'Share Memories',
      '/guestbook': 'Guestbook',
      '/admin/login': 'Admin Login',
      '/admin': 'Admin Dashboard',
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
    <div className="min-h-screen bg-cream-50">
      {/* Skip Link for keyboard navigation */}
      <SkipLink />
      
      {/* Header with navigation role */}
      {!isHome && !isAdminRoute && (
        <Header />
      )}
      
      {/* Main content area with proper ARIA landmarks */}
      <main
        id="main-content"
        role="main"
        aria-label={getPageTitle(location.pathname) || 'Page content'}
        tabIndex={-1}
        className="outline-none"
      >
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route 
              path="/" 
              element={
                <LazyPage title="Home">
                  <Home />
                </LazyPage>
              } 
            />
            <Route 
              path="/film" 
              element={
                <LazyPage title="Wedding Film">
                  <Film />
                </LazyPage>
              } 
            />
            <Route 
              path="/gallery" 
              element={
                <LazyPage title="Photo Gallery">
                  <Gallery />
                </LazyPage>
              } 
            />
            <Route 
              path="/upload" 
              element={
                <LazyPage title="Share Memories">
                  <Upload />
                </LazyPage>
              } 
            />
            <Route 
              path="/guestbook" 
              element={
                <LazyPage title="Guestbook">
                  <Guestbook />
                </LazyPage>
              } 
            />
            <Route 
              path="/admin/login"
              element={
                <LazyPage title="Admin Login">
                  <AdminLogin />
                </LazyPage>
              }
            />
            <Route 
              path="/admin/*" 
              element={
                <LazyPage title="Admin Dashboard">
                  <Admin />
                </LazyPage>
              } 
            />
            <Route 
              path="*" 
              element={
                <LazyPage title="Page Not Found">
                  <NotFound />
                </LazyPage>
              } 
            />
          </Routes>
        </AnimatePresence>
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
