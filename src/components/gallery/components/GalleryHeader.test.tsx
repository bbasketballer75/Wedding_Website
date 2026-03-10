import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GalleryHeader from './GalleryHeader'

describe('GalleryHeader', () => {
  const defaultProps = {
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filter: 'all',
    setFilter: vi.fn(),
    sortBy: 'date' as const,
    setSortBy: vi.fn(),
    viewMode: 'masonry' as const,
    setViewMode: vi.fn(),
    allTags: ['tag1', 'tag2'],
    enableAI: true,
    isLoading: false,
    onUploadClick: vi.fn(),
  }

  it('renders search input', () => {
    render(<GalleryHeader {...defaultProps} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('renders filter select', () => {
    render(<GalleryHeader {...defaultProps} />)
    expect(screen.getByLabelText(/filter photos/i)).toBeInTheDocument()
  })

  it('renders sort select', () => {
    render(<GalleryHeader {...defaultProps} />)
    expect(screen.getByLabelText(/sort photos/i)).toBeInTheDocument()
  })

  it('renders view mode buttons', () => {
    render(<GalleryHeader {...defaultProps} />)
    expect(screen.getByLabelText(/switch to masonry view/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/switch to grid view/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/switch to carousel view/i)).toBeInTheDocument()
  })

  it('renders upload button', () => {
    render(<GalleryHeader {...defaultProps} />)
    expect(screen.getByText(/upload/i)).toBeInTheDocument()
  })

  it('calls setSearchQuery on input change', () => {
    render(<GalleryHeader {...defaultProps} />)
    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'test' } })
    expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('test')
  })

  it('calls onUploadClick when upload button is clicked', () => {
    render(<GalleryHeader {...defaultProps} />)
    fireEvent.click(screen.getByText(/upload/i))
    expect(defaultProps.onUploadClick).toHaveBeenCalled()
  })
})
