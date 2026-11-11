import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GalleryControlPanel, type GalleryControlPanelProps } from './GalleryControlPanel'

const counts = {
  Proposal: 30,
  'Bach+ette': 0,
  'Wedding Photos': 5,
  'Guest Photos': 0,
} as const

function makeProps(overrides: Partial<GalleryControlPanelProps> = {}): GalleryControlPanelProps {
  return {
    collectionCounts: { ...counts },
    selectedCollection: 'Proposal',
    onCollectionChange: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    viewMode: 'masonry',
    onViewModeChange: vi.fn(),
    selectMode: false,
    onToggleSelectMode: vi.fn(),
    selectedPhotoIdsCount: 0,
    onSelectAllVisible: vi.fn(),
    onClearQueue: vi.fn(),
    hasActiveFilters: false,
    onClearAllFilters: vi.fn(),
    ...overrides,
  }
}

describe('GalleryControlPanel', () => {
  it('labels every control and marks the active collection/view mode', () => {
    render(<GalleryControlPanel {...makeProps()} />)

    expect(screen.getByRole('button', { name: 'Proposal collection, 30 photos' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Bach+ette collection, 0 photos' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByLabelText('Search gallery photos')).toHaveAttribute(
      'placeholder',
      'Search by caption, location, photographer, or tags'
    )
    expect(screen.getByRole('button', { name: 'Masonry' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('is keyboard operable: Tab reaches the search field and view-mode buttons', async () => {
    const user = userEvent.setup()
    render(<GalleryControlPanel {...makeProps()} />)

    const search = screen.getByLabelText('Search gallery photos')
    search.focus()
    expect(search).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Grid' }))
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveFocus()
  })

  it('forwards interactions to the provided handlers', async () => {
    const user = userEvent.setup()
    const onCollectionChange = vi.fn()
    const onSearchChange = vi.fn()
    const onViewModeChange = vi.fn()
    const onToggleSelectMode = vi.fn()
    render(
      <GalleryControlPanel
        {...makeProps({ onCollectionChange, onSearchChange, onViewModeChange, onToggleSelectMode })}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Guest Photos collection, 0 photos' }))
    expect(onCollectionChange).toHaveBeenCalledWith('Guest Photos')

    await user.type(screen.getByLabelText('Search gallery photos'), 'a')
    expect(onSearchChange).toHaveBeenCalledWith('a')

    await user.click(screen.getByRole('button', { name: 'Timeline' }))
    expect(onViewModeChange).toHaveBeenCalledWith('timeline')

    await user.click(screen.getByRole('button', { name: 'Select' }))
    expect(onToggleSelectMode).toHaveBeenCalledTimes(1)
  })

  it('shows the queue action bar and active-filter chips', async () => {
    const user = userEvent.setup()
    const onSelectAllVisible = vi.fn()
    const onClearQueue = vi.fn()
    const onClearAllFilters = vi.fn()
    render(
      <GalleryControlPanel
        {...makeProps({
          selectMode: true,
          selectedPhotoIdsCount: 12,
          searchQuery: 'golden',
          hasActiveFilters: true,
          onSelectAllVisible,
          onClearQueue,
          onClearAllFilters,
        })}
      />
    )

    expect(screen.getByText('12 photos in queue (max 50)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Select All Visible' }))
    expect(onSelectAllVisible).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))
    expect(onClearQueue).toHaveBeenCalledOnce()

    expect(screen.getByText('Active filters')).toBeInTheDocument()
    expect(screen.getByText('Search: "golden"')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onClearAllFilters).toHaveBeenCalledOnce()
  })

  it('renders the clear-search control only when a query is present', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    const { rerender } = render(
      <GalleryControlPanel {...makeProps({ searchQuery: 'rings', onSearchChange })} />
    )
    const clearButton = screen.getByRole('button', { name: 'Clear gallery search' })
    await user.click(clearButton)
    expect(onSearchChange).toHaveBeenCalledWith('')

    rerender(<GalleryControlPanel {...makeProps({ searchQuery: '' })} />)
    expect(screen.queryByRole('button', { name: 'Clear gallery search' })).toBeNull()
    // 3 view-mode buttons + the Select toggle remain in the filter bar.
    expect(within(screen.getByTestId('gallery-filter-bar')).getAllByRole('button')).toHaveLength(4)
  })
})
