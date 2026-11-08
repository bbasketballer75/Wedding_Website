import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { RootLayout } from './shell/RootLayout'

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
  component: () => <PlaceholderPage title='Home' />,
})

const filmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/film',
  component: () => <PlaceholderPage title='Wedding Film' />,
})

const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: () => <PlaceholderPage title='Photo Gallery' />,
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: () => <PlaceholderPage title='Share Memories' />,
})

const guestbookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guestbook',
  component: () => <PlaceholderPage title='Guestbook' />,
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
  component: () => <PlaceholderPage title='Memory Book' />,
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
