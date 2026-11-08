import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installMotionStubs, renderHomeUi } from '../test-helpers'
import { HomeNav } from './HomeNav'

installMotionStubs()

describe('HomeNav', () => {
  it('renders the frozen logo, five nav destinations and the theme toggle', async () => {
    await renderHomeUi(<HomeNav />)

    const nav = screen.getByTestId('home-nav')
    expect(nav.tagName).toBe('NAV')

    expect(within(nav).getAllByRole('link')).toHaveLength(6)
    expect(within(nav).getByRole('link', { name: 'A&J' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: /Watch Film/ })).toHaveAttribute('href', '/film')
    expect(within(nav).getByRole('link', { name: /Gallery/ })).toHaveAttribute('href', '/gallery')
    expect(within(nav).getByRole('link', { name: /Guestbook/ })).toHaveAttribute(
      'href',
      '/guestbook'
    )
    expect(within(nav).getByRole('link', { name: /Share/ })).toHaveAttribute('href', '/upload')
    expect(within(nav).getByRole('link', { name: /Memory Book/ })).toHaveAttribute('href', '/print')

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to Light theme' })).toBeInTheDocument()
  })

  it('renders both the mobile and desktop labels for each destination', async () => {
    await renderHomeUi(<HomeNav />)

    expect(screen.getByText('Film')).toHaveClass('max-[360px]:hidden')
    expect(screen.getByText('Watch Film')).toHaveClass('hidden', 'sm:inline')
  })
})
