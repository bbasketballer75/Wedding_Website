import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
  Save,
  Tags,
  Users,
  UserRoundSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import {
  createMediaReviewArtifactSignedUrl,
  downloadMediaReviewArtifact,
  fetchMediaReviewBatches,
  fetchMediaReviewFaces,
  supabase,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
  type MediaReviewFace,
  type MediaReviewFaceStatus,
  type Photo as SupabasePhoto,
  type PhotoFace,
  updateManyMediaReviewFaces,
  updateMediaReviewBatchStatus,
  updateMediaReviewFace,
} from '@/lib/supabase'

interface ReviewImportManifestRow {
  sourceRecordId: string | null
  sourceRelativePath: string
  collection: string
  category: string
  storyLaneSuggestion: string | null
  duplicateGroupId: string | null
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

interface FaceDraft {
  reviewStatus: MediaReviewFaceStatus
  confirmedName: string
  personKey: string
  notes: string
}

interface PhotoRowForReview extends Pick<SupabasePhoto, 'id' | 'url' | 'thumbnail' | 'category' | 'location' | 'date' | 'tags' | 'faces'> {}

interface ReviewPhotoRecord {
  key: string
  sourceRecordId: string | null
  sourceRelativePath: string
  photoUrl: string
  thumbnailUrl: string
  collection: string
  storyLaneSuggestion: string | null
  duplicateGroupId: string | null
  captureDate: string | null
  faces: MediaReviewFace[]
  pendingCount: number
  confirmedCount: number
  ignoredCount: number
}

interface PersonGroup {
  key: string
  label: string
  faceIds: string[]
  faces: MediaReviewFace[]
  pendingCount: number
  confirmedCount: number
  ignoredCount: number
  clusterCount: number
}

const PHOTO_LOOKUP_CHUNK_SIZE = 40
const PHOTO_LIST_LIMIT = 250
const PERSON_GROUP_SAMPLE_LIMIT = 60

function toSiteMediaPath(relativePath: string) {
  return `/media/${relativePath.replace(/^\/+/, '')}`
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function slugifyPerson(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getMetadataValue<T>(face: MediaReviewFace, key: string): T | null {
  if (!face.metadata || typeof face.metadata !== 'object') return null
  const value = face.metadata[key]
  return value == null ? null : (value as T)
}

function getFaceLabel(face: MediaReviewFace) {
  return face.confirmed_name || getMetadataValue<string>(face, 'suggestedLabel') || face.cluster_id || face.face_id
}

function getFacePhotoStatus(face: MediaReviewFace, draft?: FaceDraft) {
  return draft?.reviewStatus || face.review_status
}

function normalizeFaceDraft(face: MediaReviewFace): FaceDraft {
  const confirmedName = face.confirmed_name || ''
  return {
    reviewStatus: face.review_status,
    confirmedName,
    personKey: face.person_key || (confirmedName ? slugifyPerson(confirmedName) : ''),
    notes: face.notes || '',
  }
}

function draftChanged(face: MediaReviewFace, draft: FaceDraft) {
  const normalized = normalizeFaceDraft(face)
  return (
    normalized.reviewStatus !== draft.reviewStatus ||
    normalized.confirmedName !== draft.confirmedName ||
    normalized.personKey !== draft.personKey ||
    normalized.notes !== draft.notes
  )
}

async function persistPhotoUpdates(
  updates: Array<Record<string, unknown> & { id: string }>,
) {
  for (const update of updates) {
    const { id, ...fields } = update
    const { error } = await supabase
      .from('photos')
      .update(fields)
      .eq('id', id)

    if (error) {
      return { error }
    }
  }

  return { error: null }
}

async function fetchPhotosForReview(urls: string[]) {
  const photos: PhotoRowForReview[] = []

  for (const urlChunk of chunkItems(urls, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, thumbnail, category, location, date, tags, faces')
      .in('url', urlChunk)
      .returns<PhotoRowForReview[]>()

    if (error) {
      return { data: null, error }
    }

    photos.push(...(data || []))
  }

  return { data: photos, error: null }
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

function sortFaces(left: MediaReviewFace, right: MediaReviewFace) {
  const statusWeight = { pending: 0, confirmed: 1, ignored: 2 }
  const leftWeight = statusWeight[left.review_status]
  const rightWeight = statusWeight[right.review_status]

  if (leftWeight !== rightWeight) {
    return leftWeight - rightWeight
  }

  const leftQuality = left.quality_score ?? 0
  const rightQuality = right.quality_score ?? 0
  if (leftQuality !== rightQuality) {
    return rightQuality - leftQuality
  }

  return getFaceLabel(left).localeCompare(getFaceLabel(right))
}

function buildPhotoRecords(
  faces: MediaReviewFace[],
  importRows: ReviewImportManifestRow[],
) {
  const importRowByRecordId = new Map(
    importRows
      .filter((row) => row.sourceRecordId)
      .map((row) => [row.sourceRecordId as string, row]),
  )
  const photoMap = new Map<string, ReviewPhotoRecord>()

  for (const face of faces) {
    const importRow = face.source_record_id ? importRowByRecordId.get(face.source_record_id) : null
    const photoKey = face.source_record_id || face.photo_url || face.face_id
    const existing = photoMap.get(photoKey)
    const record: ReviewPhotoRecord = existing || {
      key: photoKey,
      sourceRecordId: face.source_record_id || null,
      sourceRelativePath: face.source_relative_path || importRow?.sourceRelativePath || 'Unknown source',
      photoUrl: face.photo_url || (importRow ? toSiteMediaPath(importRow.photoRowDraft.url) : ''),
      thumbnailUrl: face.thumbnail_url || (importRow ? toSiteMediaPath(importRow.photoRowDraft.thumbnail) : face.photo_url || ''),
      collection: String(getMetadataValue<string>(face, 'collection') || importRow?.collection || 'Uncategorized'),
      storyLaneSuggestion: getMetadataValue<string>(face, 'storyLaneSuggestion') || importRow?.storyLaneSuggestion || null,
      duplicateGroupId: String(getMetadataValue<string>(face, 'duplicateGroupId') || importRow?.duplicateGroupId || '') || null,
      captureDate: String(getMetadataValue<string>(face, 'captureDate') || importRow?.photoRowDraft.date || '') || null,
      faces: [],
      pendingCount: 0,
      confirmedCount: 0,
      ignoredCount: 0,
    }

    record.faces.push(face)
    if (face.review_status === 'confirmed') record.confirmedCount += 1
    else if (face.review_status === 'ignored') record.ignoredCount += 1
    else record.pendingCount += 1

    photoMap.set(photoKey, record)
  }

  return [...photoMap.values()]
    .map((record) => ({
      ...record,
      faces: [...record.faces].sort(sortFaces),
    }))
    .sort((left, right) => {
      if (left.pendingCount !== right.pendingCount) {
        return right.pendingCount - left.pendingCount
      }

      if (left.confirmedCount !== right.confirmedCount) {
        return right.confirmedCount - left.confirmedCount
      }

      return left.sourceRelativePath.localeCompare(right.sourceRelativePath)
    })
}

function buildPersonGroups(faces: MediaReviewFace[]) {
  const groups = new Map<string, PersonGroup>()

  for (const face of faces) {
    const confirmedName = face.confirmed_name || ''
    const groupKey =
      face.person_key ||
      (confirmedName ? slugifyPerson(confirmedName) : '') ||
      face.cluster_id ||
      face.face_id

    const label = confirmedName || face.person_key || face.cluster_id || 'Unassigned'
    const current = groups.get(groupKey) || {
      key: groupKey,
      label,
      faceIds: [],
      faces: [],
      pendingCount: 0,
      confirmedCount: 0,
      ignoredCount: 0,
      clusterCount: 0,
    }

    current.faceIds.push(face.id)
    current.faces.push(face)
    if (face.review_status === 'confirmed') current.confirmedCount += 1
    else if (face.review_status === 'ignored') current.ignoredCount += 1
    else current.pendingCount += 1

    groups.set(groupKey, current)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      faces: [...group.faces].sort(sortFaces),
      clusterCount: new Set(group.faces.map((face) => face.cluster_id).filter(Boolean)).size,
    }))
    .sort((left, right) => {
      if (left.pendingCount !== right.pendingCount) {
        return right.pendingCount - left.pendingCount
      }

      if (left.faces.length !== right.faces.length) {
        return right.faces.length - left.faces.length
      }

      return left.label.localeCompare(right.label)
    })
}

function getStatusBadgeClasses(status: MediaReviewFaceStatus) {
  switch (status) {
    case 'confirmed':
      return 'border-green-200 bg-green-50 text-green-700'
    case 'ignored':
      return 'border-charcoal-200 bg-charcoal-50 text-charcoal-600'
    default:
      return 'border-gold-200 bg-gold-50 text-gold-700'
  }
}

function getOverlayStyle(face: MediaReviewFace) {
  const dimensions = getMetadataValue<Record<string, unknown>>(face, 'detectionDimensions')
  const width = typeof dimensions?.width === 'number' ? dimensions.width : null
  const height = typeof dimensions?.height === 'number' ? dimensions.height : null
  const box = face.box || {}
  const left = typeof box.left === 'number' ? box.left : null
  const top = typeof box.top === 'number' ? box.top : null
  const boxWidth = typeof box.width === 'number' ? box.width : null
  const boxHeight = typeof box.height === 'number' ? box.height : null

  if (width && height && left != null && top != null && boxWidth != null && boxHeight != null) {
    return {
      left: `${(left / width) * 100}%`,
      top: `${(top / height) * 100}%`,
      width: `${(boxWidth / width) * 100}%`,
      height: `${(boxHeight / height) * 100}%`,
      transform: 'none',
    }
  }

  return {
    left: `${face.x}%`,
    top: `${face.y}%`,
    width: '1.25rem',
    height: '1.25rem',
    transform: 'translate(-50%, -50%)',
  }
}

export function MediaReviewPanel() {
  const [batches, setBatches] = useState<MediaReviewBatch[]>([])
  const [faces, setFaces] = useState<MediaReviewFace[]>([])
  const [faceDrafts, setFaceDrafts] = useState<Record<string, FaceDraft>>({})
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedPhotoKey, setSelectedPhotoKey] = useState<string | null>(null)
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [photoSearch, setPhotoSearch] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [photoStatusFilter, setPhotoStatusFilter] = useState<'all' | MediaReviewFaceStatus>('pending')
  const [mode, setMode] = useState<'photos' | 'people'>('photos')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [syncingBatchId, setSyncingBatchId] = useState<string | null>(null)
  const [importRows, setImportRows] = useState<ReviewImportManifestRow[]>([])
  const [cropPreviewUrls, setCropPreviewUrls] = useState<Record<string, string>>({})
  const { addToast } = useToast()

  const deferredPhotoSearch = useDeferredValue(photoSearch)
  const deferredPersonSearch = useDeferredValue(personSearch)

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) || null,
    [batches, selectedBatchId],
  )

  const knownPeople = useMemo(
    () => Array.from(
      new Set(
        faces
          .map((face) => face.confirmed_name?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((left, right) => left.localeCompare(right)),
    [faces],
  )

  const photoRecords = useMemo(
    () => buildPhotoRecords(faces, importRows),
    [faces, importRows],
  )

  const filteredPhotos = useMemo(() => {
    const query = deferredPhotoSearch.trim().toLowerCase()

    return photoRecords.filter((photo) => {
      const matchesStatus =
        photoStatusFilter === 'all'
          ? true
          : photo.faces.some((face) => getFacePhotoStatus(face, faceDrafts[face.id]) === photoStatusFilter)

      if (!matchesStatus) return false
      if (!query) return true

      return [
        photo.sourceRelativePath,
        photo.collection,
        photo.storyLaneSuggestion,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [deferredPhotoSearch, faceDrafts, photoRecords, photoStatusFilter])

  const visiblePhotos = useMemo(
    () => filteredPhotos.slice(0, PHOTO_LIST_LIMIT),
    [filteredPhotos],
  )

  const selectedPhoto = useMemo(
    () => visiblePhotos.find((photo) => photo.key === selectedPhotoKey) || filteredPhotos.find((photo) => photo.key === selectedPhotoKey) || null,
    [filteredPhotos, selectedPhotoKey, visiblePhotos],
  )

  const selectedFace = useMemo(
    () => selectedPhoto?.faces.find((face) => face.id === selectedFaceId) || selectedPhoto?.faces[0] || null,
    [selectedFaceId, selectedPhoto],
  )

  const personGroups = useMemo(
    () => buildPersonGroups(faces),
    [faces],
  )

  const filteredGroups = useMemo(() => {
    const query = deferredPersonSearch.trim().toLowerCase()
    if (!query) return personGroups

    return personGroups.filter((group) => {
      return [
        group.label,
        group.key,
        ...group.faces.map((face) => face.source_relative_path || ''),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [deferredPersonSearch, personGroups])

  const selectedGroup = useMemo(
    () => filteredGroups.find((group) => group.key === selectedGroupKey) || personGroups.find((group) => group.key === selectedGroupKey) || null,
    [filteredGroups, personGroups, selectedGroupKey],
  )

  const selectedGroupDraft = useMemo(() => {
    if (!selectedGroup) return null

    const firstFace = selectedGroup.faces[0]
    const firstDraft = faceDrafts[firstFace.id] || normalizeFaceDraft(firstFace)

    return {
      confirmedName: firstDraft.confirmedName,
      personKey: firstDraft.personKey || (firstDraft.confirmedName ? slugifyPerson(firstDraft.confirmedName) : ''),
      notes: firstDraft.notes,
    }
  }, [faceDrafts, selectedGroup])

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
    const [{ data: faceRows, error: faceError }, importManifest] = await Promise.all([
      fetchMediaReviewFaces(batch.id),
      readJsonArtifact<ReviewImportManifestRow[]>(batch, 'importManifest'),
    ])

    if (faceError) {
      addToast('Could not load face review rows for this batch.', 'error')
      return
    }

    const nextFaces = faceRows || []
    const nextImportRows = importManifest || []
    const nextPhotos = buildPhotoRecords(nextFaces, nextImportRows)
    const nextGroups = buildPersonGroups(nextFaces)

    setFaces(nextFaces)
    setImportRows(nextImportRows)
    setFaceDrafts(Object.fromEntries(nextFaces.map((face) => [face.id, normalizeFaceDraft(face)])))
    setSelectedPhotoKey((current) => current || nextPhotos[0]?.key || null)
    setSelectedFaceId((current) => current || nextPhotos[0]?.faces[0]?.id || null)
    setSelectedGroupKey((current) => current || nextGroups[0]?.key || null)
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
    const facesToPreview = mode === 'photos'
      ? selectedPhoto?.faces || []
      : selectedGroup?.faces.slice(0, PERSON_GROUP_SAMPLE_LIMIT) || []

    if (!selectedBatch || facesToPreview.length === 0) {
      setCropPreviewUrls({})
      return
    }

    const activeBatch = selectedBatch
    let disposed = false
    const timeoutId = window.setTimeout(() => {
      async function loadPreviews() {
        const pairs = await Promise.all(
          facesToPreview.map(async (face) => {
            if (!face.thumbnail_object_path) {
              return [face.id, ''] as const
            }

            const { data } = await createMediaReviewArtifactSignedUrl(
              activeBatch.artifact_bucket,
              face.thumbnail_object_path,
              60 * 30,
            )

            return [face.id, data?.signedUrl || ''] as const
          }),
        )

        if (!disposed) {
          setCropPreviewUrls(Object.fromEntries(pairs.filter(([, value]) => value)))
        }
      }

      void loadPreviews()
    }, 0)

    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
    }
  }, [mode, selectedBatch, selectedGroup, selectedPhoto])

  useEffect(() => {
    if (!selectedPhoto && filteredPhotos[0]) {
      setSelectedPhotoKey(filteredPhotos[0].key)
      setSelectedFaceId(filteredPhotos[0].faces[0]?.id || null)
    }
  }, [filteredPhotos, selectedPhoto])

  useEffect(() => {
    if (!selectedGroup && filteredGroups[0]) {
      setSelectedGroupKey(filteredGroups[0].key)
    }
  }, [filteredGroups, selectedGroup])

  function updateDraft(faceId: string, patch: Partial<FaceDraft>) {
    const face = faces.find((item) => item.id === faceId)
    setFaceDrafts((prev) => ({
      ...prev,
      [faceId]: {
        ...(prev[faceId] || (face ? normalizeFaceDraft(face) : {
          reviewStatus: 'pending',
          confirmedName: '',
          personKey: '',
          notes: '',
        })),
        ...patch,
      },
    }))
  }

  function replaceFaces(updatedFaces: MediaReviewFace[]) {
    const updatedById = new Map(updatedFaces.map((face) => [face.id, face]))
    setFaces((prev) => prev.map((face) => updatedById.get(face.id) || face))
    setFaceDrafts((prev) => ({
      ...prev,
      ...Object.fromEntries(updatedFaces.map((face) => [face.id, normalizeFaceDraft(face)])),
    }))
  }

  async function saveFaces(faceIds: string[]) {
    const uniqueFaceIds = [...new Set(faceIds)]
    const changedFaces = uniqueFaceIds
      .map((faceId) => {
        const face = faces.find((item) => item.id === faceId)
        const draft = faceDrafts[faceId]
        if (!face || !draft || !draftChanged(face, draft)) return null
        return { face, draft }
      })
      .filter(Boolean) as Array<{ face: MediaReviewFace; draft: FaceDraft }>

    if (changedFaces.length === 0) {
      addToast('There are no unsaved face changes in this selection.', 'warning')
      return
    }

    for (const { draft } of changedFaces) {
      if (draft.reviewStatus === 'confirmed' && !draft.confirmedName.trim()) {
        addToast('Confirmed faces need a person name before saving.', 'warning')
        return
      }
    }

    setSavingKey(uniqueFaceIds.join(':'))

    try {
      const savedFaces: MediaReviewFace[] = []

      for (const { face, draft } of changedFaces) {
        const confirmedName = draft.confirmedName.trim()
        const personKey = draft.personKey.trim() || (confirmedName ? slugifyPerson(confirmedName) : '')
        const { data, error } = await updateMediaReviewFace(face.id, {
          reviewStatus: draft.reviewStatus,
          confirmedName: confirmedName || null,
          personKey: personKey || null,
          notes: draft.notes.trim() || null,
        })

        if (error || !data) {
          throw error || new Error('Missing face update response')
        }

        savedFaces.push(data)
      }

      replaceFaces(savedFaces)
      addToast(`Saved ${savedFaces.length} face review change${savedFaces.length === 1 ? '' : 's'}.`, 'success')
    } catch {
      addToast('Could not save those face review changes.', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  async function handleApplyGroupDecision(status: MediaReviewFaceStatus) {
    if (!selectedGroup || !selectedGroupDraft) return

    if (status === 'confirmed' && !selectedGroupDraft.confirmedName.trim()) {
      addToast('Confirmed people groups need a person name before saving.', 'warning')
      return
    }

    const confirmedName = selectedGroupDraft.confirmedName.trim()
    const personKey = selectedGroupDraft.personKey.trim() || (confirmedName ? slugifyPerson(confirmedName) : '')

    setSavingKey(selectedGroup.key)
    const { data, error } = await updateManyMediaReviewFaces(selectedGroup.faceIds, {
      reviewStatus: status,
      confirmedName: confirmedName || null,
      personKey: personKey || null,
      notes: selectedGroupDraft.notes.trim() || null,
    })

    if (error || !data) {
      addToast('Could not apply the bulk group change.', 'error')
      setSavingKey(null)
      return
    }

    replaceFaces(data)
    addToast(`Updated ${data.length} face${data.length === 1 ? '' : 's'} in this group.`, 'success')
    setSavingKey(null)
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
    const { data: photos, error: photoError } = await fetchPhotosForReview(urls)

    if (photoError) {
      addToast('Could not load the published photos for this batch.', 'error')
      setSyncingBatchId(null)
      return
    }

    const updates = (photos || []).flatMap((photo) => {
      const row = importRows.find((item) => toSiteMediaPath(item.photoRowDraft.url) === photo.url)
      if (!row) return []

      return [{
        id: photo.id,
        thumbnail: toSiteMediaPath(row.photoRowDraft.thumbnail),
        category: row.photoRowDraft.category,
        location: row.photoRowDraft.location,
        date: row.photoRowDraft.date,
        tags: row.photoRowDraft.tags,
      }]
    })

    if (updates.length > 0) {
      const { error: updateError } = await persistPhotoUpdates(updates)

      if (updateError) {
        addToast('Could not sync the manifest metadata back into photos.', 'error')
        setSyncingBatchId(null)
        return
      }
    }

    await handleBatchStatusChange(batch, 'in_review')
    addToast('Manifest category and tag suggestions were synced to the live photos.', 'success')
    setSyncingBatchId(null)
  }

  async function handleApplyConfirmedFaces(batch: MediaReviewBatch) {
    setSyncingBatchId(batch.id)

    const confirmedFaces = faces.filter(
      (face) => face.review_status === 'confirmed' && face.confirmed_name && face.source_record_id,
    )

    if (confirmedFaces.length === 0) {
      addToast('There are no confirmed faces to apply yet.', 'warning')
      setSyncingBatchId(null)
      return
    }

    const manifestBySourceRecordId = new Map(
      importRows
        .filter((row) => row.sourceRecordId)
        .map((row) => [row.sourceRecordId as string, row]),
    )

    const urls = importRows.map((row) => toSiteMediaPath(row.photoRowDraft.url))
    const { data: photos, error: photoError } = await fetchPhotosForReview(urls)

    if (photoError) {
      addToast('Could not load the published photos for face-tag promotion.', 'error')
      setSyncingBatchId(null)
      return
    }

    const photoByUrl = new Map((photos || []).map((photo) => [photo.url, photo]))
    const batchFaceIdsByRecordId = new Map<string, Set<string>>()

    for (const face of faces) {
      if (!face.source_record_id) continue
      const current = batchFaceIdsByRecordId.get(face.source_record_id) || new Set<string>()
      current.add(face.face_id)
      batchFaceIdsByRecordId.set(face.source_record_id, current)
    }

    const confirmedFacesByRecordId = new Map<string, MediaReviewFace[]>()
    for (const face of confirmedFaces) {
      const current = confirmedFacesByRecordId.get(face.source_record_id as string) || []
      current.push(face)
      confirmedFacesByRecordId.set(face.source_record_id as string, current)
    }

    const pendingUpdates = new Map<string, PhotoRowForReview & { tags: string[]; faces: PhotoFace[] }>()

    for (const [sourceRecordId, recordFaces] of confirmedFacesByRecordId.entries()) {
      const manifestRow = manifestBySourceRecordId.get(sourceRecordId)
      if (!manifestRow) continue

      const url = toSiteMediaPath(manifestRow.photoRowDraft.url)
      const currentPhoto = pendingUpdates.get(url) || photoByUrl.get(url)
      if (!currentPhoto) continue

      const existingFaces = Array.isArray(currentPhoto.faces) ? currentPhoto.faces : []
      const batchFaceIds = batchFaceIdsByRecordId.get(sourceRecordId) || new Set<string>()
      const baseFaces = existingFaces.filter((face) => !batchFaceIds.has(String(face.id)))
      const nextFaces = recordFaces.map((face) => ({
        id: face.face_id,
        name: face.confirmed_name || 'Unknown',
        x: face.x,
        y: face.y,
      }))
      const mergedTags = Array.from(
        new Set([
          ...(Array.isArray(currentPhoto.tags) ? currentPhoto.tags : []),
          ...manifestRow.photoRowDraft.tags,
          ...recordFaces.map((face) => (face.confirmed_name || '').toLowerCase()).filter(Boolean),
        ]),
      )

      pendingUpdates.set(url, {
        ...currentPhoto,
        tags: mergedTags,
        faces: [...baseFaces, ...nextFaces],
      })
    }

    const updates = [...pendingUpdates.values()].map((photo) => ({
      id: photo.id,
      tags: photo.tags,
      faces: photo.faces,
    }))

    if (updates.length > 0) {
      const { error: updateError } = await persistPhotoUpdates(updates)

      if (updateError) {
        addToast('Could not apply the confirmed face tags to the live photos.', 'error')
        setSyncingBatchId(null)
        return
      }
    }

    await handleBatchStatusChange(batch, 'approved')
    addToast(`Applied confirmed face tags from ${confirmedFaces.length} face${confirmedFaces.length === 1 ? '' : 's'}.`, 'success')
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
          Review faces by photo first, then clean up person groups in bulk. Confirmed names stay private until you intentionally apply them back into the live gallery.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Review batches</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">{batches.length}</p>
        </div>
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Photos in batch</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">{photoRecords.length}</p>
        </div>
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Pending faces</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">
            {faces.filter((face) => face.review_status === 'pending').length}
          </p>
        </div>
        <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-charcoal-500">Confirmed people</p>
          <p className="mt-2 text-3xl font-display text-charcoal-900">{knownPeople.length}</p>
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
                    setSelectedPhotoKey(null)
                    setSelectedFaceId(null)
                    setSelectedGroupKey(null)
                    setCropPreviewUrls({})
                  }}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    isActive
                      ? 'border-gold-400 bg-gold-50'
                      : 'border-gold-100 bg-white hover:bg-cream-50',
                  )}
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
                      {faces.length} staged faces across {photoRecords.length} photos. Use photo review for accuracy, then clean up people groups in bulk.
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
                      <Tags className="mr-2 h-4 w-4" />
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
              {faces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gold-200 bg-white p-8 text-sm text-charcoal-500">
                  This batch does not have staged per-face review rows yet. Re-run the review push after exporting the manifest so the photo-first review workspace has face data to work with.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('photos')}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm transition-colors',
                        mode === 'photos'
                          ? 'bg-gold-500 text-white'
                          : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50',
                      )}
                    >
                      <ImageIcon className="mr-2 inline h-4 w-4" />
                      Photo Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('people')}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm transition-colors',
                        mode === 'people'
                          ? 'bg-gold-500 text-white'
                          : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50',
                      )}
                    >
                      <UserRoundSearch className="mr-2 inline h-4 w-4" />
                      Person Groups
                    </button>
                  </div>

                  {mode === 'photos' ? (
                    <div className="grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
                      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-medium text-charcoal-900">Photo Queue</h3>
                            <p className="mt-1 text-sm text-charcoal-500">
                              Start with images that still have pending faces. Exact duplicate photos have already been filtered out of this queue.
                            </p>
                          </div>

                          <Input
                            value={photoSearch}
                            onChange={(event) => setPhotoSearch(event.target.value)}
                            placeholder="Search file path or collection"
                          />

                          <select
                            value={photoStatusFilter}
                            onChange={(event) => setPhotoStatusFilter(event.target.value as 'all' | MediaReviewFaceStatus)}
                            className="h-11 w-full rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                          >
                            <option value="pending">Pending faces first</option>
                            <option value="confirmed">Confirmed only</option>
                            <option value="ignored">Ignored only</option>
                            <option value="all">All photos</option>
                          </select>
                        </div>

                        <div className="mt-5 space-y-3">
                          {visiblePhotos.map((photo) => {
                            const isActive = selectedPhoto?.key === photo.key

                            return (
                              <button
                                key={photo.key}
                                type="button"
                                onClick={() => {
                                  setSelectedPhotoKey(photo.key)
                                  setSelectedFaceId(photo.faces[0]?.id || null)
                                }}
                                className={cn(
                                  'grid w-full gap-3 rounded-xl border p-3 text-left transition-colors md:grid-cols-[4.5rem_minmax(0,1fr)]',
                                  isActive
                                    ? 'border-gold-400 bg-gold-50'
                                    : 'border-gold-100 bg-white hover:bg-cream-50',
                                )}
                              >
                                <div className="overflow-hidden rounded-lg bg-cream-100">
                                  {photo.thumbnailUrl ? (
                                    <img src={photo.thumbnailUrl} alt={photo.sourceRelativePath} className="h-18 w-full object-cover" />
                                  ) : (
                                    <div className="flex h-18 items-center justify-center text-xs text-charcoal-400">No preview</div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-charcoal-900">{photo.sourceRelativePath}</p>
                                  <p className="mt-1 text-xs text-charcoal-500">
                                    {photo.pendingCount} pending · {photo.confirmedCount} confirmed · {photo.ignoredCount} ignored
                                  </p>
                                  <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-charcoal-400">
                                    {photo.collection}
                                  </p>
                                </div>
                              </button>
                            )
                          })}

                          {filteredPhotos.length > PHOTO_LIST_LIMIT && (
                            <p className="rounded-xl border border-dashed border-gold-200 px-4 py-3 text-xs text-charcoal-500">
                              Showing the first {PHOTO_LIST_LIMIT} photos that match this filter. Narrow the search to focus the queue further.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                        {selectedPhoto ? (
                          <div className="space-y-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-charcoal-900">{selectedPhoto.sourceRelativePath}</h3>
                                <p className="mt-1 text-sm text-charcoal-500">
                                  {selectedPhoto.collection}
                                  {selectedPhoto.storyLaneSuggestion ? ` · ${selectedPhoto.storyLaneSuggestion}` : ''}
                                  {selectedPhoto.duplicateGroupId ? ' · deduped source group kept' : ''}
                                </p>
                              </div>

                              <Button
                                size="sm"
                                onClick={() => void saveFaces(selectedPhoto.faces.map((face) => face.id))}
                                disabled={savingKey === selectedPhoto.faces.map((face) => face.id).join(':')}
                              >
                                <Save className="mr-2 h-4 w-4" />
                                Save Photo Faces
                              </Button>
                            </div>

                            <div className="overflow-hidden rounded-[1.5rem] border border-gold-100 bg-charcoal-950">
                              <div className="relative aspect-[4/3] bg-charcoal-900">
                                {selectedPhoto.photoUrl ? (
                                  <img
                                    src={selectedPhoto.photoUrl}
                                    alt={selectedPhoto.sourceRelativePath}
                                    className="h-full w-full object-contain"
                                  />
                                ) : null}

                                {selectedPhoto.faces.map((face) => {
                                  const status = getFacePhotoStatus(face, faceDrafts[face.id])
                                  const isSelected = selectedFace?.id === face.id

                                  return (
                                    <button
                                      key={face.id}
                                      type="button"
                                      onClick={() => setSelectedFaceId(face.id)}
                                      className={cn(
                                        'absolute rounded-md border-2 transition-all',
                                        status === 'confirmed'
                                          ? 'border-green-300 bg-green-500/10'
                                          : status === 'ignored'
                                            ? 'border-charcoal-300 bg-charcoal-100/10'
                                            : 'border-gold-300 bg-gold-400/10',
                                        isSelected && 'ring-2 ring-white/90',
                                      )}
                                      style={getOverlayStyle(face)}
                                      aria-label={`Review ${getFaceLabel(face)}`}
                                    />
                                  )
                                })}
                              </div>
                            </div>

                            <div className="grid gap-4">
                              {selectedPhoto.faces.map((face) => {
                                const draft = faceDrafts[face.id] || normalizeFaceDraft(face)
                                const previewUrl = cropPreviewUrls[face.id]
                                const isSelected = selectedFace?.id === face.id

                                return (
                                  <div
                                    key={face.id}
                                    className={cn(
                                      'rounded-[1.4rem] border p-4 transition-colors',
                                      isSelected ? 'border-gold-400 bg-gold-50/70' : 'border-gold-100 bg-cream-50/40',
                                    )}
                                  >
                                    <div className="grid gap-4 lg:grid-cols-[7rem_minmax(0,1fr)]">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedFaceId(face.id)}
                                        className="overflow-hidden rounded-xl border border-gold-100 bg-white"
                                      >
                                        {previewUrl ? (
                                          <img src={previewUrl} alt={getFaceLabel(face)} className="h-28 w-full object-cover" />
                                        ) : (
                                          <div className="flex h-28 items-center justify-center text-xs text-charcoal-400">No crop</div>
                                        )}
                                      </button>

                                      <div className="space-y-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div>
                                            <p className="text-sm font-medium text-charcoal-900">{getFaceLabel(face)}</p>
                                            <p className="mt-1 text-xs text-charcoal-500">
                                              {face.cluster_id || 'No cluster'} · quality {face.quality_score ?? 'n/a'}
                                            </p>
                                          </div>
                                          <span className={cn('rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]', getStatusBadgeClasses(draft.reviewStatus))}>
                                            {draft.reviewStatus}
                                          </span>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                          <div>
                                            <label htmlFor={`face-name-${face.id}`} className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                              Person name
                                            </label>
                                            <Input
                                              id={`face-name-${face.id}`}
                                              list="known-people-options"
                                              value={draft.confirmedName}
                                              onChange={(event) => {
                                                const confirmedName = event.target.value
                                                updateDraft(face.id, {
                                                  confirmedName,
                                                  personKey: confirmedName ? slugifyPerson(confirmedName) : '',
                                                  reviewStatus: confirmedName ? 'confirmed' : draft.reviewStatus,
                                                })
                                              }}
                                              placeholder="Austin"
                                            />
                                          </div>

                                          <div>
                                            <label htmlFor={`face-person-key-${face.id}`} className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                              Group key
                                            </label>
                                            <Input
                                              id={`face-person-key-${face.id}`}
                                              value={draft.personKey}
                                              onChange={(event) => updateDraft(face.id, { personKey: event.target.value })}
                                              placeholder="austin"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          {([
                                            ['pending', 'Pending'],
                                            ['confirmed', 'Confirm'],
                                            ['ignored', 'Ignore'],
                                          ] as const).map(([value, label]) => (
                                            <button
                                              key={value}
                                              type="button"
                                              onClick={() => updateDraft(face.id, { reviewStatus: value })}
                                              className={cn(
                                                'rounded-full px-3 py-2 text-sm transition-colors',
                                                draft.reviewStatus === value
                                                  ? 'bg-gold-500 text-white'
                                                  : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50',
                                              )}
                                            >
                                              {label}
                                            </button>
                                          ))}
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => void saveFaces([face.id])}
                                            disabled={savingKey === face.id}
                                          >
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Face
                                          </Button>
                                        </div>

                                        <div>
                                          <label htmlFor={`face-notes-${face.id}`} className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                            Notes
                                          </label>
                                          <Textarea
                                            id={`face-notes-${face.id}`}
                                            value={draft.notes}
                                            onChange={(event) => updateDraft(face.id, { notes: event.target.value })}
                                            placeholder="Optional review notes for this face."
                                            className="min-h-[96px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gold-200 p-6 text-sm text-charcoal-500">
                            Select a photo to review every detected face in context.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
                      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-medium text-charcoal-900">People Groups</h3>
                            <p className="mt-1 text-sm text-charcoal-500">
                              Use this cleanup pass to rename whole groups, confirm them in bulk, or ignore misfires together.
                            </p>
                          </div>

                          <Input
                            value={personSearch}
                            onChange={(event) => setPersonSearch(event.target.value)}
                            placeholder="Search person name, cluster, or photo path"
                          />
                        </div>

                        <div className="mt-5 space-y-3">
                          {filteredGroups.map((group) => {
                            const isActive = selectedGroup?.key === group.key

                            return (
                              <button
                                key={group.key}
                                type="button"
                                onClick={() => setSelectedGroupKey(group.key)}
                                className={cn(
                                  'w-full rounded-xl border p-4 text-left transition-colors',
                                  isActive
                                    ? 'border-gold-400 bg-gold-50'
                                    : 'border-gold-100 bg-white hover:bg-cream-50',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-charcoal-900">{group.label}</p>
                                    <p className="mt-1 text-xs text-charcoal-500">
                                      {group.faces.length} faces · {group.clusterCount} suggested cluster{group.clusterCount === 1 ? '' : 's'}
                                    </p>
                                  </div>
                                  <FolderOpen className="h-4 w-4 text-charcoal-400" />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-charcoal-500">
                                  <span>{group.pendingCount} pending</span>
                                  <span>{group.confirmedCount} confirmed</span>
                                  <span>{group.ignoredCount} ignored</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                        {selectedGroup && selectedGroupDraft ? (
                          <div className="space-y-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-charcoal-900">{selectedGroup.label}</h3>
                                <p className="mt-1 text-sm text-charcoal-500">
                                  {selectedGroup.faces.length} faces grouped here across {selectedGroup.clusterCount} suggested cluster{selectedGroup.clusterCount === 1 ? '' : 's'}.
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void handleApplyGroupDecision('pending')}
                                  disabled={savingKey === selectedGroup.key}
                                >
                                  Mark Pending
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void handleApplyGroupDecision('ignored')}
                                  disabled={savingKey === selectedGroup.key}
                                >
                                  Ignore Group
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => void handleApplyGroupDecision('confirmed')}
                                  disabled={savingKey === selectedGroup.key}
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  Confirm Group
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label htmlFor="group-name" className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                  Confirmed name
                                </label>
                                <Input
                                  id="group-name"
                                  list="known-people-options"
                                  value={selectedGroupDraft.confirmedName}
                                  onChange={(event) => {
                                    const confirmedName = event.target.value
                                    selectedGroup.faces.forEach((face) => {
                                      updateDraft(face.id, {
                                        confirmedName,
                                        personKey: confirmedName ? slugifyPerson(confirmedName) : '',
                                      })
                                    })
                                  }}
                                  placeholder="Austin"
                                />
                              </div>

                              <div>
                                <label htmlFor="group-key" className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                  Group key
                                </label>
                                <Input
                                  id="group-key"
                                  value={selectedGroupDraft.personKey}
                                  onChange={(event) => {
                                    const personKey = event.target.value
                                    selectedGroup.faces.forEach((face) => {
                                      updateDraft(face.id, { personKey })
                                    })
                                  }}
                                  placeholder="austin"
                                />
                              </div>
                            </div>

                            <div>
                              <label htmlFor="group-notes" className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                Shared notes
                              </label>
                              <Textarea
                                id="group-notes"
                                value={selectedGroupDraft.notes}
                                onChange={(event) => {
                                  const notes = event.target.value
                                  selectedGroup.faces.forEach((face) => {
                                    updateDraft(face.id, { notes })
                                  })
                                }}
                                placeholder="Optional notes for this person group."
                                className="min-h-[96px]"
                              />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              {selectedGroup.faces.slice(0, PERSON_GROUP_SAMPLE_LIMIT).map((face) => {
                                const draft = faceDrafts[face.id] || normalizeFaceDraft(face)

                                return (
                                  <div key={face.id} className="overflow-hidden rounded-[1.3rem] border border-gold-100 bg-cream-50/60">
                                    <div className="aspect-square overflow-hidden bg-white">
                                      {cropPreviewUrls[face.id] ? (
                                        <img
                                          src={cropPreviewUrls[face.id]}
                                          alt={getFaceLabel(face)}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-xs text-charcoal-400">No crop</div>
                                      )}
                                    </div>
                                    <div className="space-y-3 p-4">
                                      <div>
                                        <p className="truncate text-sm font-medium text-charcoal-900">
                                          {face.source_relative_path || 'Unknown source'}
                                        </p>
                                        <p className="mt-1 text-xs text-charcoal-500">
                                          {face.cluster_id || 'No cluster'}
                                        </p>
                                      </div>

                                      <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]', getStatusBadgeClasses(draft.reviewStatus))}>
                                        {draft.reviewStatus}
                                      </span>

                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => {
                                            setMode('photos')
                                            const targetPhotoKey = face.source_record_id || face.photo_url || face.face_id
                                            setSelectedPhotoKey(targetPhotoKey)
                                            setSelectedFaceId(face.id)
                                          }}
                                        >
                                          Open Photo
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => void saveFaces([face.id])}
                                          disabled={savingKey === face.id}
                                        >
                                          Save Face
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gold-200 p-6 text-sm text-charcoal-500">
                            Select a person group to rename, confirm, or ignore matching faces in bulk.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gold-200 bg-white p-8 text-sm text-charcoal-500">
              Push a review bundle first, then this page will list staged batches for admin review.
            </div>
          )}
        </div>
      </div>

      <datalist id="known-people-options">
        {knownPeople.map((person) => (
          <option key={person} value={person} />
        ))}
      </datalist>
    </div>
  )
}
