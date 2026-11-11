/**
 * Shared jsdom environment stubs for the film feature tests.
 *
 * jsdom does not implement media playback, matchMedia, IntersectionObserver or
 * requestAnimationFrame; the frozen VideoPlayer/FamilyTree code touches all of
 * them. Installing these stubs once per test file keeps the specs focused on the
 * behaviour under test.
 */
import { vi } from 'vitest'

export const playMock = vi.fn(() => Promise.resolve(undefined))
export const pauseMock = vi.fn()
export const loadMock = vi.fn()

export function installMediaMocks(): void {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: playMock,
  })
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: pauseMock,
  })
  Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
    configurable: true,
    writable: true,
    value: loadMock,
  })
}

export function installMatchMediaMock(): void {
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

export function installIntersectionObserverMock(): void {
  class MockIntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  })
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  })
}

export function installAnimationFrameMock(): void {
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0),
  })
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: (handle: number) => window.clearTimeout(handle),
  })
}

/**
 * jsdom has no canvas backend; the parent-dance cards probe `getContext('2d')`
 * and must take their documented early return instead of logging
 * "Not implemented" noise into every test run.
 */
export function installCanvasMock(): void {
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  })
}

/** jsdom does not implement window.scrollTo; the router/scroll helpers probe it. */
export function installScrollToMock(): void {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => undefined,
  })
}

/** Install every browser API the film page needs. */
export function installFilmTestEnvironment(): void {
  installMediaMocks()
  installMatchMediaMock()
  installIntersectionObserverMock()
  installAnimationFrameMock()
  installCanvasMock()
  installScrollToMock()
}
