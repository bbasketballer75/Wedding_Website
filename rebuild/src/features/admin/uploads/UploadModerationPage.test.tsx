import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from '../test-utils/adminTestEnvironment'
import { createTestAdminRuntime, getLastAuditInput } from '../test-utils/createTestAdminRuntime'
import { renderAdminRoute } from '../test-utils/renderAdmin'

describe('UploadModerationPage', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the frozen heading, status cards and pending queue', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Guest Upload Moderation' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Review guest photo submissions\. Approve unique photos/)
    ).toBeInTheDocument()
    expect(screen.getByText('Pending review')).toBeInTheDocument()
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0)

    const queue = await screen.findByTestId('upload-queue')
    expect(within(queue).getByText('Riley Thompson')).toBeInTheDocument()
    expect(within(queue).getByText('Sam Garcia')).toBeInTheDocument()
    expect(within(queue).getByText('Alex Chen')).toBeInTheDocument()
    expect(within(queue).getByLabelText('Select upload from Riley Thompson')).toBeInTheDocument()
  })

  it('approves an upload, records the audit entry with actor + from/to, then focuses the queue', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    fireEvent.click(await screen.findByLabelText('Approve upload from Riley Thompson'))

    await waitFor(() => {
      expect(getLastAuditInput(auditSpy)).toMatchObject({
        entityType: 'guest_upload',
        entityId: 'upload-pending-1',
        action: 'upload_approved_published',
        fromStatus: 'pending',
        toStatus: 'approved',
        actor: { email: 'admin@test.wedding' },
      })
    })
    expect(await screen.findByText('Approved the upload from Riley Thompson.')).toBeInTheDocument()
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('data-testid')).toBe('upload-queue')
    })
    expect(screen.queryByLabelText('Approve upload from Riley Thompson')).not.toBeInTheDocument()
  })

  it('rejects with an optional reason through the confirm dialog', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    fireEvent.click(await screen.findByLabelText('Reject upload from Sam Garcia'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Reject Upload' })).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Rejection reason (optional)'), {
      target: { value: 'Duplicate frame' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))

    await waitFor(() => {
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'upload-pending-2',
          action: 'upload_rejected',
          toStatus: 'rejected',
          metadata: { rejection_reason: 'Duplicate frame' },
        })
      )
    })
  })

  it('bulk approves the selected pending uploads', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    fireEvent.click(await screen.findByLabelText('Select upload from Riley Thompson'))
    fireEvent.click(screen.getByLabelText('Select upload from Sam Garcia'))
    fireEvent.click(screen.getByRole('button', { name: /Approve all/ }))

    await waitFor(() => {
      expect(auditSpy).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Approved 2 uploads.')).toBeInTheDocument()
  })

  it('switches tabs and publishes approved uploads to a product album', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    fireEvent.click(await screen.findByRole('button', { name: /Approved/ }))
    fireEvent.click(await screen.findByLabelText('Select upload from Jamie Rivera'))

    fireEvent.change(screen.getByLabelText('Publish to album'), {
      target: { value: 'Wedding Day' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => {
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'upload-approved-1',
          summary: 'Guest upload photos published to Wedding Day album',
          metadata: { album: 'Wedding Day' },
        })
      )
    })
    expect(await screen.findByText(/photos published to Wedding Day\./)).toBeInTheDocument()
  })

  it('shows the approved and rejected queues on their tabs', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/photos' })

    fireEvent.click(await screen.findByRole('button', { name: /Rejected/ }))
    expect(await screen.findByText('Taylor Brooks')).toBeInTheDocument()
    expect(screen.queryByText('No rejected uploads')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Pending/ }))
    expect(await screen.findByText('Riley Thompson')).toBeInTheDocument()
  })
})
