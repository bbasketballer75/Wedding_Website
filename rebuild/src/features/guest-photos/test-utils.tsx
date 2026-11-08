/**
 * Router + motion harness for Guest Photos tests.
 *
 * The page renders TanStack `Link`s ("Share yours"), so tests mount it under a
 * real memory-history router with every destination registered. framer-motion's
 * `whileInView`/`useReducedMotion` need `IntersectionObserver`/`matchMedia`,
 * which jsdom does not implement; the stubs keep mounts deterministic (the
 * animation phase is not under test — same approach as `features/home`).
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

export const GUEST_PHOTOS_TEST_PATHS = ['/', '/upload'] as const

export function installGuestPhotosMocks(): void {
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

export async function renderGuestPhotosPage(
  ui: ReactNode,
  initialPath = '/guest-photos'
): Promise<ReturnType<typeof render>> {
  const rootRoute = createRootRoute()
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/guest-photos',
    component: () => <>{ui}</>,
  })
  const stubRoutes = GUEST_PHOTOS_TEST_PATHS.map(path =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )

  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}
