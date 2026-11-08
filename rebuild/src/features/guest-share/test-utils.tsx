/**
 * Router + motion harness for Guest Share tests (mirrors the film/guestbook
 * harnesses: the page renders TanStack `Link`s and framer-motion reveals).
 */
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

export const GUEST_SHARE_TEST_PATHS = ['/gallery'] as const

export function installGuestShareMocks(): void {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockObserver)
    vi.stubGlobal('ResizeObserver', MockObserver)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }))
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
}

export async function renderGuestSharePage(
  ui: ReactNode,
  initialPath = '/guest/valid-showcase-token'
): Promise<ReturnType<typeof render>> {
  const rootRoute = createRootRoute()
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/guest/$token',
    component: () => <>{ui}</>,
  })
  const stubRoutes = GUEST_SHARE_TEST_PATHS.map(path =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )

  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}
