import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'
import { RootLayout } from './RootLayout'

const ROUTE_PATHS = ['/', '/film', '/print', '/admin/login', '/admin', '/admin/albums'] as const

function buildRouter(initialPath: string) {
  const rootRoute = createRootRoute({
    component: RootLayout,
    notFoundComponent: NotFoundPage,
  })
  const childRoutes = ROUTE_PATHS.map(path =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div data-testid='route-page' />,
    })
  )
  return createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

async function renderShell(initialPath: string) {
  const router = buildRouter(initialPath)
  await router.load()
  render(<RouterProvider router={router} />)
}

describe('RootLayout shell chrome', () => {
  it('renders the 404 inside the shared header/footer shell (frozen behavior)', async () => {
    await renderShell('/people')

    expect(screen.getByTestId('public-header')).toBeInTheDocument()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()

    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(main?.querySelector('h1')?.textContent).toBe('404')
    expect(main?.querySelector('h2')?.textContent).toBe('Page Not Found')
    expect(main?.getAttribute('aria-label')).toBe('Page content')
  })

  it('matches the frozen 404 DOM link, heading and image order', async () => {
    await renderShell('/__parity-missing__')

    const links = [...document.querySelectorAll('a[href]')].map(link => [
      link.getAttribute('href'),
      link.textContent,
      link.getAttribute('aria-label') ?? '',
    ])
    expect(links).toEqual([
      ['#main-content', 'Skip to main content', ''],
      ['/', 'A&J', ''],
      ['/film', 'FilmWatch Film', ''],
      ['/gallery', 'PhotosGallery', ''],
      ['/guestbook', 'GuestsGuestbook', ''],
      ['/upload', 'ShareShare', ''],
      ['/print', 'PrintMemory Book', ''],
      ['/', 'Back to Home', ''],
      ['/film', 'Watch the filmRevisit the ceremony, speeches, and the whole dance floor arc.', ''],
      [
        '/gallery',
        'Browse the galleryPortraits, candids, and every little detail we never want to forget.',
        '',
      ],
      [
        '/guestbook',
        'Leave a noteA quiet last stop for one message, blessing, or little memory from the day.',
        '',
      ],
      [
        '/print',
        'Memory BookPrint a keepsake photo book or guestbook — save as PDF from any browser.',
        '',
      ],
      ['/film', 'Watch Film', ''],
      ['/gallery', 'Gallery', ''],
      ['/guestbook', 'Guestbook', ''],
      ['/upload', 'Share', ''],
      ['/print', 'Memory Book', ''],
    ])

    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => [
      heading.tagName,
      heading.textContent,
    ])
    expect(headings).toEqual([
      ['H1', '404'],
      ['H2', 'Page Not Found'],
      ['H2', 'Thanks for helping us keep the day alive.'],
    ])

    expect(document.querySelectorAll('img')).toHaveLength(0)
    // The frozen header's current-page state on an unknown path: nothing is current.
    expect(document.querySelectorAll('a[aria-current]')).toHaveLength(0)
  })

  it('shows the header on public routes and labels the main landmark', async () => {
    await renderShell('/film')

    expect(screen.getByTestId('public-header')).toBeInTheDocument()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()
    expect(document.getElementById('main-content')?.getAttribute('aria-label')).toBe('Wedding Film')
  })

  it('hides the header on the home route but keeps the footer', async () => {
    await renderShell('/')

    expect(screen.queryByTestId('public-header')).toBeNull()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()
    expect(document.getElementById('main-content')?.getAttribute('aria-label')).toBe('Home')
  })

  it('suppresses header and footer on the print route', async () => {
    await renderShell('/print')

    expect(screen.queryByTestId('public-header')).toBeNull()
    expect(screen.queryByTestId('public-footer')).toBeNull()
    expect(document.getElementById('main-content')?.getAttribute('aria-label')).toBe('Memory Book')
  })

  it('suppresses header and footer on admin-login and admin child routes', async () => {
    await renderShell('/admin/login')

    expect(screen.queryByTestId('public-header')).toBeNull()
    expect(screen.queryByTestId('public-footer')).toBeNull()
  })

  it('keeps the frozen quirk that /admin itself is not treated as admin chrome', async () => {
    await renderShell('/admin')

    expect(screen.getByTestId('public-header')).toBeInTheDocument()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()
  })
})
