import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  GitMerge,
  RefreshCw,
  Save,
  Scissors,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import {
  createMediaReviewArtifactSignedUrl,
  downloadMediaReviewArtifact,
  fetchMediaReviewBatches,
  fetchMediaReviewClusters,
  supabase,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
  type MediaReviewCluster,
  type MediaReviewClusterMember,
  type Photo as SupabasePhoto,
  type PhotoFace,
  updateMediaReviewBatchStatus,
  updateMediaReviewCluster,
} from '@/lib/supabase'

interface ReviewImportManifestRow {
  sourceRecordId: string | null
  collection: string
  category: string
  storyLaneSuggestion: string | null
  tags: string[]
  photoRowDraft: {
    url: string
    thumbnail: string
    category: string
    location: string | null
    date: string | null
    photographer?: string | null
    is_professional?: boolean
    tags: string[]
    faces: Array<{ id: string; name: string; x: number; y: number }>
  }
}

interface ClusterDraft {
  reviewStatus: MediaReviewCluster['review_status']
  confirmedName: string
  mergeIntoClusterId: string
  splitNotes: string
}

interface PhotoRowForReview extends Pick<SupabasePhoto, 'id' | 'url' | 'thumbnail' | 'category' | 'location' | 'date' | 'tags' | 'faces'> {}

function toSiteMediaPath(relativePath: string) {
  return `/media/${relativePath.replace(/^\/+/, '')}`
}

function normalizeClusterDraft(cluster: MediaReviewCluster): ClusterDraft {
  return {
    reviewStatus: cluster.review_status,
    confirmedName: cluster.confirmed_name || '',
    mergeIntoClusterId: cluster.merge_into_cluster_id || '',
    splitNotes: cluster.split_notes || '',
  }
}

function normalizeMember(member: MediaReviewClusterMember) {
  return {
    ...member,
    x: typeof member.x === 'number' ? member.x : member.box?.x ?? 0,
    y: typeof member.y === 'number' ? member.y : member.box?.y ?? 0,
  }
}

function mergeFaces(existingFaces: PhotoFace[], cluster: MediaReviewCluster, members: MediaReviewClusterMember[]): PhotoFace[] {
  const baseFaces = existingFaces.filter((face) => !String(face.id || '').startsWith(`${cluster.cluster_id}-`))
  const nextFaces = members.map((member, index) => {
    const normalized = normalizeMember(member)
    return {
      id: `${cluster.cluster_id}-${index + 1}`,
      name: cluster.confirmed_name || 'Unknown',
      x: normalized.x,
      y: normalized.y,
    }
  })

  return [...baseFaces, ...nextFaces]
}

async function readJsonArtifact<T>(batch: MediaReviewBatch, artifactKey: string): Promise<T | null> {
  const objectPath = String(batch.artifact_paths?.[artifactKey] || '')
  if (!objectPath) return null

  const { data, error } = await downloadMediaReviewArtifact(batch.artifact_bucket, objectPath)
  if (error || !data) {
    return null
  }

  return JSON.parse(await data.text()) as T
}

export function MediaReviewPanel() {
  const [batches, setBatches] = useState<MediaReviewBatch[]>([])
  const [clusters, setClusters] = useState<MediaReviewCluster[]>([])
  const [clusterDrafts, setClusterDrafts] = useState<Record<string, ClusterDraft>>({})
  const [samplePreviewUrls, setSamplePreviewUrls] = useState<Record<string, string>>({})
  const [memberPreviewUrls, setMemberPreviewUrls] = useState<Record<string, string>>({})
  const [importRows, setImportRows] = useState<ReviewImportManifestRow[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingClusterId, setSavingClusterId] = useState<string | null>(null)
  const [syncingBatchId, setSyncingBatchId] = useState<string | null>(null)
  const { addToast } = useToast()

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) || null,
    [batches, selectedBatchId],
  )

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === selectedClusterId) || null,
    [clusters, selectedClusterId],
  )

  const loadBatches = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchMediaReviewBatches()

    if (error) {
      addToast('Could not load review batches.', 'error')
      setLoading(false)
      return
    }

    const nextBatches = data || []
    setBatches(nextBatches)
    setSelectedBatchId((current) => current || nextBatches[0]?.id || null)
    setLoading(false)
  }, [addToast])

  const loadBatchDetails = useCallback(async (batch: MediaReviewBatch) => {
    const [{ data: clusterRows, error: clusterError }, importManifest] = await Promise.all([
      fetchMediaReviewClusters(batch.id),
      readJsonArtifact<ReviewImportManifestRow[]>(batch, 'importManifest'),
    ])

    if (clusterError) {
      addToast('Could not load clusters for this batch.', 'error')
      return
    }

    const nextClusters = clusterRows || []
    setClusters(nextClusters)
    setImportRows(importManifest || [])
    setClusterDrafts(
      Object.fromEntries(nextClusters.map((cluster) => [cluster.id, normalizeClusterDraft(cluster)])),
    )
    setSelectedClusterId((current) => current || nextClusters[0]?.id || null)

    const previewPairs = await Promise.all(
      nextClusters.map(async (cluster) => {
        if (!cluster.sample_thumbnail_path) return [cluster.id, '']

        const { data } = await createMediaReviewArtifactSignedUrl(
          batch.artifact_bucket,
          cluster.sample_thumbnail_path,
          60 * 30,
        )

        return [cluster.id, data?.signedUrl || '']
      }),
    )

    setSamplePreviewUrls(Object.fromEntries(previewPairs.filter(([, value]) => value)))
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBatches()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadBatches])

  useEffect(() => {
    if (!selectedBatch) return

    const timeoutId = window.setTimeout(() => {
      void loadBatchDetails(selectedBatch)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadBatchDetails, selectedBatch])

  useEffect(() => {
    const batch = selectedBatch
    const cluster = selectedCluster
    let disposed = false
    const timeoutId = window.setTimeout(() => {
      if (!batch || !cluster) {
        setMemberPreviewUrls({})
        return
      }

      const activeBatch: MediaReviewBatch = batch
      const activeCluster: MediaReviewCluster = cluster

      async function loadMemberPreviews() {
        const pairs = await Promise.all(
          activeCluster.members.slice(0, 12).map(async (member) => {
            if (!member.thumbnailObjectPath) {
              return [member.faceId || member.sourceRelativePath || 'missing-thumbnail', '']
            }

            const { data } = await createMediaReviewArtifactSignedUrl(
              activeBatch.artifact_bucket,
              member.thumbnailObjectPath,
              60 * 30,
            )

            return [member.faceId || member.sourceRelativePath || member.thumbnailObjectPath, data?.signedUrl || '']
          }),
        )

        if (!disposed) {
          setMemberPreviewUrls(Object.fromEntries(pairs.filter(([, value]) => value)))
        }
      }

      void loadMemberPreviews()
    }, 0)

    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
    }
  }, [selectedBatch, selectedCluster])

  function updateDraft(clusterId: string, patch: Partial<ClusterDraft>) {
    setClusterDrafts((prev) => ({
      ...prev,
      [clusterId]: {
        ...(prev[clusterId] || {
          reviewStatus: 'pending',
          confirmedName: '',
          mergeIntoClusterId: '',
          splitNotes: '',
        }),
        ...patch,
      },
    }))
  }

  async function handleSaveCluster(cluster: MediaReviewCluster) {
    const draft = clusterDrafts[cluster.id] || normalizeClusterDraft(cluster)

    if (draft.reviewStatus === 'confirmed' && !draft.confirmedName.trim()) {
      addToast('Confirmed clusters need a person name before saving.', 'warning')
      return
    }

    if (draft.reviewStatus === 'merged' && !draft.mergeIntoClusterId.trim()) {
      addToast('Merged clusters need a target cluster id.', 'warning')
      return
    }

    setSavingClusterId(cluster.id)

    const { data, error } = await updateMediaReviewCluster(cluster.id, {
      reviewStatus: draft.reviewStatus,
      confirmedName: draft.confirmedName.trim() || null,
      mergeIntoClusterId: draft.mergeIntoClusterId.trim() || null,
      splitRequested: draft.reviewStatus === 'split_requested',
      splitNotes: draft.splitNotes.trim() || null,
    })

    if (error || !data) {
      addToast('Could not save that cluster review decision.', 'error')
      setSavingClusterId(null)
      return
    }

    setClusters((prev) => prev.map((item) => (item.id === cluster.id ? data : item)))
    addToast('Cluster review decision saved.', 'success')
    setSavingClusterId(null)
  }

  async function handleBatchStatusChange(batch: MediaReviewBatch, status: MediaReviewBatchStatus) {
    const { data, error } = await updateMediaReviewBatchStatus(batch.id, status)

    if (error || !data) {
      addToast('Could not update the batch status.', 'error')
      return
    }

    setBatches((prev) => prev.map((item) => (item.id === batch.id ? data : item)))
    addToast(`Batch marked ${status.replace('_', ' ')}.`, 'success')
  }

  async function handleSyncManifestMetadata(batch: MediaReviewBatch) {
    setSyncingBatchId(batch.id)

    const urls = importRows.map((row) => toSiteMediaPath(row.photoRowDraft.url))
    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('id, url, thumbnail, category, location, date, tags, faces')
      .in('url', urls)
      .returns<PhotoRowForReview[]>()

    if (photoError) {
      addToast('Could not load the published photos for this batch.', 'error')
      setSyncingBatchId(null)
      return
    }

    const updates = (photos || []).flatMap((photo) => {
      const row = importRows.find((item) => toSiteMediaPath(item.photoRowDraft.url) === photo.url)
      if (!row) return []

      return [
        {
          id: photo.id,
          thumbnail: toSiteMediaPath(row.photoRowDraft.thumbnail),
          category: row.photoRowDraft.category,
          location: row.photoRowDraft.location,
          date: row.photoRowDraft.date,
          tags: row.photoRowDraft.tags,
        },
      ]
    })

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('photos')
        .upsert(updates, { onConflict: 'id' })

      if (updateError) {
        addToast('Could not sync the manifest metadata back into photos.', 'error')
        setSyncingBatchId(null)
        return
      }
    }

    await handleBatchStatusChange(batch, 'in_review')
    addToast('Manifest category, tag, and story-tag suggestions were synced to the live photos.', 'success')
    setSyncingBatchId(null)
  }

  async function handleApplyConfirmedFaces(batch: MediaReviewBatch) {
    setSyncingBatchId(batch.id)

    const confirmedClusters = clusters.filter(
      (cluster) => cluster.review_status === 'confirmed' && cluster.confirmed_name,
    )

    if (confirmedClusters.length === 0) {
      addToast('There are no confirmed clusters to apply yet.', 'warning')
      setSyncingBatchId(null)
      return
    }

    const manifestBySourceRecordId = new Map(
      importRows
        .filter((row) => row.sourceRecordId)
        .map((row) => [row.sourceRecordId as string, row]),
    )

    const urls = importRows.map((row) => toSiteMediaPath(row.photoRowDraft.url))
    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('id, url, thumbnail, category, location, date, tags, faces')
      .in('url', urls)
      .returns<PhotoRowForReview[]>()

    if (photoError) {
      addToast('Could not load the published photos for face-tag promotion.', 'error')
      setSyncingBatchId(null)
      return
    }

    const photoByUrl = new Map((photos || []).map((photo) => [photo.url, photo]))
    const pendingUpdates = new Map<string, PhotoRowForReview & { tags: string[]; faces: PhotoFace[] }>()

    for (const cluster of confirmedClusters) {
      const membersByRecordId = new Map<string, MediaReviewClusterMember[]>()

      for (const member of cluster.members) {
        if (!member.sourceRecordId) continue
        const current = membersByRecordId.get(member.sourceRecordId) || []
        current.push(member)
        membersByRecordId.set(member.sourceRecordId, current)
      }

      for (const [sourceRecordId, members] of membersByRecordId.entries()) {
        const manifestRow = manifestBySourceRecordId.get(sourceRecordId)
        if (!manifestRow) continue

        const url = toSiteMediaPath(manifestRow.photoRowDraft.url)
        const currentPhoto = pendingUpdates.get(url) || photoByUrl.get(url)
        if (!currentPhoto) continue

        const existingFaces = Array.isArray(currentPhoto.faces) ? currentPhoto.faces : []
        const existingTags = Array.isArray(currentPhoto.tags) ? currentPhoto.tags : []
        const mergedFaces = mergeFaces(existingFaces, cluster, members)
        const mergedTags = Array.from(
          new Set([
            ...existingTags,
            ...manifestRow.photoRowDraft.tags,
            (cluster.confirmed_name || 'unknown').toLowerCase(),
          ]),
        )

        pendingUpdates.set(url, {
          ...currentPhoto,
          tags: mergedTags,
          faces: mergedFaces,
        })
      }
    }

    const updates = [...pendingUpdates.values()].map((photo) => ({
      id: photo.id,
      tags: photo.tags,
      faces: photo.faces,
    }))

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('photos')
        .upsert(updates, { onConflict: 'id' })

      if (updateError) {
        addToast('Could not apply the confirmed face tags to the live photos.', 'error')
        setSyncingBatchId(null)
        return
      }
    }

    await handleBatchStatusChange(batch, 'approved')
    addToast(`Applied confirmed face tags from ${confirmedClusters.length} cluster${confirmedClusters.length === 1 ? '' : 's'}.`, 'success')
    setSyncingBatchId(null)
  }

  if (loading) {
    return <div className="rounded-xl border border-gold-100 bg-white p-8 text-center text-charcoal-500">Loading review batches…</div>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">People Review</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Review staged face clusters, confirm names, and promote approved decisions into the live gallery without exposing unresolved identities publicly.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Review batches</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">{batches.length}</p>
        </div>
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Clusters in batch</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">{selectedBatch?.cluster_count || 0}</p>
        </div>
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Confirmed clusters</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">
            {clusters.filter((cluster) => cluster.review_status === 'confirmed').length}
          </p>
        </div>
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Import-linked photos</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">{importRows.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="rounded-xl border border-gold-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-charcoal-900">Batches</h3>
            <Button size="sm" variant="secondary" onClick={() => void loadBatches()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="space-y-3">
            {batches.map((batch) => {
              const isActive = batch.id === selectedBatchId

              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => {
                    setSelectedBatchId(batch.id)
                    setSelectedClusterId(null)
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-gold-400 bg-gold-50'
                      : 'border-gold-100 bg-white hover:bg-cream-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-charcoal-900">{batch.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-charcoal-400">{batch.status.replace('_', ' ')}</p>
                    </div>
                    <Users className="h-4 w-4 text-charcoal-400" />
                  </div>
                  <p className="mt-3 text-xs text-charcoal-500">
                    {batch.cluster_count} clusters · {batch.detection_count} detections
                  </p>
                </button>
              )
            })}

            {batches.length === 0 && (
              <div className="rounded-xl border border-dashed border-gold-200 p-5 text-sm text-charcoal-500">
                No staged review batches yet. Run `npm run media:batch:review:push -- &lt;working-root&gt;` after the face-enrichment and export steps.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {selectedBatch ? (
            <>
              <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-charcoal-900">{selectedBatch.label}</h3>
                    <p className="mt-1 text-sm text-charcoal-500">
                      {selectedBatch.cluster_count} clusters staged in `{selectedBatch.artifact_bucket}`.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleBatchStatusChange(selectedBatch, 'pending')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Mark Pending
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleSyncManifestMetadata(selectedBatch)}
                      disabled={syncingBatchId === selectedBatch.id}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Metadata
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleApplyConfirmedFaces(selectedBatch)}
                      disabled={syncingBatchId === selectedBatch.id}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Apply Confirmed Faces
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-medium text-charcoal-900">Cluster Queue</h3>
                  <div className="mt-4 grid gap-3">
                    {clusters.map((cluster) => (
                      <button
                        key={cluster.id}
                        type="button"
                        onClick={() => setSelectedClusterId(cluster.id)}
                        className={`grid gap-3 rounded-xl border p-4 text-left transition-colors md:grid-cols-[5rem_minmax(0,1fr)] ${
                          selectedClusterId === cluster.id
                            ? 'border-gold-400 bg-gold-50'
                            : 'border-gold-100 bg-white hover:bg-cream-50'
                        }`}
                      >
                        <div className="overflow-hidden rounded-lg bg-cream-100">
                          {samplePreviewUrls[cluster.id] ? (
                            <img
                              src={samplePreviewUrls[cluster.id]}
                              alt={cluster.cluster_id}
                              className="h-20 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-20 items-center justify-center text-xs text-charcoal-400">No crop</div>
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-charcoal-900">
                              {cluster.confirmed_name || cluster.cluster_id}
                            </p>
                            <span className="rounded-full bg-charcoal-100 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-charcoal-500">
                              {cluster.review_status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-charcoal-500">
                            {cluster.member_count} members · quality {cluster.average_quality_score ?? 'n/a'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                  {selectedCluster ? (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-lg font-medium text-charcoal-900">{selectedCluster.cluster_id}</h3>
                        <p className="mt-1 text-sm text-charcoal-500">
                          Promote only confirmed names. Pending and split-requested clusters stay out of `photos.faces`.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <label
                          htmlFor={`confirmed-name-${selectedCluster.id}`}
                          className="block text-sm font-medium text-charcoal-700"
                        >
                          Confirmed name
                        </label>
                        <Input
                          id={`confirmed-name-${selectedCluster.id}`}
                          value={clusterDrafts[selectedCluster.id]?.confirmedName || ''}
                          onChange={(event) => updateDraft(selectedCluster.id, { confirmedName: event.target.value })}
                          placeholder="Austin"
                        />
                      </div>

                      <div className="space-y-3">
                        <p className="block text-sm font-medium text-charcoal-700">Decision</p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            ['pending', 'Pending'],
                            ['confirmed', 'Confirmed'],
                            ['ignored', 'Ignore'],
                            ['merged', 'Merged'],
                            ['split_requested', 'Needs split'],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => updateDraft(selectedCluster.id, { reviewStatus: value })}
                              className={`rounded-full px-3 py-2 text-sm transition-colors ${
                                clusterDrafts[selectedCluster.id]?.reviewStatus === value
                                  ? 'bg-gold-500 text-white'
                                  : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50'
                              }`}
                            >
                              {value === 'merged' ? <GitMerge className="mr-2 inline h-4 w-4" /> : null}
                              {value === 'split_requested' ? <Scissors className="mr-2 inline h-4 w-4" /> : null}
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {clusterDrafts[selectedCluster.id]?.reviewStatus === 'merged' && (
                        <div className="space-y-3">
                          <label
                            htmlFor={`merge-cluster-${selectedCluster.id}`}
                            className="block text-sm font-medium text-charcoal-700"
                          >
                            Merge into cluster
                          </label>
                          <Input
                            id={`merge-cluster-${selectedCluster.id}`}
                            value={clusterDrafts[selectedCluster.id]?.mergeIntoClusterId || ''}
                            onChange={(event) => updateDraft(selectedCluster.id, { mergeIntoClusterId: event.target.value })}
                            placeholder="cluster-abc123"
                          />
                        </div>
                      )}

                      {clusterDrafts[selectedCluster.id]?.reviewStatus === 'split_requested' && (
                        <div className="space-y-3">
                          <label
                            htmlFor={`split-notes-${selectedCluster.id}`}
                            className="block text-sm font-medium text-charcoal-700"
                          >
                            Split notes
                          </label>
                          <Textarea
                            id={`split-notes-${selectedCluster.id}`}
                            value={clusterDrafts[selectedCluster.id]?.splitNotes || ''}
                            onChange={(event) => updateDraft(selectedCluster.id, { splitNotes: event.target.value })}
                            placeholder="Two different bridesmaids appear in this cluster. Split after re-running tighter embeddings."
                          />
                        </div>
                      )}

                      <Button
                        onClick={() => void handleSaveCluster(selectedCluster)}
                        disabled={savingClusterId === selectedCluster.id}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Cluster Decision
                      </Button>

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-charcoal-700">Member crops</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedCluster.members.slice(0, 12).map((member) => {
                            const previewKey = member.faceId || member.sourceRelativePath || member.thumbnailObjectPath || ''

                            return (
                              <div key={previewKey} className="overflow-hidden rounded-xl border border-gold-100 bg-cream-50">
                                {memberPreviewUrls[previewKey] ? (
                                  <img
                                    src={memberPreviewUrls[previewKey]}
                                    alt={member.sourceRelativePath || selectedCluster.cluster_id}
                                    className="h-28 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-28 items-center justify-center text-xs text-charcoal-400">No crop</div>
                                )}
                                <div className="p-3">
                                  <p className="truncate text-xs font-medium text-charcoal-700">
                                    {member.sourceRelativePath || 'Unknown source'}
                                  </p>
                                  <p className="mt-1 text-[11px] text-charcoal-500">
                                    {(member.sourceRecordId || 'No record id').slice(0, 16)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gold-200 p-6 text-sm text-charcoal-500">
                      Select a cluster to review its name, merge/split decision, and member crops.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-200 bg-white p-8 text-sm text-charcoal-500">
              Push a review bundle first, then this page will list staged batches for admin review.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
