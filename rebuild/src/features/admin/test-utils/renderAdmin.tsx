/**
 * Router test harness for the admin feature.
 *
 * Mounts the same route shape the Lead wires in the app router:
 *   `/`            -> stub
 *   `/admin`       -> AdminApp
 *   `/admin/$`     -> AdminApp
 *   `/admin/login` -> AdminLoginPage
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { AdminApp, type AdminPageOverrides } from '../AdminApp'
import { AdminLoginPage } from '../AdminLoginPage'
import type { AdminRuntime } from '../data'
import { AdminTestShell } from './AdminTestShell'

export interface RenderAdminOptions {
  runtime: AdminRuntime
  pages?: AdminPageOverrides
  initialPath?: string
}

export function buildAdminTestRouter({
  runtime,
  pages,
  initialPath = '/admin',
}: RenderAdminOptions) {
  const rootRoute = createRootRoute({ component: AdminTestShell })

  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin',
    component: () => <AdminApp runtime={runtime} pages={pages} />,
  })
  const adminSplatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/$',
    component: () => <AdminApp runtime={runtime} pages={pages} />,
  })
  const adminLoginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/login',
    component: () => <AdminLoginPage runtime={runtime} />,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, adminRoute, adminSplatRoute, adminLoginRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  return router
}

export async function renderAdminRoute(options: RenderAdminOptions) {
  const router = buildAdminTestRouter(options)
  await router.load()
  const utils = render(<RouterProvider router={router} />)
  return { router, ...utils }
}
