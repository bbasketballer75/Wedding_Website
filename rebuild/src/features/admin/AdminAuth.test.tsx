import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from './test-utils/adminTestEnvironment'
import { createTestAdminRuntime } from './test-utils/createTestAdminRuntime'
import { renderAdminRoute } from './test-utils/renderAdmin'
import { createSnapshotAuthClient, type AdminAuthSnapshot } from './data'

describe('AdminGate', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the frozen loading skeleton while the session resolves', async () => {
    const loadingSnapshot: AdminAuthSnapshot = {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      isAdmin: false,
    }
    const auth = createSnapshotAuthClient(loadingSnapshot, {
      signIn: () => Promise.resolve({ success: true }),
      signOut: () => Promise.resolve(),
    })
    const { runtime } = createTestAdminRuntime()

    await renderAdminRoute({ runtime: { auth, api: runtime.api }, initialPath: '/admin' })

    expect(screen.getByText('Loading admin workspace...')).toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor to the login page preserving the target', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    const { router } = await renderAdminRoute({ runtime, initialPath: '/admin' })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login')
    })
    expect(router.state.location.searchStr).toContain('from=%2Fadmin')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Admin sign in' })
    ).toBeInTheDocument()
  })

  it('redirects a signed-in non-admin to the login upgrade instructions', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'member' })
    const { router } = await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/login')
    })
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You are signed in, but not an admin yet',
      })
    ).toBeInTheDocument()
  })

  it('renders the admin shell for a user with app_metadata role=admin', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin' })

    expect(await screen.findByTestId('admin-header')).toBeInTheDocument()
    expect(screen.getByTestId('admin-content')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'A faster weekly view of what needs attention.',
      })
    ).toBeInTheDocument()
  })
})

describe('AdminLoginPage', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requires both fields before calling sign-in', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin/login' })

    const form = container.querySelector('form')
    if (!form) throw new Error('expected the login form')
    fireEvent.submit(form)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your email and password to continue.'
    )
  })

  it('shows the frozen invalid-credentials failure copy', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    await renderAdminRoute({ runtime, initialPath: '/admin/login' })

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.wedding' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByTestId('admin-login-submit'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('signs in and honours the requested admin target', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    const { router } = await renderAdminRoute({
      runtime,
      initialPath: '/admin/login?from=/admin/photos',
    })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'admin@test.wedding' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'admin-fixture-password' },
    })
    fireEvent.click(screen.getByTestId('admin-login-submit'))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/photos')
    })
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Guest Upload Moderation' })
    ).toBeInTheDocument()
  })

  it('redirects an already-admin session to the requested admin page', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { router } = await renderAdminRoute({
      runtime,
      initialPath: '/admin/login?from=/admin/audit',
    })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/audit')
    })
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Moderation Audit Trail' })
    ).toBeInTheDocument()
  })

  it('guards against open redirects and the login loop', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { router } = await renderAdminRoute({
      runtime,
      initialPath: '/admin/login?from=/gallery',
    })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin')
    })
  })

  it('keeps the frozen signed-in-non-admin panel and supports sign out', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'member' })
    await renderAdminRoute({ runtime, initialPath: '/admin/login' })

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You are signed in, but not an admin yet',
      })
    ).toBeInTheDocument()
    expect(screen.getByText(/member@test\.wedding/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sign Out/ }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sign in to continue' })
    ).toBeInTheDocument()
  })

  it('sets the frozen noindex metadata', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    await renderAdminRoute({ runtime, initialPath: '/admin/login' })
    await screen.findByRole('heading', { level: 1, name: 'Admin sign in' })

    expect(document.title).toBe("Admin Login | Austin & Jordyn's Wedding")
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Secure admin access for the Austin and Jordyn wedding site.'
    )
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow'
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.theporadas.com/admin/login'
    )
  })

  it('renders the two frozen panels with the protected-access copy', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'anonymous' })
    await renderAdminRoute({ runtime, initialPath: '/admin/login' })

    expect(await screen.findByText('Protected access')).toBeInTheDocument()
    expect(screen.getByText('What this uses')).toBeInTheDocument()
    expect(screen.getByText('Admin role check')).toBeInTheDocument()
    expect(screen.getByText('Next configuration step')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to site/ })).toHaveAttribute('href', '/')
    expect(
      within(screen.getByTestId('admin-login-submit')).getByText('Sign In')
    ).toBeInTheDocument()
  })
})
