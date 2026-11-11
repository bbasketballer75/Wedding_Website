import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'
import { badgeVariants } from './badgeVariants'

describe('Badge', () => {
  it('renders a div with the frozen default variant classes', () => {
    render(<Badge>New</Badge>)

    const badge = screen.getByText('New')
    expect(badge.tagName).toBe('DIV')
    expect(badge).toHaveClass('inline-flex')
    expect(badge).toHaveClass('rounded-full')
    expect(badge).toHaveClass('uppercase')
    expect(badge).toHaveClass('tracking-wider')
    expect(badge).toHaveClass('bg-gold-100')
    expect(badge).toHaveClass('text-gold-800')
    expect(badge).toHaveClass('border-gold-200')
  })

  it('exposes every frozen variant class contract', () => {
    const { rerender } = render(<Badge>tag</Badge>)
    const badge = () => screen.getByText('tag')

    rerender(<Badge variant='secondary'>tag</Badge>)
    expect(badge()).toHaveClass('bg-cream-200')
    expect(badge()).toHaveClass('text-charcoal-700')
    expect(badge()).toHaveClass('border-cream-300')

    rerender(<Badge variant='outline'>tag</Badge>)
    expect(badge()).toHaveClass('border-gold-500/50')
    expect(badge()).toHaveClass('text-gold-700')

    rerender(<Badge variant='ghost'>tag</Badge>)
    expect(badge()).toHaveClass('text-charcoal-600')
    expect(badge()).toHaveClass('hover:bg-charcoal-100')

    rerender(<Badge variant='gold'>tag</Badge>)
    expect(badge()).toHaveClass('bg-gold-500')
    expect(badge()).toHaveClass('text-white')

    rerender(<Badge variant='rose'>tag</Badge>)
    expect(badge()).toHaveClass('bg-rose-100')
    expect(badge()).toHaveClass('text-rose-800')
    expect(badge()).toHaveClass('border-rose-200')

    rerender(<Badge variant='sage'>tag</Badge>)
    expect(badge()).toHaveClass('bg-sage-100')
    expect(badge()).toHaveClass('text-sage-800')
    expect(badge()).toHaveClass('border-sage-200')
  })

  it('merges a custom className and passes div props through', () => {
    render(
      <Badge className='extra' data-testid='badge' aria-label='status'>
        tag
      </Badge>
    )

    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('extra')
    expect(badge).toHaveAttribute('aria-label', 'status')
  })

  it('exposes the frozen variant helper for call sites that need plain strings', () => {
    expect(badgeVariants({ variant: 'gold' })).toContain('bg-gold-500')
    expect(badgeVariants()).toContain('bg-gold-100')
  })
})
