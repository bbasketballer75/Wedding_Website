import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GalleryHeader } from './GalleryHeader'

describe('GalleryHeader', () => {
  it('renders the title', () => {
    render(<GalleryHeader visibleCount={42} />)
    expect(screen.getByText(/Browse the archive/i)).toBeInTheDocument()
  })

  it('renders the visible photo count', () => {
    render(<GalleryHeader visibleCount={42} />)
    expect(screen.getByText(/42 visible/i)).toBeInTheDocument()
  })

  it('handles singular photo count correctly', () => {
    render(<GalleryHeader visibleCount={1} />)
    expect(screen.getByText(/1 visible/i)).toBeInTheDocument()
  })

  it('handles zero photo count correctly', () => {
    render(<GalleryHeader visibleCount={0} />)
    expect(screen.getByText(/0 visible/i)).toBeInTheDocument()
  })
})
