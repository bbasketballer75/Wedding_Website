import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from '../test-utils/adminTestEnvironment'
import { createTestAdminRuntime, getLastAuditInput } from '../test-utils/createTestAdminRuntime'
import { renderAdminRoute } from '../test-utils/renderAdmin'

describe('GuestbookModerationPage', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the frozen heading, messages and moderation history', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/guestbook' })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Guestbook Moderation' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Keep the guestbook warm and readable/)).toBeInTheDocument()

    const list = await screen.findByTestId('guestbook-moderation-list')
    expect(within(list).getByText('Sarah Mitchell')).toBeInTheDocument()
    expect(within(list).getByText('Mike Chen')).toBeInTheDocument()
    expect(within(list).getByText('Aunt Patricia')).toBeInTheDocument()
    expect(within(list).getAllByLabelText('Delete message')).toHaveLength(3)
  })

  it('filters messages by name, email or content', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/guestbook' })

    const search = await screen.findByLabelText('Search guestbook messages')
    fireEvent.change(search, { target: { value: 'mike' } })

    expect(screen.getByText('Mike Chen')).toBeInTheDocument()
    expect(screen.queryByText('Sarah Mitchell')).not.toBeInTheDocument()
    expect(screen.queryByText('Aunt Patricia')).not.toBeInTheDocument()
  })

  it('requires confirmation, deletes the message and records the audit entry', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/guestbook' })

    const deleteButtons = await screen.findAllByLabelText('Delete message')
    fireEvent.click(deleteButtons[0] as HTMLElement)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Delete guestbook message' })
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(getLastAuditInput(auditSpy)).toMatchObject({
        entityType: 'guestbook_message',
        entityId: 'gb-msg-3',
        action: 'guestbook_message_deleted',
        actor: { email: 'admin@test.wedding' },
        metadata: { guest_name: 'Aunt Patricia' },
      })
    })
    expect(await screen.findByText('Message deleted.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Aunt Patricia')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Deleted message')).toBeInTheDocument()
  })

  it('bulk deletes the selected messages and audits each one', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/guestbook' })

    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0] as HTMLElement)
    fireEvent.click(checkboxes[1] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /Delete selected \(2\)/ }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Delete 2 guestbook messages' })
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete selected' }))

    await waitFor(() => {
      expect(auditSpy).toHaveBeenCalledTimes(2)
    })
    expect(getLastAuditInput(auditSpy)).toMatchObject({
      action: 'guestbook_bulk_deleted',
      metadata: { bulk_count: 2 },
    })
    expect(await screen.findByText('Deleted 2 guestbook messages.')).toBeInTheDocument()
  })
})
