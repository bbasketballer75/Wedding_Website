/* eslint-disable no-unused-vars */
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

globalThis.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback
    this.options = options
  }
  observe() {}
  unobserve() {}
  disconnect() {}
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
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <div {...props}>{children}</div>,
    nav: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <nav {...props}>{children}</nav>,
    span: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <span {...props}>{children}</span>,
    button: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <button {...props}>{children}</button>,
    svg: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <svg {...props}>{children}</svg>,
    path: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <path {...props}>{children}</path>,
    circle: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <circle {...props}>{children}</circle>,
    line: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <line {...props}>{children}</line>,
    g: ({
      children,
      initial,
      animate,
      exit,
      variants,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      ...props
    }) => <g {...props}>{children}</g>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useSpring: () => ({ get: () => 0 }),
  useInView: () => true,
}))
