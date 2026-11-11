import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, ButtonLink } from './Button'

async function renderInRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{ui}</> })
  const childRoutes = ['/', '/film', '/gallery'].map(path =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div data-testid={`route:${path}`} />,
    })
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

describe('Button', () => {
  it('renders the frozen primary/md button classes by default', () => {
    render(<Button>Save the date</Button>)

    const button = screen.getByRole('button', { name: 'Save the date' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveClass('inline-flex')
    expect(button).toHaveClass('active:scale-[0.97]')
    expect(button).toHaveClass('focus-visible:ring-gold-400/70')
    expect(button).toHaveClass('rounded-full')
    expect(button).toHaveClass('bg-gold-500')
    expect(button).toHaveClass('text-charcoal-900')
    expect(button).toHaveClass('min-h-11')
  })

  it('exposes every frozen variant class contract', () => {
    const { rerender } = render(<Button>go</Button>)
    const button = () => screen.getByRole('button', { name: 'go' })
    expect(button()).toHaveClass('bg-gold-500')

    rerender(<Button variant='secondary'>go</Button>)
    expect(button()).toHaveClass('border-[color:var(--ui-border)]')
    expect(button()).toHaveClass('text-[color:var(--ui-accent-strong)]')

    rerender(<Button variant='ghost'>go</Button>)
    expect(button()).toHaveClass('bg-transparent')
    expect(button()).toHaveClass('hover:bg-[color:var(--ui-surface-elevated)]')

    rerender(<Button variant='glass'>go</Button>)
    expect(button()).toHaveClass('backdrop-blur-xl')
    expect(button()).toHaveClass('shadow-[var(--ui-shadow)]')

    rerender(<Button variant='shimmer'>go</Button>)
    expect(button()).toHaveClass('animate-shimmer')
    expect(button()).toHaveClass('bg-gradient-to-r')

    rerender(<Button variant='danger'>go</Button>)
    expect(button()).toHaveClass('bg-rose-500')
    expect(button()).toHaveClass('hover:bg-rose-600')
  })

  it('exposes every frozen size class contract', () => {
    const { rerender } = render(<Button size='sm'>go</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-9')

    rerender(<Button size='md'>go</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-11')

    rerender(<Button size='lg'>go</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-12')

    rerender(<Button size='xl'>go</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-14')

    rerender(<Button size='icon'>go</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-10')
    expect(screen.getByRole('button')).toHaveClass('w-10')
  })

  it('merges a custom className and forwards the native ref', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button ref={ref} className='custom-class'>
        go
      </Button>
    )

    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })

  it('calls onClick and respects the native disabled attribute', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>go</Button>)

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button disabled>go</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders the frozen loading markup and disables the button', () => {
    render(<Button isLoading>Save</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveTextContent('Loading, please wait')
    expect(button).toHaveTextContent('Loading...')
    expect(button.querySelector('svg.animate-spin')).not.toBeNull()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('supports the label/current/expanded/controls aria props from the frozen API', () => {
    render(
      <Button
        ariaLabel='Open menu'
        ariaExpanded
        ariaControls='mobile-menu'
        ariaCurrent='page'
        size='icon'
      >
        <span aria-hidden='true'>+</span>
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Open menu' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'mobile-menu')
    expect(button).toHaveAttribute('aria-current', 'page')
  })

  it('renders a TanStack router link when `to` is provided (frozen link branch)', async () => {
    await renderInRouter(
      <Button to='/gallery' variant='secondary' search={{ collection: 'Guest Photos' }}>
        Browse the gallery
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Browse the gallery' })
    expect(link).toHaveAttribute('href', '/gallery?collection=Guest+Photos')
    expect(link).toHaveClass('border-[color:var(--ui-border)]')
    expect(link).not.toHaveAttribute('disabled')
  })

  it('keeps the loading + aria contract on the link branch', async () => {
    await renderInRouter(
      <Button to='/film' isLoading ariaCurrent='step'>
        Watch
      </Button>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('aria-busy', 'true')
    expect(link).toHaveAttribute('aria-current', 'step')
    expect(link).toHaveTextContent('Loading...')
  })
})

describe('ButtonLink', () => {
  it('renders the router link with the requested variant and size', async () => {
    await renderInRouter(
      <ButtonLink to='/' variant='secondary' size='lg'>
        Back to Home
      </ButtonLink>
    )

    const link = screen.getByRole('link', { name: 'Back to Home' })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveClass('min-h-12')
    expect(link).toHaveClass('border-[color:var(--ui-border)]')
  })

  it('forwards the loading state through to Button', async () => {
    await renderInRouter(
      <ButtonLink to='/' isLoading ariaLabel='Return home'>
        Home
      </ButtonLink>
    )

    const link = screen.getByRole('link', { name: 'Return home' })
    expect(link).toHaveAttribute('aria-busy', 'true')
    expect(link).toHaveTextContent('Loading...')
  })
})
