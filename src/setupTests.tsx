import '@testing-library/dom'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.IntersectionObserver = class IntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly thresholds: readonly number[] = []

  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// Silence JSDOM warnings
Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => {},
})
Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
})

// Global Framer Motion Mock
vi.mock('framer-motion', () => {
  const React = require('react')
  const MotionComponent = ({ children, ...props }: any) =>
    React.createElement('div', props, children)
  const MotionSpan = ({ children, ...props }: any) => React.createElement('span', props, children)
  const MotionButton = ({ children, ...props }: any) =>
    React.createElement('button', props, children)
  const MotionNav = ({ children, ...props }: any) => React.createElement('nav', props, children)
  const MotionSVG = ({ children, ...props }: any) => React.createElement('svg', props, children)
  const MotionPath = ({ children, ...props }: any) => React.createElement('path', props, children)
  const MotionCircle = ({ children, ...props }: any) =>
    React.createElement('circle', props, children)
  const MotionLine = ({ children, ...props }: any) => React.createElement('line', props, children)
  const MotionArticle = ({ children, ...props }: any) =>
    React.createElement('article', props, children)
  const MotionSection = ({ children, ...props }: any) =>
    React.createElement('section', props, children)
  const MotionHeader = ({ children, ...props }: any) =>
    React.createElement('header', props, children)
  const MotionG = ({ children, ...props }: any) => React.createElement('g', props, children)

  return {
    motion: {
      div: MotionComponent,
      nav: MotionNav,
      span: MotionSpan,
      button: MotionButton,
      article: MotionArticle,
      section: MotionSection,
      header: MotionHeader,
      svg: MotionSVG,
      path: MotionPath,
      circle: MotionCircle,
      line: MotionLine,
      g: MotionG,
    },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useSpring: () => ({ get: () => 0 }),
    useInView: () => true,
  }
})
