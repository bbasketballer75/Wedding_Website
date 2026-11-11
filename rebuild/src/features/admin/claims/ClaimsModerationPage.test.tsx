import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdminTestEnvironment } from '../test-utils/adminTestEnvironment'
import { createTestAdminRuntime, getLastAuditInput } from '../test-utils/createTestAdminRuntime'
import { renderAdminRoute } from '../test-utils/renderAdmin'

describe('ClaimsModerationPage', () => {
  beforeEach(() => {
    installAdminTestEnvironment()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the pending claims queue with the frozen card copy', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/claims' })

    expect(await screen.findByText('Pending Claims')).toBeInTheDocument()
    expect(screen.getByText('Approved Claims')).toBeInTheDocument()
    expect(screen.getByText('Rejected Claims')).toBeInTheDocument()

    const cards = await screen.findAllByTestId('claim-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0] as HTMLElement).getByText('Jane Miller')).toBeInTheDocument()
    expect(within(cards[0] as HTMLElement).getByText('Face Tag Claim')).toBeInTheDocument()
    expect(within(cards[0] as HTMLElement).getByText(/Tagging Face/)).toBeInTheDocument()
  })

  it('approves a claim and records claim_approved with from/to status', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/claims' })

    fireEvent.click(await screen.findByLabelText('Approve claim for Jane Miller'))

    await waitFor(() => {
      expect(getLastAuditInput(auditSpy)).toMatchObject({
        entityType: 'photo_claim',
        entityId: 'claim-pending-1',
        action: 'claim_approved',
        fromStatus: 'pending',
        toStatus: 'approved',
        actor: { email: 'admin@test.wedding' },
      })
    })
    expect(
      await screen.findByText('Claim for Jane Miller successfully approved!')
    ).toBeInTheDocument()
  })

  it('requires a rejection reason before calling the API', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/claims' })

    fireEvent.click(await screen.findByLabelText('Reject claim for Alex Rivera'))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Reject Verification Claim' })
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Rejection' }))

    expect(
      await within(dialog).findByText('Enter a rejection reason before confirming.')
    ).toBeInTheDocument()
    expect(auditSpy).not.toHaveBeenCalled()
  })

  it('rejects a claim with the reason recorded in the audit metadata', async () => {
    const { runtime, auditSpy } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/claims' })

    fireEvent.click(await screen.findByLabelText('Reject claim for Alex Rivera'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Rejection Reason'), {
      target: { value: 'Face belongs to another guest' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Rejection' }))

    await waitFor(() => {
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'claim-pending-2',
          action: 'claim_rejected',
          toStatus: 'rejected',
          metadata: { rejection_reason: 'Face belongs to another guest' },
        })
      )
    })
    expect(await screen.findByText('Claim for Alex Rivera rejected.')).toBeInTheDocument()
  })

  it('renders the approved and rejected claims on their tabs', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    await renderAdminRoute({ runtime, initialPath: '/admin/claims' })

    fireEvent.click(await screen.findByRole('tab', { name: 'Approved Claims' }))
    expect(await screen.findByText('Bob Baker')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Rejected Claims' }))
    expect(await screen.findByText('Charlie Carter')).toBeInTheDocument()
    expect(screen.getByText('Face belongs to another guest')).toBeInTheDocument()
  })

  it('renders the frozen empty state when a queue has no claims', async () => {
    const { runtime } = createTestAdminRuntime({ session: 'admin' })
    const originalFetchClaims = runtime.api.fetchClaims
    runtime.api.fetchClaims = status =>
      status === 'pending' ? originalFetchClaims(status) : Promise.resolve([])
    await renderAdminRoute({ runtime, initialPath: '/admin/claims' })

    fireEvent.click(await screen.findByRole('tab', { name: 'Approved Claims' }))
    expect(await screen.findByText('No Approved Claims Yet')).toBeInTheDocument()
  })
})
