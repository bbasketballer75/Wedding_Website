import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CardSkeleton,
  GallerySkeleton,
  ListSkeleton,
  PhotoSkeleton,
  Skeleton,
  TextSkeleton,
} from './Skeleton'

describe('Skeleton', () => {
  it('renders the frozen pulse classes and merges a custom className', () => {
    render(<Skeleton data-testid='skeleton' className='h-6 w-32' />)

    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveClass('animate-pulse')
    expect(skeleton).toHaveClass('rounded-lg')
    expect(skeleton).toHaveClass('bg-gold-100/50')
    expect(skeleton).toHaveClass('h-6')
    expect(skeleton).toHaveClass('w-32')
  })

  it('renders the frozen photo skeleton layout', () => {
    const { container } = render(<PhotoSkeleton className='extra' />)

    expect(container.firstElementChild).toHaveClass('space-y-2')
    expect(container.firstElementChild).toHaveClass('extra')
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  it('renders the frozen gallery grid with the default and custom count', () => {
    const { container, rerender } = render(<GallerySkeleton />)

    const grid = container.firstElementChild
    expect(grid).toHaveClass('grid')
    expect(grid).toHaveClass('grid-cols-2')
    expect(grid?.children).toHaveLength(8)

    rerender(<GallerySkeleton count={2} />)
    expect(container.firstElementChild?.children).toHaveLength(2)
  })

  it('renders deterministic text line widths', () => {
    const { container } = render(<TextSkeleton />)

    const lines = container.querySelectorAll('.animate-pulse')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toHaveStyle({ width: '85%' })
    expect(lines[1]).toHaveStyle({ width: '72%' })
    expect(lines[2]).toHaveStyle({ width: '90%' })

    const { container: single } = render(<TextSkeleton lines={1} />)
    expect(single.querySelectorAll('.animate-pulse')).toHaveLength(1)
  })

  it('renders the frozen card skeleton composition', () => {
    const { container } = render(<CardSkeleton />)

    expect(container.firstElementChild).toHaveClass('rounded-2xl')
    expect(container.firstElementChild).toHaveClass('bg-cream-100')
    // 2 direct skeletons + 3 text lines.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
  })

  it('renders the frozen list skeleton rows with default and custom count', () => {
    const { container, rerender } = render(<ListSkeleton />)

    expect(container.firstElementChild).toHaveClass('space-y-3')
    // 3 rows × (avatar + title + subtitle).
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(9)

    rerender(<ListSkeleton count={1} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })
})
