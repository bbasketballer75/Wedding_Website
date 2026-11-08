import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RevealText } from './RevealText'

// framer-motion's `whileInView` needs an IntersectionObserver, which jsdom does
// not implement. The stub keeps the motion components mounted; the tests assert
// the rendered word spans, not the animation phase.
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

describe('RevealText', () => {
  it('splits string children into the frozen word spans', () => {
    const { container } = render(<RevealText className='reveal'>Hello world</RevealText>)

    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(2)
    expect(spans[0]).toHaveTextContent('Hello')
    expect(spans[1]).toHaveTextContent('world')
    expect(spans[0]?.style.marginRight).toBe('0.25em')
    expect(container.querySelector('.reveal')).not.toBeNull()
  })

  it('wraps non-string children in a single fade-up element', () => {
    render(
      <RevealText className='wrapper'>
        <em>Editorial title</em>
      </RevealText>
    )

    expect(screen.getByText('Editorial title').tagName).toBe('EM')
    expect(document.querySelector('.wrapper')).not.toBeNull()
  })

  it('renders an empty wrapper when there are no children', () => {
    const { container } = render(<RevealText />)

    expect(container.firstElementChild).not.toBeNull()
    expect(container.textContent).toBe('')
  })

  it('accepts the frozen delay prop', () => {
    const { container } = render(<RevealText delay={0.2}>Delayed</RevealText>)

    expect(container.textContent).toBe('Delayed')
  })
})
