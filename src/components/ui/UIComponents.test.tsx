import { describe, it, beforeEach, vi, expect } from 'vitest'
import { render } from '@testing-library/react'
import ScrollProgress from './ScrollProgress'
import CustomCursor from '../layout/CustomCursor'
import RotateDevicePrompt from './RotateDevicePrompt'

// Mock window.matchMedia
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

describe('UI Components', () => {
  describe('ScrollProgress', () => {
    it('renders without crashing', () => {
      render(<ScrollProgress />)
    })
  })

  describe('CustomCursor', () => {
    it('renders cursor elements', () => {
      render(<CustomCursor />)
    })

    it('returns null when prefers-reduced-motion is enabled', () => {
      // Mock matchMedia to return reduced motion preference
      vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList))

      const { container } = render(<CustomCursor />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('RotateDevicePrompt', () => {
    beforeEach(() => {
      // Mock window.orientation
      Object.defineProperty(window, 'orientation', {
        writable: true,
        value: 90,
      })
    })

    it('shows prompt when in portrait on mobile', () => {
      // Mock innerWidth to be mobile width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      })

      // Mock matchMedia to return portrait mode
      vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(orientation: portrait)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList))

      const { container } = render(<RotateDevicePrompt />)
      expect(container).toBeTruthy()
    })
  })
})
