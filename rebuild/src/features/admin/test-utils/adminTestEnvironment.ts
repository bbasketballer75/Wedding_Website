/**
 * Shared jsdom stubs for admin tests.
 *
 * jsdom lacks matchMedia (ThemeToggle / useReducedMotion), IntersectionObserver /
 * ResizeObserver (framer-motion) and window.scrollTo (TanStack scroll
 * restoration), all of which the admin shell touches on mount.
 */
import { vi } from 'vitest'

class MockObserver {
  root = null
  rootMargin = ''
  thresholds: number[] = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): MockObserverEntry[] {
    return []
  }
}

interface MockObserverEntry {
  target: Element
}

export function installAdminTestEnvironment(): void {
  vi.stubGlobal('IntersectionObserver', MockObserver)
  vi.stubGlobal('ResizeObserver', MockObserver)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}
