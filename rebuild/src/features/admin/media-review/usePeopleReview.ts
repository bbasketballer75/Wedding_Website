import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildClusterMergePatch,
  buildClusterRenamePatch,
  buildFaceConfirmPatch,
  buildFaceUnconfirmPatch,
  clusterDisplayName,
  peopleReviewData,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
  type MediaReviewCluster,
  type MediaReviewFace,
  type PeopleReviewData,
} from './media-review-data'

/**
 * People-review state machine, reduced from the frozen
 * `useMediaReviewPanel` + `mediaReviewStore`.
 *
 * Behaviour preserved:
 * - batches load once; the first (newest-updated) batch auto-selects;
 * - selecting a batch loads its clusters and faces, auto-selects the first
 *   cluster and resets the rename input;
 * - every mutation goes through the injected seam; cluster merge writes
 *   `merge_into_cluster_id` + `review_status: 'merged'`, cluster rename writes
 *   `confirmed_name` + `review_status: 'confirmed'`;
 * - face confirm writes `confirmed_name`/`review_status` (the columns the public
 *   gallery reads via `media_review_faces.confirmed_name`); unconfirm returns a
 *   face to `pending`.
 */
export interface UsePeopleReviewOptions {
  readonly data?: PeopleReviewData
}

export interface UsePeopleReviewResult {
  batches: readonly MediaReviewBatch[]
  batchesLoading: boolean
  reviewLoading: boolean
  selectedBatch: MediaReviewBatch | null
  selectedBatchId: string | null
  clusters: readonly MediaReviewCluster[]
  faces: readonly MediaReviewFace[]
  selectedCluster: MediaReviewCluster | null
  selectedClusterId: string | null
  clusterFaces: readonly MediaReviewFace[]
  mergeTargetOptions: readonly MediaReviewCluster[]
  clusterNameDraft: string
  pendingFaceCount: number
  unsavedName: boolean
  updating: boolean
  statusMessage: string | null
  error: string | null
  selectBatch: (batchId: string) => void
  selectCluster: (clusterId: string) => void
  setClusterNameDraft: (name: string) => void
  refresh: () => void
  changeBatchStatus: (status: MediaReviewBatchStatus) => Promise<void>
  saveClusterName: () => Promise<void>
  mergeSelectedCluster: (targetClusterId: string) => Promise<void>
  confirmFace: (face: MediaReviewFace) => Promise<void>
  unconfirmFace: (face: MediaReviewFace) => Promise<void>
  confirmClusterFaces: () => Promise<void>
}

export function usePeopleReview(options: UsePeopleReviewOptions = {}): UsePeopleReviewResult {
  const data = options.data ?? peopleReviewData

  const [batches, setBatches] = useState<readonly MediaReviewBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [clusters, setClusters] = useState<readonly MediaReviewCluster[]>([])
  const [faces, setFaces] = useState<readonly MediaReviewFace[]>([])
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [clusterNameDraft, setClusterNameDraft] = useState('')
  const [updating, setUpdating] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadBatches = useCallback(async (): Promise<void> => {
    try {
      setBatchesLoading(true)
      setError(null)
      const list = await data.fetchBatches()
      setBatches(list)
      setSelectedBatchId(current => {
        if (current && list.some(batch => batch.id === current)) return current
        return list[0]?.id ?? null
      })
    } catch (loadError) {
      console.error('People review: could not load review batches.', loadError)
      setError('Could not load review batches.')
    } finally {
      setBatchesLoading(false)
    }
  }, [data])

  const loadBatchDetails = useCallback(
    async (batchId: string): Promise<void> => {
      try {
        setReviewLoading(true)
        setError(null)
        const [nextClusters, nextFaces] = await Promise.all([
          data.fetchClusters(batchId),
          data.fetchFaces(batchId),
        ])
        setClusters(nextClusters)
        setFaces(nextFaces)
        setSelectedClusterId(current => {
          if (current && nextClusters.some(cluster => cluster.id === current)) return current
          return nextClusters[0]?.id ?? null
        })
        const firstCluster = nextClusters[0]
        setClusterNameDraft(firstCluster ? firstCluster.confirmedName?.trim() || '' : '')
      } catch (loadError) {
        console.error('People review: could not load batch details.', loadError)
        setClusters([])
        setFaces([])
        setSelectedClusterId(null)
        setError('Could not load this review batch.')
      } finally {
        setReviewLoading(false)
      }
    },
    [data]
  )

  // Initial batches read. Deferred so the effect body performs no synchronous
  // state update (frozen panel uses the same `setTimeout(…, 0)` pattern).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBatches()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadBatches])

  // Batch details read whenever the selection changes.
  useEffect(() => {
    if (!selectedBatchId) return undefined
    const timer = window.setTimeout(() => {
      void loadBatchDetails(selectedBatchId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadBatchDetails, selectedBatchId])

  const selectedBatch = useMemo(
    () => batches.find(batch => batch.id === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  )
  const selectedCluster = useMemo(
    () => clusters.find(cluster => cluster.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId]
  )
  const clusterFaces = useMemo(
    () =>
      selectedCluster ? faces.filter(face => face.clusterId === selectedCluster.clusterId) : [],
    [faces, selectedCluster]
  )
  const mergeTargetOptions = useMemo(
    () => clusters.filter(cluster => cluster.id !== selectedClusterId),
    [clusters, selectedClusterId]
  )
  const pendingFaceCount = useMemo(
    () => faces.filter(face => face.reviewStatus === 'pending').length,
    [faces]
  )
  const unsavedName = useMemo(() => {
    if (!selectedCluster) return false
    const confirmed = selectedCluster.confirmedName?.trim() ?? ''
    return clusterNameDraft.trim() !== confirmed
  }, [clusterNameDraft, selectedCluster])

  const selectBatch = useCallback((batchId: string): void => {
    setSelectedBatchId(batchId)
    setSelectedClusterId(null)
    setClusters([])
    setFaces([])
    setStatusMessage(null)
  }, [])

  const selectCluster = useCallback(
    (clusterId: string): void => {
      const cluster = clusters.find(candidate => candidate.id === clusterId)
      setSelectedClusterId(clusterId)
      setClusterNameDraft(cluster?.confirmedName?.trim() || '')
      setStatusMessage(null)
    },
    [clusters]
  )

  const applyClusterUpdate = useCallback((updated: MediaReviewCluster): void => {
    setClusters(previous =>
      previous.map(cluster => (cluster.id === updated.id ? updated : cluster))
    )
  }, [])

  const changeBatchStatus = useCallback(
    async (status: MediaReviewBatchStatus): Promise<void> => {
      if (!selectedBatch) return
      setUpdating(true)
      setError(null)
      try {
        const updated = await data.updateBatchStatus(selectedBatch.id, status)
        setBatches(previous => previous.map(batch => (batch.id === updated.id ? updated : batch)))
        setStatusMessage(`Batch status set to ${status.replace('_', ' ')}.`)
      } catch (updateError) {
        console.error('People review: could not update the batch status.', updateError)
        setError('Could not update the batch status.')
      } finally {
        setUpdating(false)
      }
    },
    [data, selectedBatch]
  )

  const saveClusterName = useCallback(async (): Promise<void> => {
    if (!selectedCluster) return
    setUpdating(true)
    setError(null)
    try {
      const updated = await data.updateCluster(
        selectedCluster.id,
        buildClusterRenamePatch(clusterNameDraft)
      )
      applyClusterUpdate(updated)
      setStatusMessage(
        updated.confirmedName
          ? `Saved "${updated.confirmedName}" as the confirmed name.`
          : 'Cluster name cleared; faces stay in review.'
      )
    } catch (updateError) {
      console.error('People review: could not save the cluster name.', updateError)
      setError('Could not save the cluster name.')
    } finally {
      setUpdating(false)
    }
  }, [applyClusterUpdate, clusterNameDraft, data, selectedCluster])

  const mergeSelectedCluster = useCallback(
    async (targetClusterId: string): Promise<void> => {
      if (!selectedCluster || !targetClusterId) return
      setUpdating(true)
      setError(null)
      try {
        const updated = await data.updateCluster(
          selectedCluster.id,
          buildClusterMergePatch(targetClusterId)
        )
        applyClusterUpdate(updated)
        setStatusMessage(`Merged ${clusterDisplayName(selectedCluster)} into the target cluster.`)
      } catch (updateError) {
        console.error('People review: could not merge the cluster.', updateError)
        setError('Could not merge the cluster.')
      } finally {
        setUpdating(false)
      }
    },
    [applyClusterUpdate, data, selectedCluster]
  )

  const applyFaceUpdates = useCallback((updatedFaces: readonly MediaReviewFace[]): void => {
    const updatedById = new Map(updatedFaces.map(face => [face.id, face]))
    setFaces(previous => previous.map(face => updatedById.get(face.id) ?? face))
  }, [])

  const confirmFace = useCallback(
    async (face: MediaReviewFace): Promise<void> => {
      if (!selectedCluster) return
      const name = (selectedCluster.confirmedName?.trim() || clusterNameDraft.trim()) ?? ''
      if (!name) {
        setError('Name the cluster before confirming its faces.')
        return
      }

      setUpdating(true)
      setError(null)
      try {
        const updated = await data.updateFaces([face.id], buildFaceConfirmPatch(name))
        applyFaceUpdates(updated)
        setStatusMessage(`Confirmed ${name} on this face.`)
      } catch (updateError) {
        console.error('People review: could not confirm the face.', updateError)
        setError('Could not confirm the face.')
      } finally {
        setUpdating(false)
      }
    },
    [applyFaceUpdates, clusterNameDraft, data, selectedCluster]
  )

  const unconfirmFace = useCallback(
    async (face: MediaReviewFace): Promise<void> => {
      setUpdating(true)
      setError(null)
      try {
        const updated = await data.updateFaces([face.id], buildFaceUnconfirmPatch())
        applyFaceUpdates(updated)
        setStatusMessage('Face returned to the review queue.')
      } catch (updateError) {
        console.error('People review: could not unconfirm the face.', updateError)
        setError('Could not unconfirm the face.')
      } finally {
        setUpdating(false)
      }
    },
    [applyFaceUpdates, data]
  )

  const confirmClusterFaces = useCallback(async (): Promise<void> => {
    if (!selectedCluster) return
    const name = (selectedCluster.confirmedName?.trim() || clusterNameDraft.trim()) ?? ''
    if (!name) {
      setError('Name the cluster before confirming its faces.')
      return
    }
    if (clusterFaces.length === 0) return

    setUpdating(true)
    setError(null)
    try {
      const updated = await data.updateFaces(
        clusterFaces.map(face => face.id),
        buildFaceConfirmPatch(name)
      )
      applyFaceUpdates(updated)
      setStatusMessage(`Confirmed ${name} on ${clusterFaces.length} faces.`)
    } catch (updateError) {
      console.error('People review: could not confirm the cluster faces.', updateError)
      setError('Could not confirm the cluster faces.')
    } finally {
      setUpdating(false)
    }
  }, [applyFaceUpdates, clusterFaces, clusterNameDraft, data, selectedCluster])

  const refresh = useCallback((): void => {
    void loadBatches()
    if (selectedBatchId) void loadBatchDetails(selectedBatchId)
  }, [loadBatchDetails, loadBatches, selectedBatchId])

  return {
    batches,
    batchesLoading,
    reviewLoading,
    selectedBatch,
    selectedBatchId,
    clusters,
    faces,
    selectedCluster,
    selectedClusterId,
    clusterFaces,
    mergeTargetOptions,
    clusterNameDraft,
    pendingFaceCount,
    unsavedName,
    updating,
    statusMessage,
    error,
    selectBatch,
    selectCluster,
    setClusterNameDraft,
    refresh,
    changeBatchStatus,
    saveClusterName,
    mergeSelectedCluster,
    confirmFace,
    unconfirmFace,
    confirmClusterFaces,
  }
}
