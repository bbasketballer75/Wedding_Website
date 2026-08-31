import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SocialPlatformIcon } from './SocialPlatformIcon'

describe('SocialPlatformIcon', () => {
  it('renders compact local marks for social share controls', () => {
    render(
      <>
        <SocialPlatformIcon platform='facebook' />
        <SocialPlatformIcon platform='twitter' />
      </>
    )

    expect(screen.getByText('f')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('𝕏')).toHaveAttribute('aria-hidden', 'true')
  })
})
