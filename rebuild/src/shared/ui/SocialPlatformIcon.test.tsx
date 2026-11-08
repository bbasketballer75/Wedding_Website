import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SocialPlatformIcon } from './SocialPlatformIcon'

describe('SocialPlatformIcon', () => {
  it('renders the frozen facebook text glyph and hides it from assistive tech', () => {
    const { container } = render(<SocialPlatformIcon platform='facebook' />)

    const glyph = container.firstElementChild
    expect(glyph).toHaveTextContent('f')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(glyph).toHaveClass('inline-flex')
    expect(glyph).toHaveClass('font-sans')
    expect(glyph).toHaveClass('text-[1.1em]')
    expect(glyph).toHaveClass('font-bold')
  })

  it('renders the frozen twitter glyph and merges a custom className', () => {
    const { container } = render(<SocialPlatformIcon platform='twitter' className='custom' />)

    const glyph = container.firstElementChild
    expect(glyph).toHaveTextContent('𝕏')
    expect(glyph).toHaveClass('custom')
  })
})
