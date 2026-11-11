import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from '../test-utils/adminTestEnvironment'
import { createTestAdminRuntime } from '../test-utils/createTestAdminRuntime'
import { renderAdminRoute } from '../test-utils/renderAdmin'

describe('AuditLogPage', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the frozen heading and the audit entries', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Moderation Audit Trail' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Every recorded moderation action lives here/)).toBeInTheDocument()

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(5)
    })
    const list = await screen.findByRole('list', { name: 'Moderation audit trail' })
    expect(within(list).getByText('Approved + published')).toBeInTheDocument()
    expect(within(list).getByText('Deleted message')).toBeInTheDocument()
  })

  it('filters by entity type', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(5)
    })

    fireEvent.change(screen.getByLabelText('Filter audit trail by entity type'), {
      target: { value: 'guestbook_message' },
    })

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(2)
    })
  })

  it('filters by action and by actor email', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(5)
    })

    fireEvent.change(screen.getByLabelText('Filter audit trail by action'), {
      target: { value: 'upload_rejected' },
    })
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(1)
    })

    fireEvent.change(screen.getByLabelText('Filter audit trail by action'), {
      target: { value: 'all' },
    })
    fireEvent.change(screen.getByLabelText('Filter audit trail by actor'), {
      target: { value: 'editor@test.wedding' },
    })
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(2)
    })
  })

  it('searches summary, actor and metadata text', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const { container } = await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="audit-entry"]')).toHaveLength(5)
    })

    fireEvent.change(screen.getByLabelText('Search audit trail'), {
      target: { value: 'riley' },
    })

    await waitFor(() => {
      const entries = container.querySelectorAll('[data-testid="audit-entry"]')
      expect(entries).toHaveLength(1)
      expect(entries[0]).toHaveTextContent('Riley Thompson')
    })
  })

  it('renders the frozen empty state when filters match nothing', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    await screen.findByRole('heading', { level: 2, name: 'Moderation Audit Trail' })
    fireEvent.change(screen.getByLabelText('Search audit trail'), {
      target: { value: 'no-such-audit-entry' },
    })

    expect(
      await screen.findByText('No moderation history matches these filters yet.')
    ).toBeInTheDocument()
  })

  it('renders a role=alert failure message when the audit read fails', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    runtime.api.fetchAuditLog = () => Promise.reject(new Error('offline'))
    await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load moderation history. Please try again.'
    )
  })

  it('renders the audit entry action label, actor and timestamp', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/audit' })

    const list = await screen.findByRole('list', { name: 'Moderation audit trail' })
    const firstEntry = within(list).getAllByTestId('audit-entry')[0] as HTMLElement
    expect(firstEntry).toHaveTextContent('Editor')
    expect(firstEntry).toHaveTextContent('Bulk deleted message')
    expect(firstEntry).toHaveTextContent('Guestbook')
  })
})
