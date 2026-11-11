import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from './Footer'

const ROUTE_PATHS = ['/', '/film', '/gallery', '/guestbook', '/upload', '/print'] as const

function buildRouter() {
  const rootRoute = createRootRoute({ component: Footer })
  const childRoutes = ROUTE_PATHS.map(path =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )
  return createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: ['/film'] }),
  })
}

async function renderFooter() {
  const router = buildRouter()
  await router.load()
  render(<RouterProvider router={router} />)
}

describe('Footer', () => {
  it('renders the frozen content, credits and copyright line', async () => {
    await renderFooter()

    const footer = screen.getByTestId('public-footer')
    expect(footer.tagName).toBe('FOOTER')

    expect(
      within(footer).getByRole('heading', {
        level: 2,
        name: 'Thanks for helping us keep the day alive.',
      })
    ).toBeInTheDocument()
    expect(within(footer).getByText('Austin and Jordyn')).toBeInTheDocument()
    expect(within(footer).getByText('May 10, 2025')).toBeInTheDocument()
    expect(within(footer).getByText('The Lodge at Indian Lake')).toBeInTheDocument()
    expect(within(footer).getByText('Made with')).toBeInTheDocument()
    expect(within(footer).getByText(/© \d{4} Austin & Jordyn/)).toBeInTheDocument()
  })

  it('renders four destination cards plus the five public nav chips', async () => {
    await renderFooter()

    const footer = screen.getByTestId('public-footer')
    const links = within(footer).getAllByRole('link')
    expect(links).toHaveLength(9)

    const cards = links.slice(0, 4)
    expect(cards.map(card => card.getAttribute('href'))).toEqual([
      '/film',
      '/gallery',
      '/guestbook',
      '/print',
    ])
    expect(cards.map(card => card.textContent)).toEqual([
      'Watch the filmRevisit the ceremony, speeches, and the whole dance floor arc.',
      'Browse the galleryPortraits, candids, and every little detail we never want to forget.',
      'Leave a noteA quiet last stop for one message, blessing, or little memory from the day.',
      'Memory BookPrint a keepsake photo book or guestbook — save as PDF from any browser.',
    ])

    // The bottom band repeats the public nav labels as chips.
    const chips = links.slice(4)
    expect(chips.map(chip => chip.textContent)).toEqual([
      'Watch Film',
      'Gallery',
      'Guestbook',
      'Share',
      'Memory Book',
    ])
  })
})
