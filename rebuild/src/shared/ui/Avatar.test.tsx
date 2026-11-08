import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Avatar } from './Avatar'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Avatar', () => {
  it('renders the image with alt text and the frozen default size classes', () => {
    render(<Avatar src='/images/austin.webp' alt='Austin' />)

    const image = screen.getByRole('img', { name: 'Austin' })
    expect(image).toHaveAttribute('src', '/images/austin.webp')
    const wrapper = image.parentElement
    expect(wrapper).toHaveClass('rounded-full')
    expect(wrapper).toHaveClass('h-10')
    expect(wrapper).toHaveClass('w-10')
    expect(wrapper).toHaveClass('from-gold-100')
  })

  it('exposes every frozen size class contract', () => {
    const { rerender } = render(<Avatar src='/a.webp' alt='A' size='sm' />)
    expect(screen.getByRole('img').parentElement).toHaveClass('h-8')

    rerender(<Avatar src='/a.webp' alt='A' size='lg' />)
    expect(screen.getByRole('img').parentElement).toHaveClass('h-14')

    rerender(<Avatar src='/a.webp' alt='A' size='xl' />)
    expect(screen.getByRole('img').parentElement).toHaveClass('h-20')
  })

  it('renders initials from the fallback name when there is no src', () => {
    render(<Avatar fallback='Austin Porada' />)

    expect(screen.getByText('AP')).toBeInTheDocument()
  })

  it('renders a question mark when neither src nor fallback exists', () => {
    render(<Avatar />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('retries once with a cache-busting token, then falls back to initials', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    render(<Avatar src='/broken.webp' alt='Broken' fallback='Jordyn Porada' />)

    fireEvent.error(screen.getByRole('img'))
    const retried = screen.getByRole('img')
    expect(retried).toHaveAttribute('src', '/broken.webp?retry=1234567890')

    fireEvent.error(retried)
    expect(screen.getByText('JP')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('appends the retry token with & when the src already has a query string', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42)
    render(<Avatar src='/photo.webp?v=2' alt='Photo' />)

    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/photo.webp?v=2&retry=42')
  })

  it('resets the error/retry state when src changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(7)
    const { rerender } = render(<Avatar src='/broken.webp' alt='Broken' fallback='Austin' />)

    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/broken.webp?retry=7')

    rerender(<Avatar src='/fixed.webp' alt='Fixed' fallback='Austin' />)
    const reset = screen.getByRole('img')
    expect(reset).toHaveAttribute('src', '/fixed.webp')
    expect(reset).toHaveAttribute('alt', 'Fixed')
  })

  it('keeps the image mounted through a successful load event', () => {
    render(<Avatar src='/photo.webp' alt='Photo' fallback='Austin' />)

    fireEvent.load(screen.getByRole('img'))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/photo.webp')
  })

  it('forwards the wrapper ref and image customisation props', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Avatar
        ref={ref}
        src='/a.webp'
        alt='A'
        className='custom-wrapper'
        imgClassName='custom-image'
        imgStyle={{ objectPosition: 'center 20%' }}
      />
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveClass('custom-wrapper')
    const image = screen.getByRole('img')
    expect(image).toHaveClass('custom-image')
    expect(image).toHaveStyle({ objectPosition: 'center 20%' })
  })
})
