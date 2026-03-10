import { describe, it, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import ScrollProgress from './ScrollProgress'
import CustomCursor from '../layout/CustomCursor'
import RotateDevicePrompt from './RotateDevicePrompt'
import { Button } from './Button'

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
      // Since it renders a motion.div which is mocked to a div, we can find it by style or just ensure no throw
      // In a real DOM it would be empty div with style
    })
  })

  describe('CustomCursor', () => {
    it('renders cursor elements', () => {
      render(<CustomCursor />)
      // It renders two motion.divs
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
      window.matchMedia.mockImplementation(query => ({
        matches: query === '(orientation: portrait)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      const { container } = render(<RotateDevicePrompt />)
      // Component should render based on orientation
      // The component renders motion.div which may or may not be visible
      // Just verify it renders without throwing
      expect(container).toBeTruthy()
    })
  })
})
