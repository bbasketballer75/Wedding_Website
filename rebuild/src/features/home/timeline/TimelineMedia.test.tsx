import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installMotionStubs } from '../test-helpers'
import { ImageCarousel } from './ImageCarousel'
import { LocationMap } from './LocationMap'
import { TimelineIcon } from './TimelineIcon'

installMotionStubs()

const images = ['/media/one.webp', '/media/two.webp', '/media/three.webp']

afterEach(() => {
  vi.useRealTimers()
})

describe('ImageCarousel', () => {
  it('renders nothing without images', () => {
    const { container } = render(<ImageCarousel images={[]} alt='Empty' />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the frozen counter, slides and navigation controls', () => {
    const { container } = render(<ImageCarousel images={images} alt='Engagement' />)

    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getAllByAltText(/Engagement - \d/)).toHaveLength(3)
    // Preload has not resolved in jsdom, so the loading overlay is visible.
    expect(container.querySelector('.border-t-gold-600')).not.toBeNull()
  })

  it('moves through slides with the arrows and dots', async () => {
    const user = userEvent.setup()
    render(<ImageCarousel images={images} alt='Engagement' />)

    await user.click(screen.getByRole('button', { name: 'Next carousel image' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous carousel image' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to image 3' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('auto-advances on the frozen interval', () => {
    vi.useFakeTimers()
    render(<ImageCarousel images={images} alt='Engagement' />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('opens the fullscreen viewer and closes it with the button', async () => {
    const user = userEvent.setup()
    render(<ImageCarousel images={images} alt='Engagement' />)

    await user.click(screen.getByRole('button', { name: 'Open Engagement image gallery' }))
    expect(screen.getByRole('button', { name: 'Close image viewer' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close image gallery' }))
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument()
  })

  it('supports the frozen Escape / arrow keyboard navigation in the viewer', async () => {
    const user = userEvent.setup()
    render(<ImageCarousel images={images} alt='Engagement' />)

    await user.click(screen.getByRole('button', { name: 'Open Engagement image gallery' }))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getAllByText('2 / 3').length).toBeGreaterThanOrEqual(1)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getAllByText('1 / 3').length).toBeGreaterThanOrEqual(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument()
  })

  it('navigates and jumps inside the viewer via thumbnails', async () => {
    const user = userEvent.setup()
    render(<ImageCarousel images={images} alt='Engagement' />)

    await user.click(screen.getByRole('button', { name: 'Open Engagement image gallery' }))
    const viewer = screen.getByRole('button', { name: 'Close image viewer' })

    // Thumbnail strip lives outside the click-swallowing image area.
    const thumbnails = viewer.querySelectorAll('button[aria-label^="View image"]')
    expect(thumbnails.length).toBeGreaterThanOrEqual(3)
    await user.click(screen.getByRole('button', { name: 'View image 3' }))
    expect(screen.getAllByText('3 / 3').length).toBeGreaterThanOrEqual(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Close image viewer' })).not.toBeInTheDocument()
  })
})

describe('TimelineIcon', () => {
  it('renders every frozen icon variant label', () => {
    const { rerender } = render(<TimelineIcon type='meeting' />)
    expect(screen.getByText('Where it all began')).toBeInTheDocument()
    expect(screen.getByText('Where it all began')).toHaveClass('text-charcoal-600')

    rerender(<TimelineIcon type='first-date' />)
    expect(screen.getByText('Love sparked')).toBeInTheDocument()
    expect(screen.getByText('✨')).toBeInTheDocument()
    expect(screen.getByText('💕')).toBeInTheDocument()

    rerender(<TimelineIcon type='wedding' />)
    expect(screen.getByText('Forever begins')).toBeInTheDocument()

    rerender(<TimelineIcon type='generic' />)
    expect(screen.getByText('Special moment')).toBeInTheDocument()
  })

  it('renders the frozen background/class contract and merges className', () => {
    const { container } = render(<TimelineIcon type='meeting' className='custom' />)
    expect(container.firstElementChild).toHaveClass('h-36')
    expect(container.firstElementChild).toHaveClass('custom')
    expect(container.querySelector('.bg-blue-100')).not.toBeNull()
  })
})

describe('LocationMap', () => {
  it('renders the frozen town variant with pin and label', () => {
    render(<LocationMap location='Ligonier, PA' type='town' />)

    expect(screen.getByText('Ligonier, PA')).toHaveClass('text-charcoal-700')
    expect(screen.getByText('Ligonier, PA')).toHaveClass('whitespace-nowrap')
  })

  it('renders the frozen home variant', () => {
    const { container } = render(
      <LocationMap location='Our First Home' type='home' className='x' />
    )

    expect(screen.getByText('Our First Home')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('h-36')
    expect(container.querySelector('.bg-gold-500')).not.toBeNull()
  })
})
