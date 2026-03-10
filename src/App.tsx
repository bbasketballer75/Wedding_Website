import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PageLoader } from '@/components/ui/PageLoader'
import { SkipLink } from '@/components/accessibility/SkipLink'
import { AccessibilityProvider, useAccessibility } from '@/accessibility/AccessibilityProvider'

// Lazy load pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Film = lazy(() => import('@/pages/Film'))
const Gallery = lazy(() => import('@/pages/Gallery'))
const Upload = lazy(() => import('@/pages/Upload'))
const Guestbook = lazy(() => import('@/pages/Guestbook'))
const Admin = lazy(() => import('@/pages/Admin'))
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
  
  // Announce page change to screen readers
  if (title) {
    announce(`Navigated to ${title}`, 'polite')
  }
  
  return (
    <Suspense fallback={<PageLoader />}>
      <PageTransition>{children}</PageTransition>
    </Suspense>
  )
}

function AppContent() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  // Page titles for screen reader announcements
  const getPageTitle = (path: string): string | undefined => {
    const titles: Record<string, string> = {
      '/': 'Home',
      '/film': 'Wedding Film',
      '/gallery': 'Photo Gallery',
      '/upload': 'Upload Photos',
      '/guestbook': 'Guestbook',
    }
    return titles[path]
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Skip Link for keyboard navigation */}
      <SkipLink />
      
      {/* Header with navigation role */}
      {!isHome && (
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
                <LazyPage title="Upload Photos">
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
      <Footer />
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
