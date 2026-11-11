import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from './test-utils/adminTestEnvironment'
import { createTestAdminRuntime } from './test-utils/createTestAdminRuntime'
import { renderAdminRoute } from './test-utils/renderAdmin'
import { ADMIN_NAV_ITEMS } from './utils'

describe('AdminLayout', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the frozen header, signed-in email and sign-out control', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin' })

    const header = await screen.findByTestId('admin-header')
    expect(
      within(header).getByText('A calmer workspace for moderation, people review, and site upkeep.')
    ).toBeInTheDocument()
    expect(within(header).getByText('admin@test.wedding')).toBeInTheDocument()
    expect(screen.getByTestId('admin-signout')).toBeInTheDocument()
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('admin-mobile-nav')).toBeInTheDocument()
    expect(screen.getByTestId('admin-content')).toBeInTheDocument()
  })

  it('renders all ten nav destinations with the frozen workspace copy', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin' })

    const sidebar = await screen.findByTestId('admin-sidebar')
    expect(within(sidebar).getByText('Workspace map')).toBeInTheDocument()
    expect(
      within(sidebar).getByText('Open the tool that matches the work in front of you.')
    ).toBeInTheDocument()

    for (const item of ADMIN_NAV_ITEMS) {
      expect(within(sidebar).getByText(item.label)).toBeInTheDocument()
      expect(within(sidebar).getByText(item.description)).toBeInTheDocument()
    }

    expect(ADMIN_NAV_ITEMS).toHaveLength(10)
    expect(within(screen.getByTestId('admin-mobile-nav')).getAllByRole('link')).toHaveLength(10)
  })

  it('shows the page header for non-dashboard routes', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    expect(await screen.findByText('Photos workflow')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Moderate uploads, publish moments, and keep guest tagging moving.',
      })
    ).toBeInTheDocument()
  })

  it('keeps the full-width review chrome without the sidebar', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/review' })

    expect(await screen.findByText('People workflow')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toBeInTheDocument()
    expect(screen.queryByTestId('admin-sidebar')).not.toBeInTheDocument()
  })

  it('signs out and returns to the login page', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { router } = await renderAdminRoute({ runtime, initialPath: '/admin' })

    fireEvent.click(await screen.findByTestId('admin-signout'))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login')
    })
  })
})

describe('AdminDashboard', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the injected dashboard counts and frozen workflow copy', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin' })

    const content = await screen.findByTestId('admin-content')
    await waitFor(() => {
      expect(within(content).getByText('42')).toBeInTheDocument()
    })

    expect(within(content).getByText(/austin \+ jordyn control room/i)).toBeInTheDocument()
    expect(within(content).getByText('Live gallery photos')).toBeInTheDocument()
    expect(within(content).getByText('Pending review')).toBeInTheDocument()
    expect(within(content).getByText('Guestbook entries')).toBeInTheDocument()
    expect(within(content).getAllByText('Approved uploads').length).toBeGreaterThan(0)
    expect(within(content).getByText('Three steps, in order')).toBeInTheDocument()
    expect(within(content).getByText('What belongs here')).toBeInTheDocument()
    expect(within(content).getByText('No active batch.')).toBeInTheDocument()
    expect(within(content).getByText('No guest sync yet')).toBeInTheDocument()
    expect(within(content).queryByText('Queue is clear.')).not.toBeInTheDocument()
    expect(within(content).getByText('Waiting in /admin/photos.')).toBeInTheDocument()

    const workflowSteps = within(content).getAllByText(
      /Clear \/admin\/photos first\.|Tighten names in \/admin\/review\.|Clean up messages only when needed\./
    )
    expect(workflowSteps).toHaveLength(3)
  })

  it('renders the dashboard quick links to the moderation workflows', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin' })

    const content = await screen.findByTestId('admin-content')
    expect(within(content).getByRole('link', { name: 'Photos' })).toHaveAttribute(
      'href',
      '/admin/photos'
    )
    expect(within(content).getByRole('link', { name: 'People Review' })).toHaveAttribute(
      'href',
      '/admin/review'
    )
    expect(within(content).getByRole('link', { name: /Operating notes/ })).toHaveAttribute(
      'href',
      '/admin/settings'
    )
  })
})
