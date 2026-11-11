import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  GlassCard,
  MemoryCard,
  PolaroidCard,
} from './Card'

describe('Card', () => {
  it('renders the frozen base card classes', () => {
    render(<Card data-testid='card'>Body</Card>)

    const card = screen.getByTestId('card')
    expect(card).toHaveClass('rounded-2xl')
    expect(card).toHaveClass('bg-cream-100')
    expect(card).toHaveClass('text-charcoal-900')
    expect(card).toHaveClass('shadow-soft')
    expect(card).toHaveClass('transition-all')
  })

  it('marks an interactive card as a focusable button role', () => {
    render(
      <Card interactive data-testid='card'>
        Body
      </Card>
    )

    const card = screen.getByRole('button')
    expect(card).toHaveClass('cursor-pointer')
    expect(card).toHaveClass('hover:-translate-y-0.5')
    expect(card).toHaveClass('focus-visible:ring-gold-500')
    expect(card).toHaveAttribute('tabindex', '0')
  })

  it('does not assign button semantics when not interactive', () => {
    render(<Card data-testid='card'>Body</Card>)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('card')).not.toHaveAttribute('role')
    expect(screen.getByTestId('card')).not.toHaveAttribute('tabindex')
  })

  it('merges a custom className and forwards the ref', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Card ref={ref} className='custom'>
        Body
      </Card>
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(screen.getByText('Body')).toHaveClass('custom')
  })
})

describe('GlassCard', () => {
  it('renders the frozen frosted classes and interactive state', () => {
    const { rerender } = render(
      <GlassCard data-testid='glass' interactive>
        Frosted
      </GlassCard>
    )

    const glass = screen.getByTestId('glass')
    expect(glass).toHaveClass('bg-white/70')
    expect(glass).toHaveClass('backdrop-blur-xl')
    expect(glass).toHaveClass('border-white/50')
    expect(glass).toHaveClass('shadow-glass')
    expect(glass).toHaveAttribute('role', 'button')

    rerender(<GlassCard data-testid='glass'>Frosted</GlassCard>)
    expect(screen.getByTestId('glass')).toHaveClass('hover:-translate-y-1')
    expect(screen.getByTestId('glass')).not.toHaveAttribute('role')
  })
})

describe('PolaroidCard', () => {
  it('applies the frozen rotation transform and hover classes', () => {
    render(<PolaroidCard data-testid='polaroid'>Photo</PolaroidCard>)
    expect(screen.getByTestId('polaroid')).toHaveStyle({ transform: 'rotate(0deg)' })

    render(
      <PolaroidCard data-testid='tilted' rotation={-4}>
        Photo
      </PolaroidCard>
    )
    const tilted = screen.getByTestId('tilted')
    expect(tilted).toHaveStyle({ transform: 'rotate(-4deg)' })
    expect(tilted).toHaveClass('bg-white')
    expect(tilted).toHaveClass('pb-16')
    expect(tilted).toHaveClass('hover:rotate-0')
  })
})

describe('MemoryCard', () => {
  it('renders the frozen guestbook card classes and interactive semantics', () => {
    const { rerender } = render(
      <MemoryCard data-testid='memory' interactive>
        Note
      </MemoryCard>
    )

    const card = screen.getByTestId('memory')
    expect(card).toHaveClass('bg-cream-50')
    expect(card).toHaveClass('border-gold-200/50')
    expect(card).toHaveClass('hover:border-gold-300')
    expect(card).toHaveAttribute('role', 'button')

    rerender(<MemoryCard data-testid='memory'>Note</MemoryCard>)
    expect(screen.getByTestId('memory')).not.toHaveAttribute('role')
  })
})

describe('Card composition helpers', () => {
  it('renders the frozen header/content/footer class contracts', () => {
    render(
      <Card>
        <CardHeader data-testid='header'>h</CardHeader>
        <CardContent data-testid='content'>c</CardContent>
        <CardFooter data-testid='footer'>f</CardFooter>
      </Card>
    )

    expect(screen.getByTestId('header')).toHaveClass('flex-col')
    expect(screen.getByTestId('header')).toHaveClass('p-6')
    expect(screen.getByTestId('content')).toHaveClass('pt-0')
    expect(screen.getByTestId('footer')).toHaveClass('items-center')
  })

  it('renders CardTitle as an h3 and falls back to an sr-only label', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(<CardTitle ref={ref}>Evening</CardTitle>)

    const title = screen.getByRole('heading', { level: 3, name: 'Evening' })
    expect(title).toHaveClass('font-display')
    expect(title).toHaveClass('text-2xl')
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement)

    render(<CardTitle />)
    expect(screen.getByText('Card title')).toHaveClass('sr-only')
  })

  it('renders CardDescription as a paragraph with the frozen muted colour', () => {
    render(<CardDescription>Details</CardDescription>)

    const description = screen.getByText('Details')
    expect(description.tagName).toBe('P')
    expect(description).toHaveClass('text-sm')
    expect(description).toHaveClass('text-charcoal-600')
  })
})
