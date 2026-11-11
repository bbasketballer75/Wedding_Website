import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  buildClusterMergePatch,
  buildClusterRenamePatch,
  buildFaceConfirmPatch,
  buildFaceUnconfirmPatch,
  clusterDisplayName,
  faceDisplayName,
  FIXTURE_BATCHES,
  FIXTURE_CLUSTERS,
  FIXTURE_FACES,
  PEOPLE_REVIEW_FIXTURES,
} from './media-review-data'
import { usePeopleReview } from './usePeopleReview'

describe('people-review data helpers', () => {
  it('resolves cluster and face display labels through the frozen fallbacks', () => {
    const [confirmed, unnamed] = FIXTURE_CLUSTERS['batch-1']!
    expect(clusterDisplayName(confirmed!)).toBe('Aunt Patricia')
    expect(clusterDisplayName(unnamed!)).toBe('Table 7 guest')
    expect(clusterDisplayName({ ...unnamed!, clusterId: '', confirmedName: null })).toBe(
      `Cluster ${unnamed!.id.slice(0, 8)}`
    )

    const [firstFace] = FIXTURE_FACES['batch-1']!
    expect(faceDisplayName(firstFace!)).toBe('Aunt Patricia')
    expect(faceDisplayName({ ...firstFace!, confirmedName: null, clusterId: null })).toBe('face-a')
    expect(
      faceDisplayName({ ...firstFace!, confirmedName: null, clusterId: null, faceId: '' })
    ).toBe(`Face ${firstFace!.id.slice(0, 8)}`)
  })

  it('builds the frozen merge/rename/confirm payloads', () => {
    expect(buildClusterMergePatch('target-1')).toEqual({
      mergeIntoClusterId: 'target-1',
      reviewStatus: 'merged',
    })
    expect(buildClusterRenamePatch('  Uncle Joe ')).toEqual({
      confirmedName: 'Uncle Joe',
      reviewStatus: 'confirmed',
    })
    expect(buildClusterRenamePatch('   ')).toEqual({
      confirmedName: null,
      reviewStatus: 'pending',
    })
    expect(buildFaceConfirmPatch('Aunt Patricia')).toEqual({
      reviewStatus: 'confirmed',
      confirmedName: 'Aunt Patricia',
      personKey: 'aunt-patricia',
    })
    expect(buildFaceConfirmPatch('')).toEqual({
      reviewStatus: 'confirmed',
      confirmedName: null,
      personKey: null,
    })
    expect(buildFaceUnconfirmPatch()).toEqual({
      reviewStatus: 'pending',
      confirmedName: null,
      personKey: null,
    })
  })

  it('fixtures resolve batch/cluster/face lookups and reject unknown ids', async () => {
    expect(await PEOPLE_REVIEW_FIXTURES.fetchBatches()).toHaveLength(FIXTURE_BATCHES.length)
    expect(await PEOPLE_REVIEW_FIXTURES.updateBatchStatus('batch-1', 'approved')).toMatchObject({
      status: 'approved',
    })
    await expect(PEOPLE_REVIEW_FIXTURES.updateBatchStatus('nope', 'approved')).rejects.toThrow()
    await expect(PEOPLE_REVIEW_FIXTURES.updateCluster('nope', {})).rejects.toThrow()

    const faces = await PEOPLE_REVIEW_FIXTURES.updateFaces(['face-1', 'missing'], {
      confirmedName: 'A',
    })
    expect(faces).toHaveLength(1)
  })
})

describe('usePeopleReview failure and guard paths', () => {
  it('reports batch load failures and turns mutations on', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      usePeopleReview({
        data: {
          ...PEOPLE_REVIEW_FIXTURES,
          fetchBatches: () => Promise.reject(new Error('offline')),
        },
      })
    )

    await waitFor(() => expect(result.current.error).toBe('Could not load review batches.'))
    expect(result.current.batchesLoading).toBe(false)
  })

  it('surfaces cluster/face mutation failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      usePeopleReview({
        data: {
          ...PEOPLE_REVIEW_FIXTURES,
          updateCluster: () => Promise.reject(new Error('offline')),
          updateFaces: () => Promise.reject(new Error('offline')),
        },
      })
    )

    await waitFor(() => expect(result.current.selectedCluster).not.toBeNull())

    await act(async () => {
      await result.current.saveClusterName()
    })
    await waitFor(() => expect(result.current.error).toBe('Could not save the cluster name.'))

    await act(async () => {
      await result.current.mergeSelectedCluster('cluster-rec-2')
    })
    await waitFor(() => expect(result.current.error).toBe('Could not merge the cluster.'))

    const face = result.current.clusterFaces[0]!
    await act(async () => {
      await result.current.unconfirmFace(face)
    })
    await waitFor(() => expect(result.current.error).toBe('Could not unconfirm the face.'))
  })

  it('requires a name before confirming faces', async () => {
    const { result } = renderHook(() => usePeopleReview({ data: PEOPLE_REVIEW_FIXTURES }))
    await waitFor(() => expect(result.current.selectedCluster).not.toBeNull())

    act(() => result.current.selectCluster('cluster-rec-2'))
    await waitFor(() => expect(result.current.selectedClusterId).toBe('cluster-rec-2'))

    const face = result.current.clusterFaces[0]!
    await act(async () => {
      await result.current.confirmFace(face)
    })
    await waitFor(() =>
      expect(result.current.error).toBe('Name the cluster before confirming its faces.')
    )

    await act(async () => {
      await result.current.confirmClusterFaces()
    })
    await waitFor(() =>
      expect(result.current.error).toBe('Name the cluster before confirming its faces.')
    )
  })

  it('ignores mutations before a batch is selected or without a merge target', async () => {
    const updateBatchStatus = vi.fn(() => Promise.resolve(FIXTURE_BATCHES[0]!))
    const updateCluster = vi.fn(() => Promise.reject(new Error('should not be called')))
    const { result, unmount } = renderHook(() =>
      usePeopleReview({
        data: {
          ...PEOPLE_REVIEW_FIXTURES,
          fetchBatches: () => new Promise(() => undefined),
          updateBatchStatus,
          updateCluster,
        },
      })
    )

    await act(async () => {
      await result.current.changeBatchStatus('approved')
      await result.current.mergeSelectedCluster('')
      await result.current.confirmClusterFaces()
      await result.current.saveClusterName()
    })

    expect(updateBatchStatus).not.toHaveBeenCalled()
    expect(updateCluster).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    unmount()
  })
})
