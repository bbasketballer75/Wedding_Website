import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageLoader } from './PageLoader'

describe('PageLoader', () => {
  it('renders the frozen accessible loading status', () => {
    render(<PageLoader />)

    const status = screen.getByRole('status', { name: 'Loading page' })
    expect(status).toHaveClass('grid')
    expect(status).toHaveClass('max-w-6xl')
    expect(screen.getByText('Loading...')).toHaveClass('sr-only')
  })

  it('renders the frozen skeleton panel composition on the theme canvas', () => {
    const { container } = render(<PageLoader />)

    expect(container.querySelector('.theme-canvas')).not.toBeNull()
    expect(container.querySelector('.theme-panel')).not.toBeNull()
    expect(container.querySelectorAll('.theme-skeleton')).toHaveLength(8)
  })
})
