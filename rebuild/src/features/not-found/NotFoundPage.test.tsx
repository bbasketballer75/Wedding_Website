import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotFoundPage } from './NotFoundPage'

function renderNotFound() {
  const rootRoute = createRootRoute({ component: NotFoundPage })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/people'] }),
  })

  return { router }
}

async function renderFrozenNotFound() {
  const { router } = renderNotFound()
  await router.load()
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1, name: '404' })
}

describe('NotFoundPage', () => {
  it('renders the frozen copy and returns to the archive', async () => {
    const { router } = renderNotFound()
    await router.load()
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { level: 1, name: '404' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Page Not Found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Home/ })).toBeInTheDocument()
  })

  it('sets noindex metadata with the legacy title template', async () => {
    const { router } = renderNotFound()
    await router.load()
    render(<RouterProvider router={router} />)

    await screen.findByRole('heading', { level: 1, name: '404' })
    expect(document.title).toBe("Page Not Found | Austin & Jordyn's Wedding")
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow'
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.theporadas.com/404'
    )
    // Frozen NotFoundSEO uses DEFAULT_SOCIAL_IMAGE, not the index.html default.
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://www.theporadas.com/images/home/intro-video-poster.png'
    )
  })

  it('keeps the frozen button order, decoration and heading levels', async () => {
    await renderFrozenNotFound()

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('Go Back')

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('Back to Home')
    expect(links[0]).toHaveAttribute('href', '/')

    const dots = document.querySelectorAll('.bg-gold-400')
    expect(dots).toHaveLength(3)
  })
})
