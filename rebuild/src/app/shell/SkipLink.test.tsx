import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SkipLink } from './SkipLink'

describe('SkipLink', () => {
  it('is the first focusable element and points at the main landmark', () => {
    render(
      <>
        <SkipLink />
        <main id='main-content' tabIndex={-1}>
          content
        </main>
      </>
    )

    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('moves focus to #main-content when activated', async () => {
    const user = userEvent.setup()
    render(
      <>
        <SkipLink />
        <main id='main-content' tabIndex={-1}>
          content
        </main>
      </>
    )

    await user.click(screen.getByRole('link', { name: 'Skip to main content' }))

    expect(document.activeElement).toBe(document.getElementById('main-content'))
  })
})
