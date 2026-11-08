import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AccessibilityProvider } from './AccessibilityProvider'
import { Header } from './Header'
import { ThemeProvider } from './ThemeProvider'

const ROUTE_PATHS = ['/', '/film', '/gallery', '/guestbook', '/upload', '/print'] as const

function ShellHarness() {
  return (
    <AccessibilityProvider>
      <ThemeProvider>
        <Header />
      </ThemeProvider>
    </AccessibilityProvider>
  )
}

function buildRouter(initialPath: string) {
  const rootRoute = createRootRoute({ component: ShellHarness })
  const childRoutes = ROUTE_PATHS.map((path, index) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div data-testid={`route-${index}`} />,
    })
  )
  return createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

async function renderHeader(initialPath = '/film') {
  const router = buildRouter(initialPath)
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

describe('Header', () => {
  it('renders the frozen logo plus the five public nav destinations', async () => {
    await renderHeader('/film')

    const header = screen.getByTestId('public-header')
    expect(header.tagName).toBe('HEADER')

    expect(within(header).getByRole('link', { name: 'A&J' })).toHaveAttribute('href', '/')
    expect(within(header).getByRole('link', { name: /Watch Film/ })).toHaveAttribute(
      'href',
      '/film'
    )
    expect(within(header).getByRole('link', { name: /Gallery/ })).toHaveAttribute(
      'href',
      '/gallery'
    )
    expect(within(header).getByRole('link', { name: /Guestbook/ })).toHaveAttribute(
      'href',
      '/guestbook'
    )
    expect(within(header).getByRole('link', { name: /Share/ })).toHaveAttribute('href', '/upload')
    expect(within(header).getByRole('link', { name: /Memory Book/ })).toHaveAttribute(
      'href',
      '/print'
    )
    expect(within(header).getAllByRole('link')).toHaveLength(6)
  })

  it('marks only the current path with aria-current="page"', async () => {
    await renderHeader('/film')

    expect(screen.getByRole('link', { name: /Watch Film/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Gallery/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /Memory Book/ })).not.toHaveAttribute('aria-current')
  })

  it('opens the mobile menu with aria-expanded and locks body scroll', async () => {
    const user = userEvent.setup()
    await renderHeader('/film')

    expect(screen.getAllByRole('link')).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(document.body.style.overflow).toBe('hidden')
    // The overlay duplicates the nav links and adds a labelled theme toggle.
    expect(screen.getAllByRole('link')).toHaveLength(11)
    expect(screen.getAllByTestId('theme-toggle')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(document.body.style.overflow).toBe('')
    // The overlay is unmounted after its exit animation.
    await waitFor(() => {
      expect(screen.getAllByRole('link')).toHaveLength(6)
    })
  })

  it('closes the mobile menu with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    await renderHeader('/film')

    const trigger = screen.getByRole('button', { name: 'Open menu' })
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    // Move focus into the overlay, then dismiss it with Escape.
    const overlayLink = within(screen.getByRole('navigation')).getByRole('link', {
      name: /Watch Film/,
    })
    overlayLink.focus()
    expect(document.activeElement).toBe(overlayLink)

    await user.keyboard('{Escape}')

    const restoredTrigger = screen.getByRole('button', { name: 'Open menu' })
    expect(restoredTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(restoredTrigger)
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => {
      expect(screen.getAllByRole('link')).toHaveLength(6)
    })
  })
})
