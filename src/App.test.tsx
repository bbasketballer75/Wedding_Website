import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// Mock expensive/browser-only modules
vi.mock('leaflet', () => ({}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => <div>TileLayer</div>,
  Marker: () => <div>Marker</div>,
  Popup: () => <div>Popup</div>,
  useMap: () => ({}),
}))

vi.mock('@/components/ui/DynamicTitle', () => ({
  default: () => null,
}))
vi.mock('@/pages/Home', () => ({
  default: () => <div>Mocked Home Page</div>,
}))
vi.mock('@/components/Layout', () => ({
  default: ({ children }: any) => <div>Mocked Layout {children}</div>,
}))
vi.mock('@/components/ui/RotateDevicePrompt', () => ({ default: () => null }))
vi.mock('@/components/ui/ScrollProgress', () => ({ default: () => null }))
vi.mock('@/components/DebugPanel', () => ({ default: () => null }))
vi.mock('@/components/ScrollToTop', () => ({ default: () => null }))
vi.mock('lenis', () => {
  return {
    default: class MockLenis {
      raf() {}
      destroy() {}
      on() {}
    },
  }
})

describe('App Component', () => {
  it('renders without crashing', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    // Check for a known text in the app header or footer
    await waitFor(() => {
      expect(screen.getByText(/Mocked Home Page/i)).toBeInTheDocument()
    })
  })
})
