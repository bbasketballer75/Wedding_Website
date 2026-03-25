import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  FolderOpen,
  RefreshCw,
  Save,
  Tags,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'
import {
  createMediaReviewArtifactSignedUrl,
  downloadMediaReviewArtifact,
  fetchMediaReviewBatches,
  fetchMediaReviewFaces,
  fetchKnownPeopleNames,
  supabase,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
  type MediaReviewFace,
  type MediaReviewFaceStatus,
  type Photo as SupabasePhoto,
  type PhotoFace,
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
    faces: Array<{
      id: string
      name: string
      x: number
      y: number
      box?: {
        left: number
        top: number
        width: number
        height: number
      } | null
    }>
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
  averageQuality: number
}

const PHOTO_LOOKUP_CHUNK_SIZE = 40
const PERSON_GROUP_SAMPLE_LIMIT = 60

function isGuestReviewBatch(batch: MediaReviewBatch) {
  return batch.batch_key.startsWith('guest-review-batch-') || batch.notes === 'Guest upload face review batch'
}

function toSiteMediaPath(relativePath: string) {
  if (!relativePath) return ''
  if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith('/')) {
    return relativePath
  }
  return `/media/${relativePath.replace(/^\/+/, '')}`
}

function resolveReviewMediaPath(path: string | null | undefined) {
  if (!path) return ''
  return getMediaPath(path)
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

function getDraftFaceLabel(face: MediaReviewFace, draft?: FaceDraft) {
  return draft?.confirmedName?.trim() || getFaceLabel(face)
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
      averageQuality: 0,
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
      averageQuality:
        group.faces.reduce((total, face) => total + (face.quality_score ?? 0), 0) /
        Math.max(group.faces.length, 1),
    }))
    .sort((left, right) => {
      if (left.pendingCount !== right.pendingCount) {
        return right.pendingCount - left.pendingCount
      }

      if (left.faces.length !== right.faces.length) {
        return right.faces.length - left.faces.length
      }

      if (left.averageQuality !== right.averageQuality) {
        return right.averageQuality - left.averageQuality
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
  const [knownPeople, setKnownPeople] = useState<string[]>([])
  const [faceDrafts, setFaceDrafts] = useState<Record<string, FaceDraft>>({})
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedPhotoKey, setSelectedPhotoKey] = useState<string | null>(null)
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [selectedGroupFaceId, setSelectedGroupFaceId] = useState<string | null>(null)
  const [personSearch, setPersonSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [syncingBatchId, setSyncingBatchId] = useState<string | null>(null)
  const [importRows, setImportRows] = useState<ReviewImportManifestRow[]>([])
  const [cropPreviewUrls, setCropPreviewUrls] = useState<Record<string, string>>({})
  const [showAllGroupSamples, setShowAllGroupSamples] = useState(false)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)
  const [lastSavedSummary, setLastSavedSummary] = useState<string | null>(null)
  const [photoInspectorOpen, setPhotoInspectorOpen] = useState(false)
  const { addToast } = useToast()

  const deferredPersonSearch = useDeferredValue(personSearch)

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) || null,
    [batches, selectedBatchId],
  )

  const photoRecords = useMemo(
    () => buildPhotoRecords(faces, importRows),
    [faces, importRows],
  )

  const photoRecordByFaceId = useMemo(() => {
    const entries: Array<[string, ReviewPhotoRecord]> = []
    photoRecords.forEach((photo) => {
      photo.faces.forEach((face) => {
        entries.push([face.id, photo])
      })
    })
    return new Map(entries)
  }, [photoRecords])

  const selectedPhoto = useMemo(
    () => photoRecords.find((photo) => photo.key === selectedPhotoKey) || null,
    [photoRecords, selectedPhotoKey],
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

  const selectedGroupFace = useMemo(
    () => selectedGroup?.faces.find((face) => face.id === selectedGroupFaceId) || selectedGroup?.faces[0] || null,
    [selectedGroup, selectedGroupFaceId],
  )

  const selectedGroupPhoto = useMemo(
    () => (selectedGroupFace ? photoRecordByFaceId.get(selectedGroupFace.id) || null : null),
    [photoRecordByFaceId, selectedGroupFace],
  )

  const selectedGroupDraft = useMemo(() => {
    if (!selectedGroup) return null

    const firstFace = selectedGroupFace || selectedGroup.faces[0]
    const firstDraft = faceDrafts[firstFace.id] || normalizeFaceDraft(firstFace)

    return {
      confirmedName: firstDraft.confirmedName,
      personKey: firstDraft.personKey || (firstDraft.confirmedName ? slugifyPerson(firstDraft.confirmedName) : ''),
      notes: firstDraft.notes,
    }
  }, [faceDrafts, selectedGroup, selectedGroupFace])

  const changedFaceIds = useMemo(
    () => faces
      .filter((face) => {
        const draft = faceDrafts[face.id]
        return draft ? draftChanged(face, draft) : false
      })
      .map((face) => face.id),
    [faceDrafts, faces],
  )

  const changedFaceIdSet = useMemo(
    () => new Set(changedFaceIds),
    [changedFaceIds],
  )

  const changedGroupCount = useMemo(
    () =>
      personGroups.filter((group) => group.faceIds.some((faceId) => changedFaceIdSet.has(faceId))).length,
    [changedFaceIdSet, personGroups],
  )

  const selectedPhotoChangedFaceIds = useMemo(
    () => selectedPhoto?.faces.map((face) => face.id).filter((faceId) => changedFaceIdSet.has(faceId)) || [],
    [changedFaceIdSet, selectedPhoto],
  )

  const selectedGroupChangedFaceIds = useMemo(
    () => selectedGroup?.faceIds.filter((faceId) => changedFaceIdSet.has(faceId)) || [],
    [changedFaceIdSet, selectedGroup],
  )

  const groupFacesForDisplay = useMemo(() => {
    if (!selectedGroup) return []
    return showAllGroupSamples ? selectedGroup.faces : selectedGroup.faces.slice(0, 12)
  }, [selectedGroup, showAllGroupSamples])

  const loadBatches = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchMediaReviewBatches()

    if (error) {
      addToast('Could not load review batches.', 'error')
      setLoading(false)
      return
    }

    const nextBatches = (data || []).filter(isGuestReviewBatch)
    setBatches(nextBatches)
    setSelectedBatchId((current) => {
      if (current && nextBatches.some((batch) => batch.id === current)) {
        return current
      }
      return nextBatches[0]?.id || null
    })
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
    setSelectedGroupFaceId((current) => current || nextGroups[0]?.faces[0]?.id || null)
    setShowAllGroupSamples(false)
    setLastSavedSummary(null)
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBatches()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadBatches])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      async function loadKnownPeople() {
        const { data, error } = await fetchKnownPeopleNames()
        if (!error && data) {
          setKnownPeople(data)
        }
      }

      void loadKnownPeople()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!selectedBatch) return

    const timeoutId = window.setTimeout(() => {
      void loadBatchDetails(selectedBatch)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadBatchDetails, selectedBatch])

  useEffect(() => {
    const facesToPreview = photoInspectorOpen
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
  }, [photoInspectorOpen, selectedBatch, selectedGroup, selectedPhoto])

  useEffect(() => {
    if (!selectedPhoto && photoRecords[0]) {
      setSelectedPhotoKey(photoRecords[0].key)
      setSelectedFaceId(photoRecords[0].faces[0]?.id || null)
    }
  }, [photoRecords, selectedPhoto])

  useEffect(() => {
    if (!selectedGroup && filteredGroups[0]) {
      setSelectedGroupKey(filteredGroups[0].key)
    }
  }, [filteredGroups, selectedGroup])

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedGroupFaceId(null)
      return
    }

    if (!selectedGroupFace || !selectedGroup.faces.some((face) => face.id === selectedGroupFace.id)) {
      setSelectedGroupFaceId(selectedGroup.faces[0]?.id || null)
    }
  }, [selectedGroup, selectedGroupFace])

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

  function updateFacesDrafts(faceIds: string[], patch: Partial<FaceDraft>) {
    faceIds.forEach((faceId) => {
      updateDraft(faceId, patch)
    })
  }

  function resetFaces(faceIds: string[]) {
    setFaceDrafts((prev) => ({
      ...prev,
      ...Object.fromEntries(
        faceIds
          .map((faceId) => faces.find((face) => face.id === faceId))
          .filter((face): face is MediaReviewFace => Boolean(face))
          .map((face) => [face.id, normalizeFaceDraft(face)]),
      ),
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

  function stageGroupStatus(status: MediaReviewFaceStatus) {
    if (!selectedGroup) return

    updateFacesDrafts(
      selectedGroup.faceIds,
      {
        reviewStatus: status,
      },
    )
  }

  function openFaceInPhotoReview(face: MediaReviewFace) {
    setSelectedPhotoKey(face.source_record_id || face.photo_url || face.face_id)
    setSelectedFaceId(face.id)
    setPhotoInspectorOpen(true)
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
      setLastSavedSummary(
        `Saved ${savedFaces.length} change${savedFaces.length === 1 ? '' : 's'} at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
      )
      addToast(`Saved ${savedFaces.length} face review change${savedFaces.length === 1 ? '' : 's'}.`, 'success')
    } catch {
      addToast('Could not save those face review changes.', 'error')
    } finally {
      setSavingKey(null)
    }
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
        box: face.box
          ? {
              left: Number(face.box.left ?? 0),
              top: Number(face.box.top ?? 0),
              width: Number(face.box.width ?? 0),
              height: Number(face.box.height ?? 0),
            }
          : null,
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

  const pendingFaceCount = faces.filter((face) => face.review_status === 'pending').length
  const selectedFaceDraft = selectedFace ? faceDrafts[selectedFace.id] || normalizeFaceDraft(selectedFace) : null
  const selectedPhotoSaveKey = selectedPhoto?.faces.map((face) => face.id).join(':') || null
  const selectedGroupSaveKey = selectedGroup?.faceIds.join(':') || null

  if (loading) {
    return <div className="rounded-xl border border-gold-100 bg-white p-8 text-center text-charcoal-500">Loading review batches…</div>
  }

  return (
    <div className="space-y-4">
      {selectedBatch ? (
        <>
          <section className="rounded-[1.4rem] border border-gold-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:min-w-0 xl:flex-1">
                <div>
                  <label htmlFor="review-batch-picker" className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-charcoal-500">
                    Review batch
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="review-batch-picker"
                      value={selectedBatchId || ''}
                      onChange={(event) => {
                        setSelectedBatchId(event.target.value || null)
                        setSelectedPhotoKey(null)
                        setSelectedFaceId(null)
                        setSelectedGroupKey(null)
                        setSelectedGroupFaceId(null)
                        setCropPreviewUrls({})
                        setPhotoInspectorOpen(false)
                      }}
                      className="h-11 min-w-0 flex-1 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                    >
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.label}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="secondary" onClick={() => void loadBatches()}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 rounded-[1rem] border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm text-charcoal-600 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Status</p>
                    <p className="mt-1 font-medium text-charcoal-900">{selectedBatch.status.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Pending faces</p>
                    <p className="mt-1 font-medium text-charcoal-900">{pendingFaceCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Groups touched</p>
                    <p className="mt-1 font-medium text-charcoal-900">{changedGroupCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Last save</p>
                    <p className="mt-1 font-medium text-charcoal-900">{lastSavedSummary || 'No changes saved yet'}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className="rounded-full border border-gold-200 bg-white px-4 py-2 text-sm text-charcoal-600">
                  {changedFaceIds.length} unsaved face change{changedFaceIds.length === 1 ? '' : 's'}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedGroup) void saveFaces(selectedGroup.faceIds)
                  }}
                  disabled={!selectedGroup || selectedGroupChangedFaceIds.length === 0 || savingKey === selectedGroupSaveKey}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Group Changes
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (selectedGroup) resetFaces(selectedGroup.faceIds)
                  }}
                  disabled={!selectedGroup || selectedGroupChangedFaceIds.length === 0}
                >
                  Reset Unsaved Changes
                </Button>
              </div>
            </div>

            <details
              className="mt-4 rounded-[1rem] border border-gold-100 bg-cream-50/70 p-4"
              open={showAdvancedTools}
              onToggle={(event) => setShowAdvancedTools(event.currentTarget.open)}
            >
              <summary className="cursor-pointer list-none text-sm font-medium text-charcoal-900">
                Advanced batch tools
              </summary>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void handleBatchStatusChange(selectedBatch, 'pending')}>
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
            </details>
          </section>
              {faces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gold-200 bg-white p-8 text-sm text-charcoal-500">
                  This batch does not have staged per-face review rows yet. Re-run the review push after exporting the manifest so the people queue has real faces to review.
                </div>
              ) : (
                <>
                    <div className="grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
                      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-medium text-charcoal-900">People Queue</h3>
                            <p className="mt-1 text-sm text-charcoal-500">
                              Start with the biggest pending groups, then open the full photo only when the samples are not enough.
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
                                onClick={() => {
                                  setSelectedGroupKey(group.key)
                                  setSelectedGroupFaceId(group.faces[0]?.id || null)
                                  setShowAllGroupSamples(false)
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
                                    <p className="text-sm font-medium text-charcoal-900">{group.label}</p>
                                    <p className="mt-1 text-xs text-charcoal-500">
                                      {group.pendingCount} pending · {group.faces.length} faces · quality {group.averageQuality.toFixed(1)}
                                    </p>
                                  </div>
                                  <FolderOpen className="h-4 w-4 text-charcoal-400" />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-charcoal-400">
                                  <span>{group.clusterCount} cluster{group.clusterCount === 1 ? '' : 's'}</span>
                                  {group.faceIds.some((faceId) => changedFaceIdSet.has(faceId)) ? <span>unsaved edits</span> : null}
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
                                  onClick={() => stageGroupStatus('pending')}
                                >
                                  Return To Pending
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => stageGroupStatus('ignored')}
                                >
                                  Ignore
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => stageGroupStatus('confirmed')}
                                >
                                  Confirm
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-6">
                              <div className="space-y-5">
                                <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
                                  <div className="overflow-hidden rounded-[1.4rem] border border-gold-100 bg-cream-50">
                                    {selectedGroupFace && cropPreviewUrls[selectedGroupFace.id] ? (
                                      <img
                                        src={cropPreviewUrls[selectedGroupFace.id]}
                                        alt={getDraftFaceLabel(selectedGroupFace, faceDrafts[selectedGroupFace.id])}
                                        className="aspect-square h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex aspect-square items-center justify-center text-xs text-charcoal-400">No crop</div>
                                    )}
                                  </div>

                                  <div className="space-y-4 rounded-[1.4rem] border border-gold-100 bg-cream-50/70 p-4">
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
                                            updateFacesDrafts(selectedGroup.faceIds, {
                                              confirmedName,
                                              personKey: confirmedName ? slugifyPerson(confirmedName) : '',
                                            })
                                          }}
                                          placeholder="Austin"
                                        />
                                      </div>

                                      <div className="rounded-xl border border-gold-100 bg-white px-4 py-3 text-sm text-charcoal-500">
                                        <p className="text-xs uppercase tracking-[0.22em] text-charcoal-400">Unsaved in this group</p>
                                        <p className="mt-1 text-lg font-medium text-charcoal-900">{selectedGroupChangedFaceIds.length}</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => void saveFaces(selectedGroup.faceIds)}
                                        disabled={savingKey === selectedGroup.faceIds.join(':')}
                                      >
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Group Changes
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => resetFaces(selectedGroup.faceIds)}
                                        disabled={selectedGroupChangedFaceIds.length === 0}
                                      >
                                        Reset Unsaved Changes
                                      </Button>
                                      {selectedGroupFace ? (
                                        <Button size="sm" variant="secondary" onClick={() => openFaceInPhotoReview(selectedGroupFace)}>
                                          Open Photo Inspector
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-[1.4rem] border border-gold-100 bg-white p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <h4 className="text-sm font-medium text-charcoal-900">Sample Faces</h4>
                                      <p className="mt-1 text-xs text-charcoal-500">
                                        Review the strongest examples first, then open the full photo only for ambiguous faces.
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                          if (!selectedGroupFace) return
                                          const currentIndex = selectedGroup.faces.findIndex((face) => face.id === selectedGroupFace.id)
                                          const previousFace = selectedGroup.faces[Math.max(0, currentIndex - 1)]
                                          if (previousFace) setSelectedGroupFaceId(previousFace.id)
                                        }}
                                      >
                                        Previous
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                          if (!selectedGroupFace) return
                                          const currentIndex = selectedGroup.faces.findIndex((face) => face.id === selectedGroupFace.id)
                                          const nextFace = selectedGroup.faces[Math.min(selectedGroup.faces.length - 1, currentIndex + 1)]
                                          if (nextFace) setSelectedGroupFaceId(nextFace.id)
                                        }}
                                      >
                                        Next
                                      </Button>
                                      {selectedGroup.faces.length > 12 ? (
                                        <Button size="sm" variant="secondary" onClick={() => setShowAllGroupSamples((current) => !current)}>
                                          {showAllGroupSamples ? 'Show Fewer' : `View More (${selectedGroup.faces.length})`}
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {groupFacesForDisplay.map((face) => {
                                      const draft = faceDrafts[face.id] || normalizeFaceDraft(face)
                                      const isActive = selectedGroupFace?.id === face.id
                                      const samplePhoto = photoRecordByFaceId.get(face.id) || null

                                      return (
                                        <button
                                          key={face.id}
                                          type="button"
                                          onClick={() => setSelectedGroupFaceId(face.id)}
                                          className={cn(
                                            'overflow-hidden rounded-[1.3rem] border text-left transition-colors',
                                            isActive ? 'border-gold-400 bg-gold-50' : 'border-gold-100 bg-cream-50/60 hover:bg-cream-50',
                                          )}
                                        >
                                          <div className="aspect-square overflow-hidden bg-white">
                                            {cropPreviewUrls[face.id] ? (
                                              <img
                                                src={cropPreviewUrls[face.id]}
                                                alt={getDraftFaceLabel(face, draft)}
                                                className="h-full w-full object-cover"
                                              />
                                            ) : samplePhoto?.thumbnailUrl || samplePhoto?.photoUrl ? (
                                              <img
                                                src={resolveReviewMediaPath(samplePhoto.thumbnailUrl || samplePhoto.photoUrl)}
                                                alt={samplePhoto?.sourceRelativePath || getDraftFaceLabel(face, draft)}
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              <div className="flex h-full items-center justify-center text-xs text-charcoal-400">No preview</div>
                                            )}
                                          </div>
                                          <div className="space-y-2 p-4">
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="truncate text-sm font-medium text-charcoal-900">{getDraftFaceLabel(face, draft)}</p>
                                              <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]', getStatusBadgeClasses(draft.reviewStatus))}>
                                                {draft.reviewStatus}
                                              </span>
                                            </div>
                                            <p className="text-[11px] uppercase tracking-[0.18em] text-charcoal-400">
                                              Face crop from confirmed metadata
                                            </p>
                                            <p className="truncate text-xs text-charcoal-500">{face.source_relative_path || 'Unknown source'}</p>
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="rounded-[1.4rem] border border-gold-100 bg-cream-50/70 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h4 className="text-sm font-medium text-charcoal-900">Source Photo</h4>
                                      <p className="mt-1 text-xs text-charcoal-500">
                                        Face metadata stays primary here. Use the larger image only when you need extra context for the selected crop.
                                      </p>
                                    </div>
                                    {selectedGroupFace ? (
                                      <Button size="sm" variant="secondary" onClick={() => openFaceInPhotoReview(selectedGroupFace)}>
                                        Open Photo Inspector
                                      </Button>
                                    ) : null}
                                  </div>
                                  <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-gold-100 bg-charcoal-950">
                                    {selectedGroupPhoto?.photoUrl ? (
                                      <div className="relative aspect-[4/3] bg-charcoal-900">
                                        <img
                                          src={resolveReviewMediaPath(selectedGroupPhoto.photoUrl)}
                                          alt={selectedGroupPhoto.sourceRelativePath}
                                          className="h-full w-full object-contain"
                                        />
                                        {selectedGroupFace ? (
                                          <div
                                            className="absolute rounded-md border-2 border-gold-400 bg-gold-400/15 ring-2 ring-white/90"
                                            style={getOverlayStyle(selectedGroupFace)}
                                          />
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="flex aspect-[4/3] items-center justify-center text-xs text-charcoal-400">No source preview</div>
                                    )}
                                  </div>
                                </div>

                                <details className="rounded-[1.4rem] border border-gold-100 bg-white p-4">
                                  <summary className="cursor-pointer list-none text-sm font-medium text-charcoal-900">
                                    Details and notes
                                  </summary>
                                  <div className="mt-4 space-y-4">
                                    <div>
                                      <label htmlFor="group-key" className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                        Person key
                                      </label>
                                      <Input
                                        id="group-key"
                                        value={selectedGroupDraft.personKey}
                                        onChange={(event) => updateFacesDrafts(selectedGroup.faceIds, { personKey: event.target.value })}
                                        placeholder="austin"
                                      />
                                    </div>

                                    <div>
                                      <label htmlFor="group-notes" className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                        Shared notes
                                      </label>
                                      <Textarea
                                        id="group-notes"
                                        value={selectedGroupDraft.notes}
                                        onChange={(event) => updateFacesDrafts(selectedGroup.faceIds, { notes: event.target.value })}
                                        placeholder="Optional notes for this person group."
                                        className="min-h-[96px]"
                                      />
                                    </div>

                                    {selectedGroupFace ? (
                                      <div className="grid gap-2 rounded-xl border border-gold-100 bg-cream-50/70 p-4 text-sm text-charcoal-500">
                                        <p><span className="font-medium text-charcoal-900">Cluster:</span> {selectedGroupFace.cluster_id || 'None'}</p>
                                        <p><span className="font-medium text-charcoal-900">Quality:</span> {selectedGroupFace.quality_score ?? 'n/a'}</p>
                                        <p><span className="font-medium text-charcoal-900">Source:</span> {selectedGroupFace.source_relative_path || 'Unknown source'}</p>
                                      </div>
                                    ) : null}
                                  </div>
                                </details>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gold-200 p-6 text-sm text-charcoal-500">
                            Select a person group to rename, confirm, or ignore matching faces in bulk.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {photoInspectorOpen && selectedPhoto ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/60 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.6rem] border border-gold-100 bg-white shadow-2xl">
                      <div className="flex items-center justify-between gap-3 border-b border-gold-100 px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-charcoal-500">Photo inspector</p>
                          <h3 className="mt-1 truncate text-lg font-medium text-charcoal-900">{selectedPhoto.sourceRelativePath}</h3>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setPhotoInspectorOpen(false)}>
                          Close
                        </Button>
                      </div>

                      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="min-h-0 overflow-y-auto border-b border-gold-100 p-5 xl:border-b-0 xl:border-r">
                          <div className="space-y-4">
                            <div className="overflow-hidden rounded-[1.4rem] border border-gold-100 bg-charcoal-950">
                              <div className="relative aspect-[4/3] bg-charcoal-900">
                                {selectedPhoto.photoUrl ? (
                                  <img
                                    src={resolveReviewMediaPath(selectedPhoto.photoUrl)}
                                    alt={selectedPhoto.sourceRelativePath}
                                    className="h-full w-full object-contain"
                                    loading="lazy"
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

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  if (!selectedFace) return
                                  const currentIndex = selectedPhoto.faces.findIndex((face) => face.id === selectedFace.id)
                                  const previousFace = selectedPhoto.faces[Math.max(0, currentIndex - 1)]
                                  if (previousFace) setSelectedFaceId(previousFace.id)
                                }}
                              >
                                Previous Face
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  if (!selectedFace) return
                                  const currentIndex = selectedPhoto.faces.findIndex((face) => face.id === selectedFace.id)
                                  const nextFace = selectedPhoto.faces[Math.min(selectedPhoto.faces.length - 1, currentIndex + 1)]
                                  if (nextFace) setSelectedFaceId(nextFace.id)
                                }}
                              >
                                Next Face
                              </Button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                              {selectedPhoto.faces.map((face) => {
                                const draft = faceDrafts[face.id] || normalizeFaceDraft(face)
                                const isSelected = selectedFace?.id === face.id

                                return (
                                  <button
                                    key={face.id}
                                    type="button"
                                    onClick={() => setSelectedFaceId(face.id)}
                                    className={cn(
                                      'overflow-hidden rounded-[1rem] border text-left transition-colors',
                                      isSelected ? 'border-gold-400 bg-gold-50' : 'border-gold-100 bg-cream-50/50 hover:bg-cream-50',
                                    )}
                                  >
                                    <div className="aspect-square overflow-hidden bg-white">
                                      {cropPreviewUrls[face.id] ? (
                                        <img src={cropPreviewUrls[face.id]} alt={getDraftFaceLabel(face, draft)} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full items-center justify-center text-xs text-charcoal-400">No crop</div>
                                      )}
                                    </div>
                                    <div className="space-y-1 p-3">
                                      <p className="truncate text-sm font-medium text-charcoal-900">{getDraftFaceLabel(face, draft)}</p>
                                      <span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em]', getStatusBadgeClasses(draft.reviewStatus))}>
                                        {draft.reviewStatus}
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto bg-cream-50/70 p-5">
                          {selectedFace && selectedFaceDraft ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.28em] text-charcoal-500">Selected face</p>
                                <h4 className="mt-2 text-lg font-medium text-charcoal-900">{getDraftFaceLabel(selectedFace, selectedFaceDraft)}</h4>
                                <p className="mt-1 text-sm text-charcoal-500">
                                  {selectedFace.cluster_id || 'No cluster'} · quality {selectedFace.quality_score ?? 'n/a'}
                                </p>
                              </div>

                              <div className="overflow-hidden rounded-[1.1rem] border border-gold-100 bg-white">
                                {cropPreviewUrls[selectedFace.id] ? (
                                  <img src={cropPreviewUrls[selectedFace.id]} alt={getDraftFaceLabel(selectedFace, selectedFaceDraft)} className="aspect-square h-full w-full object-cover" />
                                ) : (
                                  <div className="flex aspect-square items-center justify-center text-xs text-charcoal-400">No crop</div>
                                )}
                              </div>

                              <div>
                                <label htmlFor={`face-name-${selectedFace.id}`} className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                  Person name
                                </label>
                                <Input
                                  id={`face-name-${selectedFace.id}`}
                                  list="known-people-options"
                                  value={selectedFaceDraft.confirmedName}
                                  onChange={(event) => {
                                    const confirmedName = event.target.value
                                    updateDraft(selectedFace.id, {
                                      confirmedName,
                                      personKey: confirmedName ? slugifyPerson(confirmedName) : '',
                                      reviewStatus: confirmedName ? 'confirmed' : selectedFaceDraft.reviewStatus,
                                    })
                                  }}
                                  placeholder="Austin"
                                />
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
                                    onClick={() => updateDraft(selectedFace.id, { reviewStatus: value })}
                                    className={cn(
                                      'rounded-full px-3 py-2 text-sm transition-colors',
                                      selectedFaceDraft.reviewStatus === value
                                        ? 'bg-gold-500 text-white'
                                        : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50',
                                    )}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void saveFaces(selectedPhoto.faces.map((face) => face.id))}
                                  disabled={savingKey === selectedPhotoSaveKey || selectedPhotoChangedFaceIds.length === 0}
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Photo Changes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => resetFaces(selectedPhoto.faces.map((face) => face.id))}
                                  disabled={selectedPhotoChangedFaceIds.length === 0}
                                >
                                  Reset Photo Changes
                                </Button>
                              </div>

                              <details className="rounded-[1rem] border border-gold-100 bg-white p-4">
                                <summary className="cursor-pointer list-none text-sm font-medium text-charcoal-900">
                                  Details and notes
                                </summary>
                                <div className="mt-4 space-y-4">
                                  <div>
                                    <label htmlFor={`face-person-key-${selectedFace.id}`} className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                      Group key
                                    </label>
                                    <Input
                                      id={`face-person-key-${selectedFace.id}`}
                                      value={selectedFaceDraft.personKey}
                                      onChange={(event) => updateDraft(selectedFace.id, { personKey: event.target.value })}
                                      placeholder="austin"
                                    />
                                  </div>

                                  <div>
                                    <label htmlFor={`face-notes-${selectedFace.id}`} className="mb-2 block text-xs uppercase tracking-[0.22em] text-charcoal-500">
                                      Notes
                                    </label>
                                    <Textarea
                                      id={`face-notes-${selectedFace.id}`}
                                      value={selectedFaceDraft.notes}
                                      onChange={(event) => updateDraft(selectedFace.id, { notes: event.target.value })}
                                      placeholder="Optional review notes for this face."
                                      className="min-h-[96px]"
                                    />
                                  </div>
                                </div>
                              </details>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gold-200 bg-white p-8 text-sm text-charcoal-500">
                The guest-upload review queue is empty. Export and tag approved guest uploads, then push a guest review batch to stage the next people-review pass.
              </div>
            )}

      <datalist id="known-people-options">
        {knownPeople.map((person) => (
          <option key={person} value={person} />
        ))}
      </datalist>
    </div>
  )
}
