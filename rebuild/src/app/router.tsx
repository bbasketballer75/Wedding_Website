import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { lazy } from 'react'
import { GuestbookPage } from '@/features/guestbook/GuestbookPage'
import { validateGallerySearch } from '@/features/gallery/data'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { guestbookApi } from './routes/guestbook-api'
import { RootLayout } from './shell/RootLayout'

/**
 * Route-level code splitting keeps the initial payload small (QUALITY_BAR:
 * initial JS ≤180 KB gz). Each feature chunk loads on navigation; the shell and
 * 404 stay eager so the first paint never waits on data.
 */
const HomePage = lazy(() => import('@/features/home').then(module => ({ default: module.HomePage })))
const FilmPage = lazy(() => import('@/features/film').then(module => ({ default: module.FilmPage })))
const GalleryPage = lazy(() =>
  import('@/features/gallery/GalleryPage').then(module => ({ default: module.GalleryPage }))
)
const PrintPage = lazy(() =>
  import('@/features/print/PrintPage').then(module => ({ default: module.PrintPage }))
)

/**
 * Route tree. Every frozen route exists so deep links and chrome rules are
 * exercised from Wave 1; each placeholder is replaced by its feature wave.
 * The 404 is the router's not-found component (e.g. `/people` resolves here,
 * matching the frozen app's retired route).
 */
const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const filmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/film',
  component: FilmPage,
})

const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  validateSearch: validateGallerySearch,
  component: function GalleryRoute() {
    const search = galleryRoute.useSearch()
    return <GalleryPage search={search} />
  },
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: () => <PlaceholderPage title='Share Memories' />,
})

const guestbookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guestbook',
  component: function GuestbookRoute() {
    // The page reads `?message=`/`?q=` from the URL on mount (the frozen page did
    // the same). Keeping the route search schema empty means other pages' links to
    // `/guestbook` stay plain hrefs, exactly like the oracle.
    return <GuestbookPage api={guestbookApi} />
  },
})

const guestPhotosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guest-photos',
  component: () => <PlaceholderPage title='Guest Memories' />,
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: () => <PlaceholderPage title='Activity' />,
})

const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: () => <PlaceholderPage title='Admin Login' />,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => <PlaceholderPage title='Admin Dashboard' />,
})

const adminSplatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/$',
  component: () => <PlaceholderPage title='Admin Dashboard' />,
})

const guestTokenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guest/$token',
  component: () => <PlaceholderPage title='Guest Album' />,
})

const printRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/print',
  component: PrintPage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  filmRoute,
  galleryRoute,
  uploadRoute,
  guestbookRoute,
  guestPhotosRoute,
  activityRoute,
  adminLoginRoute,
  adminRoute,
  adminSplatRoute,
  guestTokenRoute,
  printRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
