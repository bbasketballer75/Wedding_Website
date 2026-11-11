/**
 * Router + browser-stub harness for Activity tests.
 *
 * The empty state renders TanStack `Link`s ("Share a Photo" / "Sign Guestbook"),
 * so the page is mounted under a real memory-history router with those
 * destinations registered. `IntersectionObserver` is stubbed with a controllable
 * fake so infinite-scroll appends can be triggered deterministically (jsdom has
 * no viewport) — no timers, no sleeps.
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

export const ACTIVITY_TEST_PATHS = ['/', '/upload', '/guestbook'] as const

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  root: Element | null = null
  rootMargin = ''
  thresholds: readonly number[] = []

  private readonly callback: IntersectionObserverCallback
  private disconnected = false

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe(): void {}
  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  trigger(isIntersecting = true): void {
    if (this.disconnected) return
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
}

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

export function resetMockIntersectionObservers(): void {
  MockIntersectionObserver.instances = []
}

/** Fires the intersection callback on every live observer (the sentinel is one). */
export function triggerIntersection(isIntersecting = true): void {
  for (const observer of [...MockIntersectionObserver.instances]) {
    observer.trigger(isIntersecting)
  }
}

export function installActivityMocks(): void {
  beforeEach(() => {
    resetMockIntersectionObservers()
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
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
    delete (window as Window & { __E2E__?: boolean }).__E2E__
  })
}

export async function renderActivityPage(
  ui: ReactNode,
  initialPath = '/activity'
): Promise<ReturnType<typeof render>> {
  const rootRoute = createRootRoute()
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/activity',
    component: () => <>{ui}</>,
  })
  const stubRoutes = ACTIVITY_TEST_PATHS.map(path =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )

  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}
