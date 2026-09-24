import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CollectionTab } from '@/components/gallery/constants'
import { GalleryControlPanel } from './GalleryControlPanel'

const noop = () => {}

describe('GalleryControlPanel', () => {
  const baseProps = {
    collectionCounts: {
      Proposal: 12,
      'Bach+ette': 8,
      'Wedding Photos': 35,
      'Guest Photos': 5,
    } as Record<CollectionTab, number>,
    selectedCollection: 'Proposal' as CollectionTab,
    onCollectionChange: noop,
    searchQuery: '',
    onSearchChange: noop,
    viewMode: 'masonry' as const,
    onViewModeChange: noop,
    selectMode: false,
    onToggleSelectMode: noop,
    selectedPhotoIdsCount: 0,
    onSelectAllVisible: noop,
    onClearQueue: noop,
    hasActiveFilters: false,
    onClearAllFilters: noop,
  }

  it('renders one button per collection tab', () => {
    render(<GalleryControlPanel {...baseProps} />)
    expect(screen.getByRole('button', { name: /Proposal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bach\+ette/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Wedding Photos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guest Photos/i })).toBeInTheDocument()
  })

  it('reports the selected collection as pressed', () => {
    render(<GalleryControlPanel {...baseProps} selectedCollection={'Bach+ette' as CollectionTab} />)
    expect(screen.getByRole('button', { name: /Bach\+ette/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('invokes onCollectionChange when a tab is clicked', () => {
    const onCollectionChange = vi.fn()
    render(<GalleryControlPanel {...baseProps} onCollectionChange={onCollectionChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Guest Photos/i }))
    expect(onCollectionChange).toHaveBeenCalledWith('Guest Photos')
  })

  it('renders the search input with placeholder', () => {
    render(<GalleryControlPanel {...baseProps} />)
    const input = screen.getByPlaceholderText(/Search by caption/i)
    expect(input).toBeInTheDocument()
  })

  it('invokes onSearchChange when the user types', () => {
    const onSearchChange = vi.fn()
    render(<GalleryControlPanel {...baseProps} onSearchChange={onSearchChange} />)
    const input = screen.getByPlaceholderText(/Search by caption/i)
    fireEvent.change(input, { target: { value: 'kiss' } })
    expect(onSearchChange).toHaveBeenCalledWith('kiss')
  })

  it('shows all three view-mode options', () => {
    render(<GalleryControlPanel {...baseProps} />)
    expect(screen.getByRole('button', { name: /Masonry/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Grid/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Timeline/ })).toBeInTheDocument()
  })

  it('invokes onToggleSelectMode when Select is clicked', () => {
    const onToggleSelectMode = vi.fn()
    render(<GalleryControlPanel {...baseProps} onToggleSelectMode={onToggleSelectMode} />)
    fireEvent.click(screen.getByRole('button', { name: /^Select$/ }))
    expect(onToggleSelectMode).toHaveBeenCalledTimes(1)
  })

  it('shows the queue action bar only when selectMode is true', () => {
    const { rerender } = render(<GalleryControlPanel {...baseProps} selectMode={false} />)
    expect(screen.queryByText(/Select All Visible/i)).not.toBeInTheDocument()

    rerender(<GalleryControlPanel {...baseProps} selectMode={true} />)
    expect(screen.getByText(/Select All Visible/i)).toBeInTheDocument()
  })

  it('shows the active-filters strip when hasActiveFilters is true', () => {
    render(<GalleryControlPanel {...baseProps} hasActiveFilters={true} />)
    expect(screen.getByText(/Active filters/i)).toBeInTheDocument()
  })
})
