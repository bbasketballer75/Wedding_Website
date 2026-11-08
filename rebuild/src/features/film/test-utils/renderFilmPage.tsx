/**
 * Router test harness for the film page.
 *
 * The page reads `?moment`/`?clip`/`?resume` through TanStack Router state and
 * cleans them with replace navigations, so tests must render it under a real
 * memory-history router rather than calling it as a plain component.
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { FilmPage } from '../FilmPage'

export const FILM_TEST_PATHS = ['/gallery', '/guestbook', '/upload'] as const

export function buildFilmTestRouter(initialEntry = '/film') {
  const rootRoute = createRootRoute()

  const filmRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/film',
    component: FilmPage,
  })

  const stubRoutes = FILM_TEST_PATHS.map(path =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )

  const router = createRouter({
    routeTree: rootRoute.addChildren([filmRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })

  return router
}

export async function renderFilmPage(initialEntry = '/film') {
  const router = buildFilmTestRouter(initialEntry)
  await router.load()
  const utils = render(<RouterProvider router={router} />)
  return { router, ...utils }
}
