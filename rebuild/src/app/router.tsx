import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { lazy } from 'react'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { RootLayout } from './shell/RootLayout'

/**
 * Route-level code splitting keeps the initial payload at shell size
 * (QUALITY_BAR: initial JS ≤180 KB gz). Only the shell and 404 are eager; every
 * feature page AND its data adapter/service wiring lives in a lazy chunk.
 *
 * `app/route-preload.ts` awaits the initial route's module before the first
 * render so a tall page cannot replace the shell fallback after paint (that was
 * the measured CLS 0.64–1.03 footer-push defect).
 */
const HomePage = lazy(() =>
  import('@/features/home').then(module => ({ default: module.HomePage }))
)
const FilmPage = lazy(() =>
  import('@/features/film').then(module => ({ default: module.FilmPage }))
)
const GalleryRoute = lazy(() =>
  import('./routes/gallery-route').then(module => ({ default: module.GalleryRoute }))
)
const UploadPage = lazy(() =>
  import('@/features/upload/UploadPage').then(module => ({ default: module.UploadPage }))
)
const GuestbookRoute = lazy(() =>
  import('./routes/guestbook-route').then(module => ({ default: module.GuestbookRoute }))
)
const GuestPhotosPage = lazy(() =>
  import('@/features/guest-photos').then(module => ({ default: module.GuestPhotosPage }))
)
const ActivityRoute = lazy(() =>
  import('./routes/activity-route').then(module => ({ default: module.ActivityRoute }))
)
const AdminLoginPageRoute = lazy(() =>
  import('./routes/admin-routes').then(module => ({ default: module.AdminLoginPageRoute }))
)
const AdminPageRoute = lazy(() =>
  import('./routes/admin-routes').then(module => ({ default: module.AdminPageRoute }))
)
const GuestSharePage = lazy(() =>
  import('@/features/guest-share').then(module => ({ default: module.GuestSharePage }))
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
  component: function GalleryRouteComponent() {
    const search = galleryRoute.useSearch()
    return <GalleryRoute rawSearch={search} />
  },
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: UploadPage,
})

const guestbookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guestbook',
  component: GuestbookRoute,
})

const guestPhotosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guest-photos',
  component: GuestPhotosPage,
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: ActivityRoute,
})

const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: AdminLoginPageRoute,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPageRoute,
})

const adminSplatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/$',
  component: AdminPageRoute,
})

const guestTokenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guest/$token',
  component: function GuestTokenRoute() {
    const { token } = guestTokenRoute.useParams()
    return <GuestSharePage token={token} />
  },
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
