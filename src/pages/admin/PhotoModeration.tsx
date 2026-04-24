import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  deletePhotoComment,
  deleteGalleryPhotos,
  fetchRecentPhotoComments,
  fetchGuestFaceTaggingBatches,
  fetchModerationAuditTimeline,
  fetchNextAlbumSortOrder,
  hidePhotoComment,
  recordModerationAudit,
  supabase,
  type AdminPhotoCommentRecord,
  type GuestFaceTaggingBatch,
} from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
import {
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Video,
  RefreshCw,
  UploadCloud,
  Download,
  Copy,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { memoryTrails, type MemoryTrailId } from '@/data/memoryTrails'
import {
  buildGuestTaggingSyncPayloadFromFiles,
  downloadGuestTaggingBatchZip,
  type GuestTaggingManifest,
} from '@/utils/guestTagging'
import {
  buildGuestTaggingCommands,
  normalizeTags,
  createPromotionDraft,
  getGuestVideoVisibilityLabel,
  buildGuestVideoPromotionPatch,
  getPublishedPhotoCount,
  getGuestUploadDuplicateInsight,
  getModerationState,
  formatMemoryTrailLabel,
  getAdminAuditActor,
  groupAuditEntries,
  appendAuditEntry,
  DEFAULT_GUEST_TAGGING_ROOT,
  collectionOptions,
  type ModerationUpload,
  type ModerationCollection,
  type GuestVideoVisibility,
  type PromotionDraft,
  type ModerationQueueFilter,
  type AuditEntriesByEntityId,
} from './utils'
import { StatCard, CompactAuditHistory } from './shared'

// ─── Private constants ────────────────────────────────────────────────────────

const guestTagByCollection: Record<ModerationCollection, string[]> = {
  'Wedding Day': ['wedding day'],
  Engagement: ['engagement'],
  'Bach+ette': ['bach', 'bachelorette'],
  'Guest Uploads': ['guest upload'],
}

const defaultPromotionDraft: PromotionDraft = {
  collection: 'Wedding Day',
  category: 'Wedding Day',
  caption: '',
  tags: 'wedding day',
  location: '',
  videoVisibility: 'archive_only',
  memoryTrail: '',
}

const quickTagPresets = ['ceremony', 'portraits', 'family', 'dance floor', 'toasts', 'candids', 'details'] as const

// ─── PhotoModeration ──────────────────────────────────────────────────────────

export function PhotoModeration() {
  const [photos, setPhotos] = useState<ModerationUpload[]>([])
  const [drafts, setDrafts] = useState<Record<string, PromotionDraft>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueFilter, setQueueFilter] = useState<ModerationQueueFilter>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [guestTaggingRoot, setGuestTaggingRoot] = useState(DEFAULT_GUEST_TAGGING_ROOT)
  const [copiedCommandKey, setCopiedCommandKey] = useState<string | null>(null)
  const [guestTaggingBatches, setGuestTaggingBatches] = useState<GuestFaceTaggingBatch[]>([])
  const [isPreparingGuestTaggingBatch, setIsPreparingGuestTaggingBatch] = useState(false)
  const [isSyncingGuestTaggingBatch, setIsSyncingGuestTaggingBatch] = useState(false)
  const [guestTaggingDownloadProgress, setGuestTaggingDownloadProgress] = useState<{ completed: number; total: number } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [publishedPhotoUrls, setPublishedPhotoUrls] = useState<Set<string>>(new Set())
  const [auditByUploadId, setAuditByUploadId] = useState<AuditEntriesByEntityId>({})
  const [recentPhotoComments, setRecentPhotoComments] = useState<AdminPhotoCommentRecord[]>([])
  const [commentActionId, setCommentActionId] = useState<string | null>(null)
  const guestTaggingFileInputRef = useRef<HTMLInputElement | null>(null)
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const actor = getAdminAuditActor(user)

  const fetchPendingPhotos = useCallback(async () => {
    setLoading(true)
    const [
      { data, error },
      { data: publishedGuestPhotos, error: photosError },
      { data: auditRows, error: auditError },
      { data: guestTaggingBatchRows, error: guestTaggingBatchError },
      { data: recentCommentRows, error: recentCommentsError },
    ] = await Promise.all([
      supabase
        .from('guest_uploads')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('photos')
        .select('url')
        .eq('is_professional', false),
      fetchModerationAuditTimeline({ entityType: 'guest_upload', limit: 500 }),
      fetchGuestFaceTaggingBatches(),
      fetchRecentPhotoComments(20),
    ])

    if (error || photosError || auditError || guestTaggingBatchError || recentCommentsError) {
      addToast('Failed to load photos', 'error')
    } else {
      const uploads = (data as ModerationUpload[] | null) || []
      setPhotos(uploads)
      setPublishedPhotoUrls(new Set((publishedGuestPhotos || []).map((photo) => photo.url)))
      setAuditByUploadId(groupAuditEntries(auditRows || []))
      setGuestTaggingBatches(guestTaggingBatchRows || [])
      setRecentPhotoComments(Array.isArray(recentCommentRows) ? recentCommentRows : [])
      setDrafts(prev => {
        const next: Record<string, PromotionDraft> = {}

        for (const upload of uploads) {
          next[upload.id] = prev[upload.id] || createPromotionDraft(upload)
        }

        return next
      })
    }
    setLoading(false)
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPendingPhotos()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPendingPhotos])

  function updateDraft(id: string, patch: Partial<PromotionDraft>) {
    const upload = photos.find(photo => photo.id === id)
    setDrafts(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || (upload ? createPromotionDraft(upload) : defaultPromotionDraft)),
        ...patch,
      },
    }))
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((currentId) => currentId !== id) : [...prev, id]
    )
  }

  async function handleApprove(upload: ModerationUpload) {
    const draft = drafts[upload.id] || createPromotionDraft(upload)
    const duplicateInsight = getGuestUploadDuplicateInsight(upload, photos, publishedPhotoUrls)
    const uploadPhotoUrls = upload.photo_urls || []
    const uploadVideoUrls = upload.video_urls || []
    const tags = Array.from(new Set([...guestTagByCollection[draft.collection], ...normalizeTags(draft.tags)]))
    const targetAlbum = draft.collection as 'Engagement' | 'Bach+ette' | 'Wedding Day' | 'Guest Uploads'
    const category = targetAlbum
    const caption = draft.caption.trim() || upload.message?.trim() || undefined
    const location = draft.location.trim() || undefined

    setBusyId(upload.id)

    const { data: nextAlbumSortOrder, error: albumSortOrderError } = await fetchNextAlbumSortOrder(targetAlbum)

    if (albumSortOrderError) {
      addToast('Could not prepare the album order for this approval.', 'error')
      setBusyId(null)
      return
    }

    const startingAlbumSortOrder = nextAlbumSortOrder || 1
    const rowsToInsert = duplicateInsight.publishableEntries.map(({ url: photoUrl }, index) => ({
      url: photoUrl,
      thumbnail: photoUrl,
      album: targetAlbum,
      album_sort_order: startingAlbumSortOrder + index,
      caption,
      category: targetAlbum,
      location,
      date: upload.created_at,
      likes: 0,
      photographer: `${upload.guest_name} (Guest)`,
      is_professional: false,
      tags,
      faces: [],
    }))

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('photos')
        .insert(rowsToInsert)

      if (insertError) {
        addToast('Failed to publish approved photos into the gallery', 'error')
        setBusyId(null)
        return
      }
    }

    const { error: updateError } = await supabase
      .from('guest_uploads')
      .update({
        status: 'approved',
        ...buildGuestVideoPromotionPatch(draft),
      })
      .eq('id', upload.id)

    if (updateError) {
      if (rowsToInsert.length > 0) {
        await supabase
          .from('photos')
          .delete()
          .in('url', rowsToInsert.map(row => row.url))
      }

      addToast('The upload could not be marked approved after publishing', 'error')
      setBusyId(null)
      return
    }

    const publishedPhotoCount = rowsToInsert.length
    const skippedDuplicatePhotoCount =
      duplicateInsight.withinUploadCount +
      duplicateInsight.approvedDuplicateCount
    const nextModerationState = publishedPhotoCount > 0 ? 'approved-published' : 'approved-unpublished'
    const approvalSummary =
      publishedPhotoCount > 0
        ? `Approved and published ${publishedPhotoCount} guest photo${publishedPhotoCount === 1 ? '' : 's'} to ${draft.collection}.${skippedDuplicatePhotoCount > 0 ? ` Skipped ${skippedDuplicatePhotoCount} duplicate photo${skippedDuplicatePhotoCount === 1 ? '' : 's'}.` : ''}`
        : uploadVideoUrls.length > 0 && draft.videoVisibility === 'guest_highlights'
            ? `Approved ${upload.guest_name}'s video submission for the guest highlight lane.`
            : uploadVideoUrls.length > 0
              ? `Approved ${upload.guest_name}'s video submission for the private archive.`
          : `Approved upload from ${upload.guest_name}.`

    addToast(
      rowsToInsert.length > 0
        ? `Approved and published ${rowsToInsert.length} guest photo${rowsToInsert.length === 1 ? '' : 's'} to ${draft.collection}.${skippedDuplicatePhotoCount > 0 ? ` Skipped ${skippedDuplicatePhotoCount} duplicate photo${skippedDuplicatePhotoCount === 1 ? '' : 's'}.` : ''}`
        : uploadVideoUrls.length > 0 && draft.videoVisibility === 'guest_highlights'
          ? 'Approved the video-only upload. It is now eligible for the guest video highlights lane.'
          : uploadVideoUrls.length > 0
            ? 'Approved the video-only upload. It will stay in the private archive until you promote it later.'
          : 'Approved the upload.',
      'success'
    )

    if (rowsToInsert.length > 0) {
      setPublishedPhotoUrls(prev => new Set([...prev, ...rowsToInsert.map(row => row.url)]))
    }

    setPhotos(prev =>
      prev.map(photo =>
        photo.id === upload.id
          ? {
              ...photo,
              status: 'approved',
              ...buildGuestVideoPromotionPatch(draft),
            }
          : photo
      )
    )
    setSelectedIds(prev => prev.filter(currentId => currentId !== upload.id))

    const { data: auditEntry, error: auditError } = await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: upload.id,
      action: publishedPhotoCount > 0 ? 'upload_approved_published' : 'upload_approved_unpublished',
      actor,
      fromStatus: upload.status,
      toStatus: nextModerationState,
      summary: approvalSummary,
      metadata: {
        guest_name: upload.guest_name,
        guest_email: upload.guest_email,
        photo_count: uploadPhotoUrls.length,
        video_count: uploadVideoUrls.length,
        published_photo_count: publishedPhotoCount,
        skipped_duplicate_photo_count: skippedDuplicatePhotoCount,
        pending_overlap_photo_count: duplicateInsight.pendingOverlapCount,
        collection: draft.collection,
        category,
        location: location || null,
        tags,
        video_visibility: draft.videoVisibility,
        memory_trail: draft.memoryTrail || null,
      },
    })

    if (auditError) {
      addToast('Approved upload, but the moderation history could not be recorded.', 'warning')
    } else if (auditEntry) {
      setAuditByUploadId(prev => appendAuditEntry(prev, auditEntry))
    }

    setBusyId(null)
  }

  async function handleSaveVideoPromotion(upload: ModerationUpload) {
    const draft = drafts[upload.id] || createPromotionDraft(upload)
    setBusyId(upload.id)

    const { error } = await supabase
      .from('guest_uploads')
      .update(buildGuestVideoPromotionPatch(draft))
      .eq('id', upload.id)

    if (error) {
      addToast('Could not save the guest video settings.', 'error')
      setBusyId(null)
      return
    }

    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === upload.id
          ? {
              ...photo,
              ...buildGuestVideoPromotionPatch(draft),
            }
          : photo
      )
    )
    addToast('Guest video settings saved.', 'success')
    setBusyId(null)
  }

  async function handleRemoveFromGallery(upload: ModerationUpload) {
    const livePhotoUrls = (upload.photo_urls || []).filter((url) => publishedPhotoUrls.has(url))
    if (livePhotoUrls.length === 0) {
      addToast('There are no live gallery photos to remove for this upload.', 'warning')
      return
    }

    const confirmed = window.confirm(
      `Remove ${livePhotoUrls.length} photo${livePhotoUrls.length === 1 ? '' : 's'} from the live gallery? This keeps the original upload and files, but removes the public photo rows plus any likes/comments tied to them.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(upload.id)

    const { data, error } = await deleteGalleryPhotos({
      photoUrls: livePhotoUrls,
    })

    if (error) {
      addToast('Could not remove those photos from the live gallery.', 'error')
      setBusyId(null)
      return
    }

    const deletedPhotoUrls = new Set(data?.deleted_photo_urls || livePhotoUrls)

    setPublishedPhotoUrls((prev) => {
      const next = new Set(prev)
      for (const photoUrl of deletedPhotoUrls) {
        next.delete(photoUrl)
      }
      return next
    })

    addToast(
      `Removed ${data?.deleted_count || livePhotoUrls.length} live photo${(data?.deleted_count || livePhotoUrls.length) === 1 ? '' : 's'} from the gallery.`,
      'success',
    )

    const { data: auditEntry, error: auditError } = await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: upload.id,
      action: 'upload_removed_from_gallery',
      actor,
      fromStatus: 'approved-published',
      toStatus: 'approved-unpublished',
      summary: `Removed ${data?.deleted_count || livePhotoUrls.length} live gallery photo${(data?.deleted_count || livePhotoUrls.length) === 1 ? '' : 's'} from ${upload.guest_name}'s upload.`,
      metadata: {
        guest_name: upload.guest_name,
        guest_email: upload.guest_email,
        deleted_live_photo_count: data?.deleted_count || livePhotoUrls.length,
        deleted_photo_urls: Array.from(deletedPhotoUrls),
      },
    })

    if (auditError) {
      addToast('Removed the live photos, but the moderation history could not be recorded.', 'warning')
    } else if (auditEntry) {
      setAuditByUploadId((prev) => appendAuditEntry(prev, auditEntry))
    }

    setBusyId(null)
  }

  async function handleTogglePhotoCommentVisibility(comment: AdminPhotoCommentRecord) {
    setCommentActionId(comment.id)
    const nextHidden = !comment.is_hidden
    const { data, error } = await hidePhotoComment(
      comment.id,
      nextHidden,
      nextHidden ? 'Hidden from admin photo moderation.' : undefined,
    )

    if (error || !data) {
      addToast('Could not update that photo comment.', 'error')
      setCommentActionId(null)
      return
    }

    setRecentPhotoComments((prev) =>
      prev.map((entry) =>
        entry.id === comment.id
          ? {
              ...entry,
              is_hidden: nextHidden,
            }
          : entry,
      ),
    )
    addToast(nextHidden ? 'Comment hidden from guests.' : 'Comment restored to the gallery.', 'success')
    setCommentActionId(null)
  }

  async function handleDeletePhotoComment(comment: AdminPhotoCommentRecord) {
    const confirmed = window.confirm(`Delete ${comment.author}'s comment from this photo?`)
    if (!confirmed) {
      return
    }

    setCommentActionId(comment.id)
    const { error } = await deletePhotoComment(comment.id)

    if (error) {
      addToast('Could not delete that photo comment.', 'error')
      setCommentActionId(null)
      return
    }

    setRecentPhotoComments((prev) => prev.filter((entry) => entry.id !== comment.id))
    addToast('Photo comment deleted.', 'success')
    setCommentActionId(null)
  }

  async function handleReject(id: string) {
    const upload = photos.find(photo => photo.id === id)
    if (!upload) return

    setBusyId(id)
    const { error } = await supabase
      .from('guest_uploads')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      addToast('Failed to reject photo', 'error')
    } else {
      addToast('Photo rejected', 'success')
      setPhotos(prev =>
        prev.map(photo => (photo.id === id ? { ...photo, status: 'rejected' } : photo))
      )
      setSelectedIds(prev => prev.filter(currentId => currentId !== id))

      const { data: auditEntry, error: auditError } = await recordModerationAudit({
        entityType: 'guest_upload',
        entityId: upload.id,
        action: 'upload_rejected',
        actor,
        fromStatus: upload.status,
        toStatus: 'rejected',
        summary: `Rejected upload from ${upload.guest_name}.`,
        metadata: {
          guest_name: upload.guest_name,
          guest_email: upload.guest_email,
          photo_count: upload.photo_urls?.length || 0,
          video_count: upload.video_urls?.length || 0,
        },
      })

      if (auditError) {
        addToast('Rejected the upload, but the moderation history could not be recorded.', 'warning')
      } else if (auditEntry) {
        setAuditByUploadId(prev => appendAuditEntry(prev, auditEntry))
      }
    }
    setBusyId(null)
  }

  async function handleMoveToPending(id: string) {
    const upload = photos.find(photo => photo.id === id)
    if (!upload) return

    setBusyId(id)
    const { error } = await supabase
      .from('guest_uploads')
      .update({ status: 'pending' })
      .eq('id', id)

    if (error) {
      addToast('Failed to move upload back to pending', 'error')
    } else {
      addToast('Upload moved back to pending review', 'success')
      setPhotos(prev =>
        prev.map(photo => (photo.id === id ? { ...photo, status: 'pending' } : photo))
      )

      const { data: auditEntry, error: auditError } = await recordModerationAudit({
        entityType: 'guest_upload',
        entityId: upload.id,
        action: 'upload_moved_to_pending',
        actor,
        fromStatus: getModerationState(upload, publishedPhotoUrls),
        toStatus: 'pending',
        summary: `Moved ${upload.guest_name}'s upload back into pending review.`,
        metadata: {
          guest_name: upload.guest_name,
          guest_email: upload.guest_email,
          photo_count: upload.photo_urls?.length || 0,
          video_count: upload.video_urls?.length || 0,
        },
      })

      if (auditError) {
        addToast('Moved the upload back to pending, but the moderation history could not be recorded.', 'warning')
      } else if (auditEntry) {
        setAuditByUploadId(prev => appendAuditEntry(prev, auditEntry))
      }
    }
    setBusyId(null)
  }

  async function handleBulkReject() {
    if (selectedIds.length === 0) return
    const selectedUploads = photos.filter(photo => selectedIds.includes(photo.id))

    const { error } = await supabase
      .from('guest_uploads')
      .update({ status: 'rejected' })
      .in('id', selectedIds)

    if (error) {
      addToast('Failed to reject the selected uploads', 'error')
      return
    }

    setPhotos(prev =>
      prev.map(photo =>
        selectedIds.includes(photo.id) ? { ...photo, status: 'rejected' } : photo
      )
    )
    addToast(`Rejected ${selectedIds.length} upload${selectedIds.length === 1 ? '' : 's'}.`, 'success')

    const auditResults = await Promise.allSettled(
      selectedUploads.map((upload) =>
        recordModerationAudit({
          entityType: 'guest_upload',
          entityId: upload.id,
          action: 'upload_bulk_rejected',
          actor,
          fromStatus: upload.status,
          toStatus: 'rejected',
          summary: `Bulk rejected upload from ${upload.guest_name}.`,
          metadata: {
            guest_name: upload.guest_name,
            guest_email: upload.guest_email,
            photo_count: upload.photo_urls?.length || 0,
            video_count: upload.video_urls?.length || 0,
            bulk_count: selectedUploads.length,
          },
        })
      )
    )

    const successfulAuditEntries = auditResults.flatMap((result) => {
      if (result.status !== 'fulfilled' || result.value.error || !result.value.data) {
        return []
      }

      return [result.value.data]
    })

    if (successfulAuditEntries.length > 0) {
      setAuditByUploadId((prev) =>
        successfulAuditEntries.reduce((acc, entry) => appendAuditEntry(acc, entry), prev)
      )
    }

    if (successfulAuditEntries.length !== selectedUploads.length) {
      addToast('Rejected the selected uploads, but part of the moderation history could not be recorded.', 'warning')
    }

    setSelectedIds([])
  }

  const queueCounts = photos.reduce<Record<ModerationQueueFilter, number>>(
    (counts, upload) => {
      counts[getModerationState(upload, publishedPhotoUrls)] += 1
      return counts
    },
    {
      pending: 0,
      'approved-unpublished': 0,
      'approved-published': 0,
      rejected: 0,
    }
  )

  const filteredUploads = photos.filter((upload) => {
    const moderationState = getModerationState(upload, publishedPhotoUrls)
    if (moderationState !== queueFilter) return false

    const haystack = `${upload.guest_name} ${upload.guest_email} ${upload.message || ''} ${(drafts[upload.id]?.collection || '')}`.toLowerCase()
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase())
  })

  const guestTaggingCommands = useMemo(() => buildGuestTaggingCommands(guestTaggingRoot), [guestTaggingRoot])
  const latestGuestTaggingBatch = guestTaggingBatches[0] ?? null
  const readyGuestTaggingUploads = useMemo(
    () => photos.filter((upload) => getModerationState(upload, publishedPhotoUrls) === 'approved-published'),
    [photos, publishedPhotoUrls],
  )
  const readyGuestTaggingUploadCount = readyGuestTaggingUploads.length
  const readyGuestTaggingPhotoCount = useMemo(
    () => readyGuestTaggingUploads.reduce((sum, upload) => sum + getPublishedPhotoCount(upload, publishedPhotoUrls), 0),
    [readyGuestTaggingUploads, publishedPhotoUrls],
  )
  const pendingGuestTaggingPhotoCount = useMemo(
    () =>
      photos
        .filter((upload) => getModerationState(upload, publishedPhotoUrls) === 'approved-unpublished')
        .reduce((sum, upload) => sum + (upload.photo_urls?.length || 0), 0),
    [photos, publishedPhotoUrls],
  )

  const handleCopyGuestTaggingCommand = useCallback(async (command: string, commandKey: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommandKey(commandKey)
      addToast('Command copied. Run it from your local project terminal.', 'success')
      window.setTimeout(() => {
        setCopiedCommandKey((current) => (current === commandKey ? null : current))
      }, 1800)
    } catch {
      addToast('Could not copy the command. Please copy it manually.', 'error')
    }
  }, [addToast])

  const refreshGuestTaggingBatches = useCallback(async () => {
    const { data, error } = await fetchGuestFaceTaggingBatches()
    if (error) {
      addToast('Could not refresh guest tagging status.', 'error')
      return
    }

    setGuestTaggingBatches(data || [])
  }, [addToast])

  const handlePrepareGuestTaggingBatch = useCallback(async () => {
    setIsPreparingGuestTaggingBatch(true)
    setGuestTaggingDownloadProgress(null)

    try {
      const { data, error } = await supabase.functions.invoke('guest-face-tagging-admin', {
        body: {
          action: 'prepare_export',
        },
      })

      if (error) {
        throw error
      }

      const manifest = data?.manifest as GuestTaggingManifest | undefined
      if (!manifest) {
        throw new Error('The guest tagging manifest could not be created.')
      }

      await downloadGuestTaggingBatchZip(manifest, (completed, total) => {
        setGuestTaggingDownloadProgress({ completed, total })
      })

      addToast(
        manifest.exportablePhotoCount > 0
          ? `Downloaded a guest tagging batch with ${manifest.exportablePhotoCount} photo${manifest.exportablePhotoCount === 1 ? '' : 's'}.`
          : 'No approved guest photos are ready for tagging yet.',
        manifest.exportablePhotoCount > 0 ? 'success' : 'warning',
      )
      await refreshGuestTaggingBatches()
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not prepare the guest tagging batch.', 'error')
    } finally {
      setIsPreparingGuestTaggingBatch(false)
      setGuestTaggingDownloadProgress(null)
    }
  }, [addToast, refreshGuestTaggingBatches])

  const handleGuestTaggingFileSelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) {
      return
    }

    setIsSyncingGuestTaggingBatch(true)

    try {
      const payload = await buildGuestTaggingSyncPayloadFromFiles(selectedFiles)
      if (payload.updates.length === 0) {
        throw new Error('No digiKam face metadata was found in the selected files.')
      }

      const { data, error } = await supabase.functions.invoke('guest-face-tagging-admin', {
        body: {
          action: 'sync_tagged_batch',
          ...payload,
        },
      })

      if (error) {
        throw error
      }

      addToast(
        `Synced face metadata for ${data?.syncedPhotoCount ?? payload.updates.length} guest photo${(data?.syncedPhotoCount ?? payload.updates.length) === 1 ? '' : 's'}.`,
        'success',
      )
      await refreshGuestTaggingBatches()
      await fetchPendingPhotos()
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not sync the tagged guest batch.', 'error')
    } finally {
      setIsSyncingGuestTaggingBatch(false)
      event.target.value = ''
    }
  }, [addToast, fetchPendingPhotos, refreshGuestTaggingBatches])

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <ComponentErrorBoundary componentName="Photo Moderation">
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Content Operations</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Review every upload inside one workflow: curate photo submissions into the live gallery, keep approved video
          submissions ready for the guest highlight lane, and keep rejected items out of the public archive.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending review" value={queueCounts.pending} icon={Eye} color="amber" alert={queueCounts.pending > 0} />
        <StatCard title="Approved, not yet public" value={queueCounts['approved-unpublished']} icon={Video} color="purple" />
        <StatCard title="Approved + public" value={queueCounts['approved-published']} icon={CheckCircle} color="green" />
        <StatCard title="Rejected" value={queueCounts.rejected} icon={XCircle} color="blue" />
      </div>

      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {([
                ['pending', 'Pending'],
                ['approved-unpublished', 'Approved, not public'],
                ['approved-published', 'Approved + public'],
                ['rejected', 'Rejected'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setQueueFilter(value)
                    setSelectedIds([])
                  }}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    queueFilter === value
                      ? 'bg-gold-500 text-white'
                      : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-charcoal-500">
              Pending items can be curated directly into the gallery. Approved video-only submissions stay ready for the
              film-page guest highlight lane.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by guest name, email, note, or lane"
              className="min-w-[18rem]"
            />
            {queueFilter === 'pending' && selectedIds.length > 0 && (
              <Button variant="danger" onClick={handleBulkReject}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject selected ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-gold-100 bg-[linear-gradient(145deg,rgba(250,245,236,0.9),rgba(255,252,248,0.98))] p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Guest Face Tagging</p>
              <h3 className="text-xl font-display text-charcoal-900">Run approved guest photos through digiKam, then sync faces back into the gallery</h3>
            </div>
            <p className="text-sm leading-6 text-charcoal-600">
              This admin screen helps you launch the local workflow, but the actual face tagging happens in digiKam on
              your machine. Exact duplicates are already filtered before guest photos go public, so this export focuses
              on approved guest images that already exist in the live gallery.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-gold-100 bg-white/88 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Ready for tagging</p>
                <p className="mt-2 text-3xl font-display text-charcoal-900">{readyGuestTaggingPhotoCount}</p>
                <p className="mt-2 text-xs leading-5 text-charcoal-500">
                  Live guest photos across {readyGuestTaggingUploadCount} approved upload{readyGuestTaggingUploadCount === 1 ? '' : 's'} that can go straight into the digiKam batch.
                </p>
              </div>
              <div className="rounded-2xl border border-gold-100 bg-white/88 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Waiting on publication</p>
                <p className="mt-2 text-3xl font-display text-charcoal-900">{pendingGuestTaggingPhotoCount}</p>
                <p className="mt-2 text-xs leading-5 text-charcoal-500">
                  Approved guest photos that are not exportable yet, usually because they were duplicate-only or not published into the live gallery.
                </p>
              </div>
              <div className="rounded-2xl border border-gold-100 bg-white/88 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Last sync</p>
                <p className="mt-2 text-sm font-medium text-charcoal-900">
                  {latestGuestTaggingBatch?.last_synced_at
                    ? new Date(latestGuestTaggingBatch.last_synced_at).toLocaleString()
                    : 'No guest sync yet'}
                </p>
                <p className="mt-2 text-xs leading-5 text-charcoal-500">
                  {latestGuestTaggingBatch
                    ? `${latestGuestTaggingBatch.synced_photo_count} photo${latestGuestTaggingBatch.synced_photo_count === 1 ? '' : 's'} synced · status ${latestGuestTaggingBatch.status}`
                    : 'Once a guest batch is synced, the latest result will show up here.'}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl rounded-[1.25rem] border border-gold-100 bg-white/92 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-charcoal-900">Terminal-free guest tagging workflow</p>
                <p className="mt-1 text-xs leading-5 text-charcoal-500">
                  Download a zipped digiKam batch here, then upload the tagged batch files back for a metadata-only sync.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void refreshGuestTaggingBatches()}
                disabled={isPreparingGuestTaggingBatch || isSyncingGuestTaggingBatch}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh status
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-gold-100 bg-cream-50/70 p-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="font-medium text-charcoal-900">1. Download a fresh guest tagging batch</p>
                    <p className="text-xs leading-5 text-charcoal-500">
                      This creates a manifest from the live approved guest gallery, packages the photos into a single zip, and records the batch for later sync status.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handlePrepareGuestTaggingBatch()}
                      disabled={isPreparingGuestTaggingBatch || readyGuestTaggingPhotoCount === 0}
                      isLoading={isPreparingGuestTaggingBatch}
                    >
                      <Download className="h-4 w-4" />
                      Download guest tagging zip
                    </Button>
                    {guestTaggingDownloadProgress && (
                      <p className="text-xs leading-5 text-charcoal-500">
                        Downloading {guestTaggingDownloadProgress.completed} of {guestTaggingDownloadProgress.total} photo{guestTaggingDownloadProgress.total === 1 ? '' : 's'}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gold-100 bg-cream-50/70 p-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="font-medium text-charcoal-900">2. After tagging in digiKam, upload the tagged batch files</p>
                    <p className="text-xs leading-5 text-charcoal-500">
                      Select the extracted batch contents, including `guest-tagging-manifest.json` and the tagged image files. The browser reads the digiKam face metadata locally and only sends compact face updates back to Supabase.
                    </p>
                  </div>
                  <input
                    ref={guestTaggingFileInputRef}
                    type="file"
                    multiple
                    accept=".json,.xmp,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    aria-label="Upload tagged guest photo batch files"
                    onChange={(event) => void handleGuestTaggingFileSelection(event)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => guestTaggingFileInputRef.current?.click()}
                    disabled={isPreparingGuestTaggingBatch || isSyncingGuestTaggingBatch}
                    isLoading={isSyncingGuestTaggingBatch}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Sync tagged batch
                  </Button>
                </div>
              </div>

              <details className="rounded-2xl border border-gold-100 bg-white/88 p-4">
                <summary className="cursor-pointer font-medium text-charcoal-900">
                  Local terminal fallback
                </summary>
                <div className="mt-4 space-y-3">
                  <Label htmlFor="guest-tagging-root" className="mb-2 block text-xs normal-case tracking-normal text-charcoal-500">
                    Local guest tagging working root
                  </Label>
                  <Input
                    id="guest-tagging-root"
                    value={guestTaggingRoot}
                    onChange={(event) => setGuestTaggingRoot(event.target.value)}
                    placeholder={DEFAULT_GUEST_TAGGING_ROOT}
                  />
                  {[
                    {
                      key: 'export',
                      title: 'Export approved guest photos',
                      command: guestTaggingCommands.export,
                    },
                    {
                      key: 'import',
                      title: 'Import digiKam metadata',
                      command: guestTaggingCommands.import,
                    },
                    {
                      key: 'sync',
                      title: 'Sync guest face metadata',
                      command: guestTaggingCommands.sync,
                    },
                  ].map((step) => (
                    <div key={step.key} className="rounded-2xl border border-gold-100 bg-cream-50/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="font-medium text-charcoal-900">{step.title}</p>
                        <Button
                          type="button"
                          variant={copiedCommandKey === step.key ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => void handleCopyGuestTaggingCommand(step.command, step.key)}
                        >
                          <Copy className="h-4 w-4" />
                          {copiedCommandKey === step.key ? 'Copied' : 'Copy command'}
                        </Button>
                      </div>
                      <pre className="mt-3 overflow-x-auto rounded-2xl bg-charcoal-900 px-4 py-3 text-xs leading-6 text-cream-50">
                        <code>{step.command}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-[1.3rem] border border-gold-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Photo comments</p>
            <h3 className="mt-1 text-xl font-display text-charcoal-900">Recent gallery conversation</h3>
            <p className="mt-1 text-sm leading-6 text-charcoal-500">
              Comments go live immediately, so this is the cleanup backstop if something needs to be hidden or deleted.
            </p>
          </div>
          <span className="rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5 text-xs text-charcoal-600">
            {recentPhotoComments.length} recent comment{recentPhotoComments.length === 1 ? '' : 's'}
          </span>
        </div>

        {recentPhotoComments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gold-200 bg-cream-50/60 px-4 py-8 text-center text-sm text-charcoal-500">
            No public photo comments yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {recentPhotoComments.map((comment) => (
              <article key={comment.id} className="rounded-2xl border border-gold-100 bg-cream-50/60 p-4">
                <div className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-charcoal-100">
                    {comment.thumbnail || comment.url ? (
                      <img
                        src={getMediaPath(comment.thumbnail || comment.url || '')}
                        alt={comment.caption || 'Commented photo'}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal-500">
                      <span className="font-medium text-charcoal-800">{comment.author}</span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                      {comment.album && (
                        <span className="rounded-full border border-gold-200 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-charcoal-600">
                          {comment.album}
                        </span>
                      )}
                      {comment.is_hidden && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-700">
                          Hidden
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-charcoal-700">{comment.content}</p>
                    {comment.caption && (
                      <p className="mt-2 line-clamp-1 text-xs text-charcoal-500">{comment.caption}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleTogglePhotoCommentVisibility(comment)}
                        disabled={commentActionId === comment.id}
                      >
                        <EyeOff className="mr-2 h-4 w-4" />
                        {comment.is_hidden ? 'Unhide' : 'Hide'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void handleDeletePhotoComment(comment)}
                        disabled={commentActionId === comment.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {filteredUploads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gold-100">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-charcoal-600">
            {queueFilter === 'pending'
              ? 'No pending guest uploads to review.'
              : queueFilter === 'approved-unpublished'
                ? 'No approved-but-not-public uploads right now.'
                : queueFilter === 'approved-published'
                  ? 'No approved uploads have been published yet.'
                  : 'No rejected uploads right now.'}
          </p>
        </div>
      ) : (
        <div data-testid="upload-queue" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filteredUploads.map((photo, photoIndex) => {
            const moderationState = getModerationState(photo, publishedPhotoUrls)
            const isPending = moderationState === 'pending'
            const isApprovedPublished = moderationState === 'approved-published'
            const isApprovedUnpublished = moderationState === 'approved-unpublished'
            const isRejected = moderationState === 'rejected'
            const publishedPhotoCount = getPublishedPhotoCount(photo, publishedPhotoUrls)
            const photoCount = photo.photo_urls?.length || 0
            const videoCount = photo.video_urls?.length || 0
            const draft = drafts[photo.id] || createPromotionDraft(photo)
            const auditEntries = auditByUploadId[photo.id] || []
            const shouldShowAuditHistory = !isPending || auditEntries.length > 0
            const duplicateInsight = getGuestUploadDuplicateInsight(photo, photos, publishedPhotoUrls)
            const fieldIdPrefix = `upload-${photo.id}-${photoIndex}`
            const hasDuplicateWarning =
              duplicateInsight.withinUploadCount > 0 ||
              duplicateInsight.approvedDuplicateCount > 0 ||
              duplicateInsight.pendingOverlapCount > 0

            return (
            <div key={photo.id} className="overflow-hidden rounded-[1.5rem] border border-gold-100 bg-white shadow-sm">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="relative aspect-[4/3] bg-gray-100 lg:aspect-auto">
                  {photo.photo_urls?.[0] ? (
                  <img
                    src={photo.photo_urls[0]}
                    alt="Guest upload"
                    className="w-full h-full object-cover"
                  />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(145deg,rgba(250,242,231,0.9),rgba(255,249,241,0.96))] px-6 text-center">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-charcoal-500">
                        Video-only upload
                      </span>
                      <p className="max-w-xs text-sm leading-6 text-charcoal-500">
                        This submission only includes video clips. Approval keeps it available for the film-page guest
                        highlight lane instead of the main photo gallery.
                      </p>
                    </div>
                  )}

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-charcoal-900/72 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white backdrop-blur-sm">
                      {photoCount} photo{photoCount === 1 ? '' : 's'}
                    </span>
                    {videoCount > 0 && (
                      <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-charcoal-600 backdrop-blur-sm">
                        {videoCount} video{videoCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {isPending && (
                    <label className="absolute right-4 top-4 flex cursor-pointer items-center gap-2 rounded-full bg-white/88 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-charcoal-600 backdrop-blur-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(photo.id)}
                        onChange={() => toggleSelected(photo.id)}
                        className="h-3.5 w-3.5 rounded border-gold-300 text-gold-600 focus:ring-gold-500"
                      />
                      Select
                    </label>
                  )}
                </div>

                <div className="space-y-5 p-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-charcoal-900">{photo.guest_name}</p>
                        <p className="text-sm text-charcoal-500">{photo.guest_email}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.28em] ${
                        isPending
                          ? 'bg-gold-50 text-gold-700'
                          : isApprovedPublished
                            ? 'bg-green-50 text-green-700'
                            : isApprovedUnpublished
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-rose-50 text-rose-600'
                      }`}>
                        {isPending
                          ? 'Pending curation'
                          : isApprovedPublished
                            ? 'Approved + public'
                            : isApprovedUnpublished
                              ? 'Approved, not public'
                              : 'Rejected'}
                      </span>
                    </div>

                    {photo.message && (
                      <p className="rounded-2xl border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm leading-6 text-charcoal-600">
                        "{photo.message}"
                      </p>
                    )}

                    {isPending && hasDuplicateWarning && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800">
                        <p className="font-medium text-amber-900">Duplicate cleanup</p>
                        <p className="mt-1">
                          {duplicateInsight.publishableCount} of {photoCount} photo{photoCount === 1 ? '' : 's'} will publish from this upload after duplicate checks.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {duplicateInsight.withinUploadCount > 0 && (
                            <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1">
                              {duplicateInsight.withinUploadCount} repeated in this upload
                            </span>
                          )}
                          {duplicateInsight.approvedDuplicateCount > 0 && (
                            <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1">
                              {duplicateInsight.approvedDuplicateCount} already approved elsewhere
                            </span>
                          )}
                          {duplicateInsight.pendingOverlapCount > 0 && (
                            <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1">
                              {duplicateInsight.pendingOverlapCount} also appear in another pending upload
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {isPending ? (
                    <>
                      <div className="rounded-[1.25rem] border border-gold-100 bg-[linear-gradient(145deg,rgba(250,245,236,0.82),rgba(255,252,248,0.96))] p-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">
                          Publish into the gallery
                        </p>

                        <div className="mt-4 grid gap-4">
                          <div>
                            <Label
                              htmlFor={`${fieldIdPrefix}-collection`}
                              className="mb-2 text-xs normal-case tracking-normal text-charcoal-500"
                            >
                              Story lane
                            </Label>
                            <select
                              id={`${fieldIdPrefix}-collection`}
                              value={draft.collection}
                              onChange={(event) => {
                                const collection = event.target.value as ModerationCollection
                                const preset = collectionOptions.find(option => option.value === collection)
                                updateDraft(photo.id, {
                                  collection,
                                  category: preset?.defaultCategory || collection,
                                  tags: Array.from(
                                    new Set([
                                      ...normalizeTags(draft.tags),
                                      ...(preset?.defaultTags || []),
                                    ])
                                  ).join(', '),
                                })
                              }}
                              className="h-11 w-full rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                            >
                              {collectionOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.value}
                                </option>
                              ))}
                            </select>
                            <p className="mt-2 text-xs leading-5 text-charcoal-500">
                              {collectionOptions.find(option => option.value === draft.collection)?.description}
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                            <div className="rounded-2xl border border-gold-100 bg-cream-50/80 px-4 py-3">
                              <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-400">Public album</p>
                              <p className="mt-2 text-sm text-charcoal-700">{draft.collection}</p>
                              <p className="mt-2 text-xs leading-5 text-charcoal-500">
                                Album placement now follows the collection you choose above.
                              </p>
                            </div>

                            <div>
                              <Label
                                htmlFor={`location-${photo.id}`}
                                className="mb-2 text-xs normal-case tracking-normal text-charcoal-500"
                              >
                                Location
                              </Label>
                              <Input
                                id={`location-${photo.id}`}
                                value={draft.location}
                                onChange={(event) => updateDraft(photo.id, { location: event.target.value })}
                                placeholder="Reception hall, ceremony lawn..."
                              />
                            </div>
                          </div>

                          <div>
                            <Label
                              htmlFor={`caption-${photo.id}`}
                              className="mb-2 text-xs normal-case tracking-normal text-charcoal-500"
                            >
                              Caption for the gallery
                            </Label>
                            <Textarea
                              id={`caption-${photo.id}`}
                              value={draft.caption}
                              onChange={(event) => updateDraft(photo.id, { caption: event.target.value })}
                              placeholder="A polished caption guests will read in the gallery lightbox."
                              className="min-h-[96px]"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`tags-${photo.id}`}
                              className="mb-2 text-xs normal-case tracking-normal text-charcoal-500"
                            >
                              Tags
                            </Label>
                            <Input
                              id={`tags-${photo.id}`}
                              value={draft.tags}
                              onChange={(event) => updateDraft(photo.id, { tags: event.target.value })}
                              placeholder="wedding day, dance floor, table candids"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              {quickTagPresets.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const nextTags = Array.from(new Set([...normalizeTags(draft.tags), tag]))
                                    updateDraft(photo.id, { tags: nextTags.join(', ') })
                                  }}
                                  className="rounded-full border border-gold-200 bg-white px-3 py-1 text-xs text-charcoal-600 transition-colors hover:border-gold-300 hover:bg-gold-50"
                                >
                                  + {tag}
                                </button>
                              ))}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-charcoal-500">
                              Separate tags with commas. The selected story lane will automatically add the right chapter tag.
                            </p>
                          </div>

                          {videoCount > 0 && (
                            <div className="rounded-2xl border border-gold-100 bg-white/84 p-4">
                              <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Guest video lane</p>
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <Label htmlFor={`${fieldIdPrefix}-video-visibility`} className="mb-2 text-xs normal-case tracking-normal text-charcoal-500">
                                    Public treatment
                                  </Label>
                                  <select
                                    id={`${fieldIdPrefix}-video-visibility`}
                                    value={draft.videoVisibility}
                                    onChange={(event) => updateDraft(photo.id, { videoVisibility: event.target.value as GuestVideoVisibility })}
                                    className="h-11 w-full rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                                  >
                                    <option value="archive_only">Archive only</option>
                                    <option value="guest_highlights">Guest highlights</option>
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor={`${fieldIdPrefix}-video-trail`} className="mb-2 text-xs normal-case tracking-normal text-charcoal-500">
                                    Memory trail
                                  </Label>
                                  <select
                                    id={`${fieldIdPrefix}-video-trail`}
                                    value={draft.memoryTrail}
                                    onChange={(event) => updateDraft(photo.id, { memoryTrail: event.target.value as MemoryTrailId | '' })}
                                    className="h-11 w-full rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                                  >
                                    <option value="">No shared trail</option>
                                    {memoryTrails.map((trail) => (
                                      <option key={trail.id} value={trail.id}>
                                        {trail.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <p className="mt-4 text-xs leading-5 text-charcoal-500">
                                Keep this simple: either leave guest videos in the archive or include them in the shared
                                highlights lane.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="flex-1 min-w-[11rem]"
                          onClick={() => handleApprove(photo)}
                          disabled={busyId === photo.id}
                          isLoading={busyId === photo.id}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          {duplicateInsight.publishableCount === photoCount
                            ? 'Approve + Publish'
                            : `Approve ${duplicateInsight.publishableCount} Unique`}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="flex-1 min-w-[9rem]"
                          onClick={() => handleReject(photo.id)}
                          disabled={busyId === photo.id}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-[1.25rem] border border-gold-100 bg-[linear-gradient(145deg,rgba(250,245,236,0.82),rgba(255,252,248,0.96))] p-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">
                          Moderation status
                        </p>

                        <div className="mt-4 space-y-3 text-sm leading-6 text-charcoal-600">
                          {isApprovedPublished && (
                            <div className="rounded-2xl border border-green-200 bg-green-50/70 px-4 py-3 text-green-800">
                              {publishedPhotoCount > 0
                                ? `${publishedPhotoCount} approved guest photo${publishedPhotoCount === 1 ? '' : 's'} already made it into the live gallery.`
                                : 'This upload is approved and live in the guest archive.'}
                            </div>
                          )}
                          {isApprovedUnpublished && (
                            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 px-4 py-3 text-purple-800">
                              Approved, but not yet surfaced in a public lane. This is usually a video-only upload waiting for the guest highlights lane.
                            </div>
                          )}
                          {isRejected && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-rose-700">
                              Rejected items stay out of the public archive until they are moved back into pending review.
                            </div>
                          )}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-gold-100 bg-white/88 px-4 py-3">
                              <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-400">Created</p>
                              <p className="mt-2 text-charcoal-700">
                                {new Date(photo.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gold-100 bg-white/88 px-4 py-3">
                              <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-400">Editorial lane</p>
                              <p className="mt-2 text-charcoal-700">{draft.collection}</p>
                            </div>
                          </div>

                          {videoCount > 0 && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-gold-100 bg-white/88 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-400">Video visibility</p>
                                <p className="mt-2 text-charcoal-700">{getGuestVideoVisibilityLabel(draft.videoVisibility)}</p>
                              </div>
                              <div className="rounded-2xl border border-gold-100 bg-white/88 px-4 py-3">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-400">Memory trail</p>
                                <p className="mt-2 text-charcoal-700">{formatMemoryTrailLabel(draft.memoryTrail, 'No shared trail')}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isApprovedPublished && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="flex-1 min-w-[13rem]"
                            onClick={() => handleRemoveFromGallery(photo)}
                            disabled={busyId === photo.id}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove From Gallery
                          </Button>
                        )}
                        {videoCount > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 min-w-[13rem]"
                            onClick={() => handleSaveVideoPromotion(photo)}
                            disabled={busyId === photo.id}
                          >
                            <Video className="mr-1 h-4 w-4" />
                            Save Video Settings
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 min-w-[13rem]"
                          onClick={() => handleMoveToPending(photo.id)}
                          disabled={busyId === photo.id}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Move Back to Pending
                        </Button>
                      </div>
                    </>
                  )}

                  {shouldShowAuditHistory && (
                    <CompactAuditHistory
                      entries={auditEntries}
                      emptyLabel={!isPending ? 'No moderation history yet.' : undefined}
                    />
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
    </ComponentErrorBoundary>
  )
}
