import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  PEOPLE_REVIEW_FIXTURES,
  type PeopleReviewData,
  type UpdateMediaReviewClusterInput,
  type UpdateMediaReviewFaceInput,
} from './media-review-data'
import { PeopleReviewPage } from './PeopleReviewPage'

/**
 * People-review tests: batch selection + lifecycle transitions, cluster rename
 * and merge payloads, and face confirm/unconfirm payloads (the columns that
 * drive public people labels). All data comes from the deterministic fixtures.
 */

function createData(overrides: Partial<PeopleReviewData> = {}) {
  const updateCluster = vi.fn((clusterId: string, input: UpdateMediaReviewClusterInput) =>
    PEOPLE_REVIEW_FIXTURES.updateCluster(clusterId, input)
  )
  const updateFaces = vi.fn((faceIds: readonly string[], input: UpdateMediaReviewFaceInput) =>
    PEOPLE_REVIEW_FIXTURES.updateFaces(faceIds, input)
  )
  return {
    updateCluster,
    updateFaces,
    updateBatchStatus: vi.fn(PEOPLE_REVIEW_FIXTURES.updateBatchStatus),
    fetchBatches: vi.fn(PEOPLE_REVIEW_FIXTURES.fetchBatches),
    fetchClusters: vi.fn(PEOPLE_REVIEW_FIXTURES.fetchClusters),
    fetchFaces: vi.fn(PEOPLE_REVIEW_FIXTURES.fetchFaces),
    ...overrides,
  }
}

async function renderPage(data: PeopleReviewData = createData()) {
  const view = render(<PeopleReviewPage data={data} />)
  await screen.findByRole('heading', {
    name: 'Turn face detections into a browsable people archive.',
  })
  return { ...view, ...data }
}

async function renderLoadedPage() {
  const data = createData()
  const view = await renderPage(data)
  await screen.findByTestId('review-cluster-cluster-rec-1')
  return { ...view, ...data }
}

function getBatchPicker(): HTMLElement {
  return screen.getByLabelText('Review batch')
}

describe('PeopleReviewPage', () => {
  it('renders the frozen panel copy, batch stats, clusters and faces', async () => {
    const data = await renderLoadedPage()

    expect(screen.getByText('People workflow')).toBeInTheDocument()
    expect(data.fetchBatches).toHaveBeenCalledTimes(1)
    expect(data.fetchClusters).toHaveBeenCalledWith('batch-1')
    expect(data.fetchFaces).toHaveBeenCalledWith('batch-1')

    expect(getBatchPicker()).toHaveValue('batch-1')
    expect(screen.getByText('in review')).toBeInTheDocument()
    expect(screen.getByText('Pending faces')).toBeInTheDocument()

    // First cluster auto-selects and its faces render.
    expect(screen.getByRole('heading', { level: 3, name: 'Aunt Patricia' })).toBeInTheDocument()
    const selectedCluster = screen.getByTestId('review-cluster-cluster-rec-1')
    expect(selectedCluster).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('review-face-face-1')).toBeInTheDocument()
    expect(screen.getByTestId('review-face-face-2')).toBeInTheDocument()
    expect(screen.getByTestId('review-face-face-3')).toBeInTheDocument()
  })

  it('advances the batch lifecycle through the injected API', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Mark approved/i }))

    await waitFor(() => expect(data.updateBatchStatus).toHaveBeenCalledWith('batch-1', 'approved'))
    await screen.findByText('approved')
    expect(screen.getByText('Batch status set to approved.')).toBeInTheDocument()
  })

  it('loads a different batch when the picker changes', async () => {
    const data = await renderLoadedPage()

    fireEvent.change(getBatchPicker(), { target: { value: 'batch-2' } })

    await screen.findByTestId('review-cluster-cluster-rec-3')
    expect(data.fetchClusters).toHaveBeenLastCalledWith('batch-2')
    expect(data.fetchFaces).toHaveBeenLastCalledWith('batch-2')
    expect(
      screen.getByRole('heading', { level: 3, name: 'Bridesmaid (unresolved)' })
    ).toBeInTheDocument()
    expect(getBatchPicker()).toHaveValue('batch-2')
  })

  it('renames (confirms) a cluster with the frozen payload', async () => {
    const data = await renderLoadedPage()

    fireEvent.change(screen.getByLabelText("Confirm this person's name"), {
      target: { value: 'Uncle Joe' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Save name$/i }))

    await waitFor(() =>
      expect(data.updateCluster).toHaveBeenCalledWith('cluster-rec-1', {
        confirmedName: 'Uncle Joe',
        reviewStatus: 'confirmed',
      })
    )
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3, name: 'Uncle Joe' })).toBeInTheDocument()
    )
    expect(screen.getByText('Saved "Uncle Joe" as the confirmed name.')).toBeInTheDocument()
  })

  it('merges the selected cluster into a target with the frozen payload', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Merge into another cluster/i }))
    const dialog = screen.getByTestId('cluster-merge-dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.change(within(dialog).getByLabelText('Target cluster'), {
      target: { value: 'cluster-rec-2' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Merge clusters/i }))

    await waitFor(() =>
      expect(data.updateCluster).toHaveBeenCalledWith('cluster-rec-1', {
        mergeIntoClusterId: 'cluster-rec-2',
        reviewStatus: 'merged',
      })
    )
    expect(screen.queryByTestId('cluster-merge-dialog')).not.toBeInTheDocument()
  })

  it('confirms and unconfirms faces with the frozen payloads', async () => {
    const data = await renderLoadedPage()

    // Cluster 1 already has a confirmed name ("Aunt Patricia").
    fireEvent.click(screen.getByRole('button', { name: 'Confirm face face-b' }))

    await waitFor(() =>
      expect(data.updateFaces).toHaveBeenCalledWith(['face-2'], {
        reviewStatus: 'confirmed',
        confirmedName: 'Aunt Patricia',
        personKey: 'aunt-patricia',
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /Unconfirm face face-a/i }))

    await waitFor(() =>
      expect(data.updateFaces).toHaveBeenLastCalledWith(['face-1'], {
        reviewStatus: 'pending',
        confirmedName: null,
        personKey: null,
      })
    )
  })

  it('requires a cluster name before confirming faces', async () => {
    await renderLoadedPage()

    // Switch to the unnamed cluster: confirm is disabled until a name is typed.
    fireEvent.click(screen.getByTestId('review-cluster-cluster-rec-2'))
    const confirmButton = screen.getByRole('button', { name: 'Confirm face face-d' })
    expect(confirmButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Unconfirm face face-e' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Confirm this person's name"), {
      target: { value: 'Table seven' },
    })
    expect(confirmButton).toBeEnabled()
  })

  it('bulk-confirms every face in the selected cluster', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Confirm all faces/i }))

    await waitFor(() =>
      expect(data.updateFaces).toHaveBeenCalledWith(['face-1', 'face-2', 'face-3'], {
        reviewStatus: 'confirmed',
        confirmedName: 'Aunt Patricia',
        personKey: 'aunt-patricia',
      })
    )
    expect(screen.getByText('Confirmed Aunt Patricia on 3 faces.')).toBeInTheDocument()
  })

  it('shows the frozen empty state when there are no batches', async () => {
    const data = createData({ fetchBatches: vi.fn(() => Promise.resolve([])) })
    render(<PeopleReviewPage data={data} />)

    await screen.findByText('Guest-upload review queue is empty')
    expect(
      screen.getByText(
        'Export and tag approved guest uploads, then push a guest review batch to stage the next people-review pass.'
      )
    ).toBeInTheDocument()
  })

  it('refreshes batches and the selected batch details', async () => {
    const data = await renderLoadedPage()

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))

    await waitFor(() => expect(data.fetchBatches).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(data.fetchClusters).toHaveBeenCalledTimes(2))
  })
})
