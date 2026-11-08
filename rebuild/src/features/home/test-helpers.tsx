import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, vi } from 'vitest'
import { AccessibilityProvider } from '@/app/shell/AccessibilityProvider'
import { ThemeProvider } from '@/app/shell/ThemeProvider'

/**
 * Shared test harness for the Home feature.
 *
 * All Home sections use framer-motion `whileInView` (IntersectionObserver) and
 * `useScroll` target measurements (ResizeObserver), neither of which jsdom
 * implements; the stubs keep the components mounted deterministically without
 * asserting animation phase. The router harness registers every public nav
 * destination so TanStack `Link` can resolve them.
 */
class MockObserver {
  root = null
  rootMargin = ''
  thresholds: number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

export const HOME_ROUTE_PATHS = [
  '/',
  '/film',
  '/gallery',
  '/guestbook',
  '/upload',
  '/print',
] as const

export function installMotionStubs() {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockObserver)
    vi.stubGlobal('ResizeObserver', MockObserver)
    // TanStack Router's scrollRestoration calls window.scrollTo, which jsdom
    // reports as "Not implemented"; the behavior is not under test here.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })
}

export async function renderHomeUi(ui: ReactNode, initialPath = '/') {
  const rootRoute = createRootRoute({
    component: () => (
      <AccessibilityProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </AccessibilityProvider>
    ),
  })
  const childRoutes = HOME_ROUTE_PATHS.map(path =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    })
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  await router.load()
  const result = render(<RouterProvider router={router} />)
  return { router, ...result }
}
