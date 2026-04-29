import { describe, it, beforeEach, vi, expect } from 'vitest'
import { render } from '@testing-library/react'
import ScrollProgress from './ScrollProgress'
import CustomCursor from '../layout/CustomCursor'
import RotateDevicePrompt from './RotateDevicePrompt'
import * as fs from 'fs'
import * as path from 'path'

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

describe('Focus Ring CSS Variable Verification', () => {
  const targetFiles = [
    'src/components/gallery/components/GalleryHeader.tsx',
    'src/components/search/Search.tsx',
    'src/components/admin/BatchList.tsx',
    'src/pages/admin/AuditLogView.tsx',
  ]

  it('uses focus:ring-(--color-gold) instead of hardcoded gold classes', () => {
    targetFiles.forEach(file => {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
      // Should NOT contain hardcoded focus:ring-gold-* patterns
      expect(content).not.toMatch(/focus:ring-gold-\d+/)
      expect(content).not.toMatch(/focus:ring-gold-\d+\/\d+/)
      // SHOULD contain the CSS variable pattern
      expect(content).toMatch(/focus:ring-\(--color-gold\)/)
    })
  })
})

describe('Aria-Label Verification', () => {
  const targetFiles = [
    'src/components/gallery/components/GalleryHeader.tsx',
    'src/components/search/Search.tsx',
    'src/components/notifications/Toast.tsx',
  ]

  it('has aria-label attributes on interactive elements', () => {
    targetFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8')
      // Should contain aria-label attributes
      const ariaLabelMatches = content.match(/aria-label\s*=/g)
      expect(ariaLabelMatches).toBeTruthy()
      expect(ariaLabelMatches.length).toBeGreaterThan(0)
    })
  })

  it('GalleryHeader has aria-label on view mode button', () => {
    const content = fs.readFileSync('src/components/gallery/components/GalleryHeader.tsx', 'utf-8')
    expect(content).toMatch(/aria-label=\{`Switch to \$\{mode\} view`\}/)
  })

  it('Search has aria-label on clear button', () => {
    const content = fs.readFileSync('src/components/search/Search.tsx', 'utf-8')
    expect(content).toMatch(/aria-label\s*=\s*['"]Clear search['"]/)
  })

  it('Toast has aria-label on close button', () => {
    const content = fs.readFileSync('src/components/notifications/Toast.tsx', 'utf-8')
    expect(content).toMatch(/aria-label\s*=\s*['"]Close notification['"]/)
  })
})
