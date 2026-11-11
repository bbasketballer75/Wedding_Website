import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChapterTitle } from './ChapterTitle'

// framer-motion's `whileInView` needs an IntersectionObserver, which jsdom does
// not implement. The stub keeps the motion components mounted; assertions are
// on the rendered DOM, not the animation phase.
class MockIntersectionObserver {
  root = null
  rootMargin = ''
  thresholds: number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChapterTitle', () => {
  it('renders the frozen chapter label, title watermark and subtitle', () => {
    render(
      <ChapterTitle
        chapter='Chapter One'
        title={<span>The Beginning</span>}
        subtitle='Where it all started'
      />
    )

    expect(screen.getByText('Chapter One')).toHaveClass('font-display')
    expect(screen.getByText('Chapter One')).toHaveClass('uppercase')
    expect(screen.getByText('Our Journey')).toHaveClass('font-script')
    expect(screen.getByText('The Beginning')).toBeInTheDocument()
    expect(screen.getByText('Where it all started')).toHaveClass('font-body')
  })

  it('splits a string title through RevealText (word spans)', () => {
    const { container } = render(<ChapterTitle chapter='Prologue' title='Our Journey' />)

    expect(container.textContent).toContain('Our')
    expect(container.textContent).toContain('Journey')
    // The watermark plus the split title are both in the DOM.
    expect(screen.getAllByText('Our Journey').length).toBeGreaterThanOrEqual(1)
  })

  it('uses the frozen watermark colours per theme', () => {
    const { container, rerender } = render(<ChapterTitle chapter='One' title='Title' />)
    const watermark = () => container.querySelector('.font-script')
    expect((watermark() as HTMLElement).style.color).toBe('white')

    rerender(<ChapterTitle chapter='One' title='Title' theme='light' />)
    expect((watermark() as HTMLElement).style.color).toBe('var(--color-gold-500)')
  })

  it('omits the subtitle wrapper when no subtitle is given', () => {
    const { container } = render(<ChapterTitle chapter='One' title='Title' />)

    expect(container.querySelector('p')).toBeNull()
  })
})
