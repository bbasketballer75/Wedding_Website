import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  fetchMediaReviewBatches,
  fetchMediaReviewFaces,
  updateMediaReviewBatchStatus,
  updateMediaReviewFace,
  createMediaReviewArtifactSignedUrl,
  fetchKnownPeopleNames,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
  type MediaReviewFace,
  type MediaReviewFaceStatus,
} from '@/lib/supabase'
import type { ReviewImportManifestRow } from '@/components/admin/MediaReviewPanel'

// Constants
const PHOTO_LOOKUP_CHUNK_SIZE = 40
const PERSON_GROUP_SAMPLE_LIMIT = 60

// Types
export interface FaceDraft {
  reviewStatus: MediaReviewFaceStatus
  confirmedName: string
  personKey: string
  notes: string
}

export interface ReviewPhotoRecord {
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

export interface PersonGroup {
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

// Utility functions (moved from MediaReviewPanel)
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

function slugifyPerson(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getMetadataValue<T>(face: MediaReviewFace, key: string): T | null {
  if (!face.metadata || typeof face.metadata !== 'object') return null
  const value = (face.metadata as Record<string, unknown>)[key]
  return value == null ? null : (value as T)
}

function getFaceLabel(face: MediaReviewFace) {
  return face.confirmed_name || getMetadataValue<string>(face, 'suggestedLabel') || face.cluster_id || face.face_id
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

interface MediaReviewState {
  // State
  batches: MediaReviewBatch[]
  faces: MediaReviewFace[]
  knownPeople: string[]
  faceDrafts: Record<string, FaceDraft>
  selectedBatchId: string | null
  selectedPhotoKey: string | null
  selectedFaceId: string | null
  selectedGroupKey: string | null
  selectedGroupFaceId: string | null
  personSearch: string
  loading: boolean
  savingKey: string | null
  syncingBatchId: string | null
  importRows: ReviewImportManifestRow[]
  cropPreviewUrls: Record<string, string>
  showAllGroupSamples: boolean
  showAdvancedTools: boolean
  lastSavedSummary: string | null
  photoInspectorOpen: boolean

  // Computed getters
  getSelectedBatch: () => MediaReviewBatch | null
  getPhotoRecords: () => ReviewPhotoRecord[]
  getPhotoRecordByFaceId: () => Map<string, ReviewPhotoRecord>
  getSelectedPhoto: () => ReviewPhotoRecord | null
  getSelectedFace: () => MediaReviewFace | null
  getPersonGroups: () => PersonGroup[]
  getFilteredGroups: (search: string) => PersonGroup[]
  getSelectedGroup: () => PersonGroup | null
  getSelectedGroupFace: () => MediaReviewFace | null
  getSelectedGroupPhoto: () => ReviewPhotoRecord | null
  getSelectedGroupDraft: () => FaceDraft | null
  getChangedFaceIds: () => string[]
  getChangedGroupCount: () => number
  getPendingFaceCount: () => number

  // Actions
  loadBatches: () => Promise<void>
  loadBatchDetails: (batch: MediaReviewBatch) => Promise<void>
  updateDraft: (faceId: string, patch: Partial<FaceDraft>) => void
  updateFacesDrafts: (faceIds: string[], patch: Partial<FaceDraft>) => void
  resetFaces: (faceIds: string[]) => void
  replaceFaces: (updatedFaces: MediaReviewFace[]) => void
  stageGroupStatus: (status: MediaReviewFaceStatus) => void
  openFaceInPhotoReview: (face: MediaReviewFace) => void
  saveFaces: (faceIds: string[]) => Promise<void>
  handleBatchStatusChange: (batch: MediaReviewBatch, status: MediaReviewBatchStatus) => void
  setSelectedBatchId: (id: string | null) => void
  setSelectedPhotoKey: (key: string | null) => void
  setSelectedFaceId: (id: string | null) => void
  setSelectedGroupKey: (key: string | null) => void
  setSelectedGroupFaceId: (id: string | null) => void
  setPersonSearch: (search: string) => void
  setShowAllGroupSamples: (show: boolean) => void
  setShowAdvancedTools: (show: boolean) => void
  setPhotoInspectorOpen: (open: boolean) => void
  setLastSavedSummary: (summary: string | null) => void
  setCropPreviewUrls: (urls: Record<string, string>) => void
  loadCropPreviews: () => Promise<void>
}

async function readJsonArtifact<T>(batch: MediaReviewBatch, artifactKey: string): Promise<T | null> {
  const objectPath = String(batch.artifact_paths?.[artifactKey] || '')
  if (!objectPath) return null

  const { data, error } = await import('@/lib/supabase').then(m => m.downloadMediaReviewArtifact(batch.artifact_bucket, objectPath))
  if (error || !data) {
    return null
  }

  return JSON.parse(await data.text()) as T
}

export const useMediaReviewStore = create<MediaReviewState>()(
  devtools(
    (set, get) => ({
      // Initial state
      batches: [],
      faces: [],
      knownPeople: [],
      faceDrafts: {},
      selectedBatchId: null,
      selectedPhotoKey: null,
      selectedFaceId: null,
      selectedGroupKey: null,
      selectedGroupFaceId: null,
      personSearch: '',
      loading: true,
      savingKey: null,
      syncingBatchId: null,
      importRows: [],
      cropPreviewUrls: {},
      showAllGroupSamples: false,
      showAdvancedTools: false,
      lastSavedSummary: null,
      photoInspectorOpen: false,

      // Computed getters
      getSelectedBatch: () => {
        const { batches, selectedBatchId } = get()
        return batches.find((batch) => batch.id === selectedBatchId) || null
      },

      getPhotoRecords: () => {
        const { faces, importRows } = get()
        return buildPhotoRecords(faces, importRows)
      },

      getPhotoRecordByFaceId: () => {
        const photoRecords = get().getPhotoRecords()
        const entries: Array<[string, ReviewPhotoRecord]> = []
        photoRecords.forEach((photo) => {
          photo.faces.forEach((face) => {
            entries.push([face.id, photo])
          })
        })
        return new Map(entries)
      },

      getSelectedPhoto: () => {
        const photoRecords = get().getPhotoRecords()
        const { selectedPhotoKey } = get()
        return photoRecords.find((photo) => photo.key === selectedPhotoKey) || null
      },

      getSelectedFace: () => {
        const selectedPhoto = get().getSelectedPhoto()
        const { selectedFaceId } = get()
        return selectedPhoto?.faces.find((face) => face.id === selectedFaceId) || selectedPhoto?.faces[0] || null
      },

      getPersonGroups: () => {
        const { faces } = get()
        return buildPersonGroups(faces)
      },

      getFilteredGroups: (search: string) => {
        const personGroups = get().getPersonGroups()
        const query = search.trim().toLowerCase()
        if (!query) return personGroups

        return personGroups.filter((group) => {
          return [
            group.label,
            group.key,
            ...group.faces.map((face) => face.source_relative_path || ''),
          ].some((value) => value.toLowerCase().includes(query))
        })
      },

      getSelectedGroup: () => {
        const filteredGroups = get().getFilteredGroups(get().personSearch)
        const personGroups = get().getPersonGroups()
        const { selectedGroupKey } = get()
        return filteredGroups.find((group) => group.key === selectedGroupKey) || personGroups.find((group) => group.key === selectedGroupKey) || null
      },

      getSelectedGroupFace: () => {
        const selectedGroup = get().getSelectedGroup()
        const { selectedGroupFaceId } = get()
        return selectedGroup?.faces.find((face) => face.id === selectedGroupFaceId) || selectedGroup?.faces[0] || null
      },

      getSelectedGroupPhoto: () => {
        const selectedGroupFace = get().getSelectedGroupFace()
        if (!selectedGroupFace) return null
        const photoRecordByFaceId = get().getPhotoRecordByFaceId()
        return photoRecordByFaceId.get(selectedGroupFace.id) || null
      },

      getSelectedGroupDraft: () => {
        const selectedGroup = get().getSelectedGroup()
        if (!selectedGroup) return null

        const { faceDrafts } = get()
        const selectedGroupFace = get().getSelectedGroupFace()
        const firstFace = selectedGroupFace || selectedGroup.faces[0]
        const firstDraft = faceDrafts[firstFace.id] || normalizeFaceDraft(firstFace)

        return {
          confirmedName: firstDraft.confirmedName,
          personKey: firstDraft.personKey || (firstDraft.confirmedName ? slugifyPerson(firstDraft.confirmedName) : ''),
          notes: firstDraft.notes,
        }
      },

      getChangedFaceIds: () => {
        const { faces, faceDrafts } = get()
        return faces
          .filter((face) => {
            const draft = faceDrafts[face.id]
            return draft ? draftChanged(face, draft) : false
          })
          .map((face) => face.id)
      },

      getChangedGroupCount: () => {
        const personGroups = get().getPersonGroups()
        const changedFaceIds = get().getChangedFaceIds()
        const changedFaceIdSet = new Set(changedFaceIds)
        return personGroups.filter((group) => group.faceIds.some((faceId) => changedFaceIdSet.has(faceId))).length
      },

      getPendingFaceCount: () => {
        const { faces } = get()
        return faces.filter((face) => face.review_status === 'pending').length
      },

      // Actions
      loadBatches: async () => {
        set({ loading: true })
        const { data, error } = await fetchMediaReviewBatches()

        if (error) {
          console.error('Could not load review batches:', error)
          set({ loading: false })
          return
        }

        const nextBatches = (data || []).filter(isGuestReviewBatch)
        const { selectedBatchId } = get()
        set(() => ({
          batches: nextBatches,
          selectedBatchId: selectedBatchId && nextBatches.some((batch) => batch.id === selectedBatchId) ? selectedBatchId : (nextBatches[0]?.id || null),
          loading: false,
        }))
      },

      loadBatchDetails: async (batch: MediaReviewBatch) => {
        const [{ data: faceRows, error: faceError }, importManifest] = await Promise.all([
          fetchMediaReviewFaces(batch.id),
          readJsonArtifact<ReviewImportManifestRow[]>(batch, 'importManifest'),
        ])

        if (faceError) {
          console.error('Could not load face review rows for this batch:', faceError)
          return
        }

        const nextFaces = faceRows || []
        const nextImportRows = importManifest || []
        const nextGroups = buildPersonGroups(nextFaces)

        set((state) => ({
          faces: nextFaces,
          importRows: nextImportRows,
          faceDrafts: Object.fromEntries(nextFaces.map((face) => [face.id, normalizeFaceDraft(face)])),
          selectedPhotoKey: state.selectedPhotoKey || get().getPhotoRecords()[0]?.key || null,
          selectedFaceId: state.selectedFaceId || get().getPhotoRecords()[0]?.faces[0]?.id || null,
          selectedGroupKey: state.selectedGroupKey || nextGroups[0]?.key || null,
          selectedGroupFaceId: state.selectedGroupFaceId || nextGroups[0]?.faces[0]?.id || null,
          showAllGroupSamples: false,
          lastSavedSummary: null,
        }))
      },

      updateDraft: (faceId, patch) => {
        const { faces } = get()
        const face = faces.find((item) => item.id === faceId)
        set((state) => ({
          faceDrafts: {
            ...state.faceDrafts,
            [faceId]: {
              ...(state.faceDrafts[faceId] || (face ? normalizeFaceDraft(face) : {
                reviewStatus: 'pending' as MediaReviewFaceStatus,
                confirmedName: '',
                personKey: '',
                notes: '',
              })),
              ...patch,
            },
          },
        }))
      },

      updateFacesDrafts: (faceIds, patch) => {
        faceIds.forEach((faceId) => {
          get().updateDraft(faceId, patch)
        })
      },

      resetFaces: (faceIds) => {
        const { faces } = get()
        set((state) => ({
          faceDrafts: {
            ...state.faceDrafts,
            ...Object.fromEntries(
              faceIds
                .map((faceId) => faces.find((face) => face.id === faceId))
                .filter((face): face is MediaReviewFace => Boolean(face))
                .map((face) => [face.id, normalizeFaceDraft(face)]),
            ),
          },
        }))
      },

      replaceFaces: (updatedFaces) => {
        const updatedById = new Map(updatedFaces.map((face) => [face.id, face]))
        set((state) => ({
          faces: state.faces.map((face) => updatedById.get(face.id) || face),
          faceDrafts: {
            ...state.faceDrafts,
            ...Object.fromEntries(updatedFaces.map((face) => [face.id, normalizeFaceDraft(face)])),
          },
        }))
      },

      stageGroupStatus: (status) => {
        const selectedGroup = get().getSelectedGroup()
        if (!selectedGroup) return

        get().updateFacesDrafts(
          selectedGroup.faceIds,
          { reviewStatus: status },
        )
      },

      openFaceInPhotoReview: (face) => {
        set({
          selectedPhotoKey: face.source_record_id || face.photo_url || face.face_id,
          selectedFaceId: face.id,
          photoInspectorOpen: true,
        })
      },

      saveFaces: async (faceIds) => {
        const uniqueFaceIds = [...new Set(faceIds)]
        const { faces, faceDrafts } = get()
        const changedFaces = uniqueFaceIds
          .map((faceId) => {
            const face = faces.find((item) => item.id === faceId)
            const draft = faceDrafts[faceId]
            if (!face || !draft || !draftChanged(face, draft)) return null
            return { face, draft }
          })
          .filter(Boolean) as Array<{ face: MediaReviewFace; draft: FaceDraft }>

        if (changedFaces.length === 0) {
          console.warn('There are no unsaved face changes in this selection.')
          return
        }

        for (const { draft } of changedFaces) {
          if (draft.reviewStatus === 'confirmed' && !draft.confirmedName.trim()) {
            console.warn('Confirmed faces need a person name before saving.')
            return
          }
        }

        set({ savingKey: uniqueFaceIds.join(':') })

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

          get().replaceFaces(savedFaces)
          set({
            lastSavedSummary: `Saved ${savedFaces.length} change${savedFaces.length === 1 ? '' : 's'} at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
          })
        } catch (error) {
          console.error('Could not save those face review changes:', error)
        } finally {
          set({ savingKey: null })
        }
      },

      handleBatchStatusChange: async (batch, status) => {
        const previousBatches = get().batches

        // Optimistic update - immediately update UI
        set((state) => ({
          batches: state.batches.map((item) =>
            item.id === batch.id ? { ...item, status } : item
          ),
        }))

        const { data, error } = await updateMediaReviewBatchStatus(batch.id, status)
        if (error || !data) {
          // Rollback on failure
          set({ batches: previousBatches })
          console.error('Could not update the batch status:', error)
          return
        }

        // Update with server response to ensure consistency
        set((state) => ({
          batches: state.batches.map((item) => (item.id === batch.id ? data : item)),
        }))
      },

      setSelectedBatchId: (id) => set({ selectedBatchId: id }),
      setSelectedPhotoKey: (key) => set({ selectedPhotoKey: key }),
      setSelectedFaceId: (id) => set({ selectedFaceId: id }),
      setSelectedGroupKey: (key) => set({ selectedGroupKey: key }),
      setSelectedGroupFaceId: (id) => set({ selectedGroupFaceId: id }),
      setPersonSearch: (search) => set({ personSearch: search }),
      setShowAllGroupSamples: (show) => set({ showAllGroupSamples: show }),
      setShowAdvancedTools: (show) => set({ showAdvancedTools: show }),
      setPhotoInspectorOpen: (open) => set({ photoInspectorOpen: open }),
      setLastSavedSummary: (summary) => set({ lastSavedSummary: summary }),
      setCropPreviewUrls: (urls) => set({ cropPreviewUrls: urls }),

      loadCropPreviews: async () => {
        const { photoInspectorOpen, selectedGroup, selectedPhoto, selectedBatch } = get()
        const facesToPreview = photoInspectorOpen
          ? selectedPhoto?.faces || []
          : selectedGroup?.faces.slice(0, PERSON_GROUP_SAMPLE_LIMIT) || []

        if (!selectedBatch || facesToPreview.length === 0) {
          set({ cropPreviewUrls: {} })
          return
        }

        const activeBatch = selectedBatch
        const disposed = false

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
          set({ cropPreviewUrls: Object.fromEntries(pairs.filter(([, value]) => value)) })
        }
      },
    }),
    { name: 'media-review-store' }
  )
)

// Load known people on store initialization
if (typeof window !== 'undefined') {
  fetchKnownPeopleNames().then(({ data, error }) => {
    if (!error && data) {
      useMediaReviewStore.setState({ knownPeople: data })
    }
  })
}
