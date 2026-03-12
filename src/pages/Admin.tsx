import { useState, useEffect, useCallback, useMemo } from 'react'
import { Navigate, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import {
  fetchModerationAuditTimeline,
  recordModerationAudit,
  supabase,
  type GuestUpload,
  type GuestbookMessage,
  type ModerationAuditAction,
  type ModerationAuditLog,
  type RecordModerationAuditInput,
} from '@/lib/supabase'
import { 
  LayoutDashboard, 
  Image, 
  MessageSquare, 
  Settings as SettingsIcon,
  LogOut,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  BarChart3,
  Video,
  History
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'

// Admin sub-pages
function Dashboard() {
  const [stats, setStats] = useState({
    totalPhotos: 0,
    pendingPhotos: 0,
    totalMessages: 0,
    approvedUploads: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: photoCount },
        { count: pendingCount },
        { count: messageCount },
        { count: approvedUploadCount },
      ] = await Promise.all([
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('guest_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('guestbook_messages').select('*', { count: 'exact', head: true }),
        supabase.from('guest_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      ])

      setStats({
        totalPhotos: photoCount || 0,
        pendingPhotos: pendingCount || 0,
        totalMessages: messageCount || 0,
        approvedUploads: approvedUploadCount || 0,
      })
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display text-charcoal-900">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Photos" 
          value={stats.totalPhotos} 
          icon={Image} 
          color="blue" 
        />
        <StatCard 
          title="Pending Approval" 
          value={stats.pendingPhotos} 
          icon={Eye} 
          color="amber"
          alert={stats.pendingPhotos > 0}
        />
        <StatCard 
          title="Guestbook Messages" 
          value={stats.totalMessages} 
          icon={MessageSquare} 
          color="green" 
        />
        <StatCard 
          title="Approved Uploads"
          value={stats.approvedUploads}
          icon={CheckCircle}
          color="purple" 
        />
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="font-medium text-blue-900">Dashboard cards now show only verified site activity.</p>
        <p className="mt-1 text-sm text-blue-700">
          Traffic and audience behavior are intentionally kept out of this screen. Use Google Analytics and Sentry for
          real visit data, and use admin for moderation and database-backed counts only.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gold-100">
        <h3 className="text-lg font-medium text-charcoal-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/admin/photos">Review Photos</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/admin/guestbook">Moderate Guestbook</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  alert = false 
}: { 
  title: string
  value: string | number
  icon: React.ElementType
  color: 'blue' | 'green' | 'amber' | 'purple'
  alert?: boolean
}) {
  const colors: Record<'blue' | 'green' | 'amber' | 'purple', string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border ${alert ? 'border-amber-400' : 'border-gold-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-charcoal-500">{title}</p>
          <p className="text-3xl font-display text-charcoal-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {alert && (
        <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          Requires attention
        </p>
      )}
    </div>
  )
}

type ModerationUpload = Omit<GuestUpload, 'message'> & { message?: string | null }

type ModerationCollection = 'Wedding Day' | 'Engagement' | 'Bach+ette' | 'Guest Uploads'

interface PromotionDraft {
  collection: ModerationCollection
  category: string
  caption: string
  tags: string
  location: string
}

const collectionOptions: Array<{
  value: ModerationCollection
  description: string
  defaultCategory: string
  defaultTags: string[]
}> = [
  {
    value: 'Wedding Day',
    description: 'For ceremony, portraits, reception, and the main day-of archive.',
    defaultCategory: 'Wedding Day',
    defaultTags: ['wedding day'],
  },
  {
    value: 'Engagement',
    description: 'For proposal, engagement portraits, and pre-wedding keepsakes.',
    defaultCategory: 'Engagement',
    defaultTags: ['engagement'],
  },
  {
    value: 'Bach+ette',
    description: 'For bachelor and bachelorette moments from the pre-wedding weekends.',
    defaultCategory: 'Bach+ette',
    defaultTags: ['bach', 'bachelorette'],
  },
  {
    value: 'Guest Uploads',
    description: 'Keeps the item in the general guest lane without forcing a story chapter.',
    defaultCategory: 'Guest Uploads',
    defaultTags: ['guest upload'],
  },
]

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
}

type ModerationQueueFilter = 'pending' | 'approved-unpublished' | 'approved-published' | 'rejected'

const quickTagPresets = ['ceremony', 'portraits', 'family', 'dance floor', 'toasts', 'candids', 'details'] as const

function normalizeTags(rawTags: string) {
  return Array.from(
    new Set(
      rawTags
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

function createPromotionDraft(upload: ModerationUpload): PromotionDraft {
  const lowerMessage = (upload.message || '').toLowerCase()
  const matchingCollection =
    collectionOptions.find(option =>
      option.defaultTags.some(tag => lowerMessage.includes(tag))
    )?.value || 'Wedding Day'

  const preset = collectionOptions.find(option => option.value === matchingCollection) || collectionOptions[0]

  return {
    collection: matchingCollection,
    category: preset.defaultCategory,
    caption: upload.message || '',
    tags: preset.defaultTags.join(', '),
    location: '',
  }
}

function getPublishedPhotoCount(upload: ModerationUpload, publishedPhotoUrls: Set<string>) {
  return (upload.photo_urls || []).filter((url) => publishedPhotoUrls.has(url)).length
}

function getModerationState(upload: ModerationUpload, publishedPhotoUrls: Set<string>): ModerationQueueFilter {
  if (upload.status === 'pending') return 'pending'
  if (upload.status === 'rejected') return 'rejected'
  return getPublishedPhotoCount(upload, publishedPhotoUrls) > 0 ? 'approved-published' : 'approved-unpublished'
}

type AuditActor = NonNullable<RecordModerationAuditInput['actor']>
type AuditEntriesByEntityId = Record<string, ModerationAuditLog[]>

const auditActionLabels: Record<ModerationAuditAction, string> = {
  upload_moved_to_pending: 'Moved to pending review',
  upload_approved_unpublished: 'Approved, not public',
  upload_approved_published: 'Approved + published',
  upload_rejected: 'Rejected',
  upload_bulk_rejected: 'Bulk rejected',
  guestbook_message_deleted: 'Deleted message',
  guestbook_bulk_deleted: 'Bulk deleted message',
}

function getAdminAuditActor(user: ReturnType<typeof useAuthStore.getState>['user']): AuditActor {
  const metadataName = user?.user_metadata?.name
  const fallbackName =
    typeof metadataName === 'string' && metadataName.trim().length > 0
      ? metadataName.trim()
      : user?.email?.split('@')[0] || 'Admin'

  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    name: fallbackName,
  }
}

function groupAuditEntries(entries: ModerationAuditLog[]) {
  return entries.reduce<AuditEntriesByEntityId>((acc, entry) => {
    if (!acc[entry.entity_id]) {
      acc[entry.entity_id] = []
    }

    acc[entry.entity_id].push(entry)
    return acc
  }, {})
}

function appendAuditEntry(previous: AuditEntriesByEntityId, entry: ModerationAuditLog) {
  return {
    ...previous,
    [entry.entity_id]: [entry, ...(previous[entry.entity_id] || [])],
  }
}

function formatAuditTimestamp(timestamp: string) {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleString()
}

function getAuditActorLabel(entry: ModerationAuditLog) {
  return entry.actor_name || entry.actor_email || 'Admin'
}

function AuditTrailList({
  entries,
  emptyLabel = 'No moderation history yet.',
}: {
  entries: ModerationAuditLog[]
  emptyLabel?: string
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-gold-100 bg-white/80 px-4 py-3 text-sm text-charcoal-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-2xl border border-gold-100 bg-white/88 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-charcoal-900">
                {auditActionLabels[entry.action] || entry.summary}
              </p>
              <p className="mt-1 text-xs text-charcoal-400">
                {getAuditActorLabel(entry)} · {formatAuditTimestamp(entry.created_at)}
              </p>
            </div>
            <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700">
              {entry.entity_type === 'guest_upload' ? 'Upload' : 'Guestbook'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-charcoal-600">{entry.summary}</p>
        </div>
      ))}
    </div>
  )
}

function CompactAuditHistory({
  entries,
  title = 'Recent history',
  emptyLabel,
}: {
  entries: ModerationAuditLog[]
  title?: string
  emptyLabel?: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0 && !emptyLabel) {
    return null
  }

  const latestEntry = entries[0]
  const remainingEntries = entries.slice(1, 4)

  return (
    <div className="rounded-[1.25rem] border border-gold-100 bg-white/88 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">{title}</p>
          {latestEntry ? (
            <p className="mt-2 text-sm font-medium text-charcoal-900">
              {auditActionLabels[latestEntry.action] || latestEntry.summary}
            </p>
          ) : (
            <p className="mt-2 text-sm text-charcoal-500">{emptyLabel}</p>
          )}
        </div>
        {remainingEntries.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700 transition-colors hover:bg-gold-100"
          >
            {expanded ? 'Hide history' : `Show ${entries.length} actions`}
          </button>
        )}
      </div>

      {latestEntry && (
        <div className="mt-3 rounded-2xl border border-gold-100 bg-cream-50/70 px-4 py-3">
          <p className="text-xs text-charcoal-400">
            {getAuditActorLabel(latestEntry)} · {formatAuditTimestamp(latestEntry.created_at)}
          </p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">{latestEntry.summary}</p>
        </div>
      )}

      {expanded && remainingEntries.length > 0 && (
        <div className="mt-3">
          <AuditTrailList entries={remainingEntries} />
        </div>
      )}
    </div>
  )
}

function PhotoModeration() {
  const [photos, setPhotos] = useState<ModerationUpload[]>([])
  const [drafts, setDrafts] = useState<Record<string, PromotionDraft>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueFilter, setQueueFilter] = useState<ModerationQueueFilter>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [publishedPhotoUrls, setPublishedPhotoUrls] = useState<Set<string>>(new Set())
  const [auditByUploadId, setAuditByUploadId] = useState<AuditEntriesByEntityId>({})
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const actor = getAdminAuditActor(user)

  const fetchPendingPhotos = useCallback(async () => {
    setLoading(true)
    const [{ data, error }, { data: publishedGuestPhotos, error: photosError }, { data: auditRows, error: auditError }] = await Promise.all([
      supabase
        .from('guest_uploads')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('photos')
        .select('url')
        .eq('is_professional', false),
      fetchModerationAuditTimeline({ entityType: 'guest_upload', limit: 500 }),
    ])

    if (error || photosError || auditError) {
      addToast('Failed to load photos', 'error')
    } else {
      const uploads = (data as ModerationUpload[] | null) || []
      setPhotos(uploads)
      setPublishedPhotoUrls(new Set((publishedGuestPhotos || []).map((photo) => photo.url)))
      setAuditByUploadId(groupAuditEntries(auditRows || []))
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
    const uploadPhotoUrls = upload.photo_urls || []
    const uploadVideoUrls = upload.video_urls || []
    const tags = Array.from(new Set([...guestTagByCollection[draft.collection], ...normalizeTags(draft.tags)]))
    const category = draft.category.trim() || collectionOptions.find(option => option.value === draft.collection)?.defaultCategory || 'Wedding Day'
    const caption = draft.caption.trim() || upload.message?.trim() || undefined
    const location = draft.location.trim() || undefined

    setBusyId(upload.id)

    const rowsToInsert = uploadPhotoUrls
      .filter(photoUrl => !publishedPhotoUrls.has(photoUrl))
      .map(photoUrl => ({
      url: photoUrl,
      thumbnail: photoUrl,
      caption,
      category,
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
      .update({ status: 'approved' })
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
    const nextModerationState = publishedPhotoCount > 0 ? 'approved-published' : 'approved-unpublished'
    const approvalSummary =
      publishedPhotoCount > 0
        ? `Approved and published ${publishedPhotoCount} guest photo${publishedPhotoCount === 1 ? '' : 's'} to ${draft.collection}.`
        : uploadVideoUrls.length > 0
          ? `Approved ${upload.guest_name}'s video submission for the guest highlight lane.`
          : `Approved upload from ${upload.guest_name}.`

    addToast(
      rowsToInsert.length > 0
        ? `Approved and published ${rowsToInsert.length} guest photo${rowsToInsert.length === 1 ? '' : 's'} to ${draft.collection}.`
        : uploadVideoUrls.length > 0
          ? 'Approved the video-only upload. It is now eligible for the guest video highlights lane.'
          : 'Approved the upload.',
      'success'
    )

    if (rowsToInsert.length > 0) {
      setPublishedPhotoUrls(prev => new Set([...prev, ...rowsToInsert.map(row => row.url)]))
    }

    setPhotos(prev =>
      prev.map(photo => (photo.id === upload.id ? { ...photo, status: 'approved' } : photo))
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
        collection: draft.collection,
        category,
        location: location || null,
        tags,
      },
    })

    if (auditError) {
      addToast('Approved upload, but the moderation history could not be recorded.', 'warning')
    } else if (auditEntry) {
      setAuditByUploadId(prev => appendAuditEntry(prev, auditEntry))
    }

    setBusyId(null)
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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filteredUploads.map((photo) => {
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
                        “{photo.message}”
                      </p>
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
                              htmlFor={`collection-${photo.id}`}
                              className="mb-2 text-xs normal-case tracking-normal text-charcoal-500"
                            >
                              Story lane
                            </Label>
                            <select
                              id={`collection-${photo.id}`}
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

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <Label
                                htmlFor={`category-${photo.id}`}
                                className="mb-2 text-xs normal-case tracking-normal text-charcoal-500"
                              >
                                Category
                              </Label>
                              <Input
                                id={`category-${photo.id}`}
                                value={draft.category}
                                onChange={(event) => updateDraft(photo.id, { category: event.target.value })}
                                placeholder="Wedding Day, Ceremony, Reception..."
                              />
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
                          Approve + Publish
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
                              Approved, but not yet surfaced in a public lane. This is usually a video-only upload waiting for the guest highlight feature lane.
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
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
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
  )
}

function GuestbookModeration() {
  const [messages, setMessages] = useState<GuestbookMessage[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'text' | 'voice' | 'video'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [auditByMessageId, setAuditByMessageId] = useState<AuditEntriesByEntityId>({})
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const actor = getAdminAuditActor(user)

  const fetchMessages = useCallback(async () => {
    const [{ data }, { data: auditRows, error: auditError }] = await Promise.all([
      supabase
        .from('guestbook_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      fetchModerationAuditTimeline({ entityType: 'guestbook_message', limit: 500 }),
    ])

    if (auditError) {
      addToast('Failed to load guestbook moderation history', 'error')
    }

    setMessages((data as GuestbookMessage[] | null) || [])
    setAuditByMessageId(groupAuditEntries(auditRows || []))
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMessages()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchMessages])

  async function handleDelete(id: string) {
    const message = messages.find((entry) => entry.id === id)
    if (!message) return

    const { error } = await supabase
      .from('guestbook_messages')
      .delete()
      .eq('id', id)

    if (error) {
      addToast('Failed to delete message', 'error')
    } else {
      addToast('Message deleted', 'success')
      setMessages(prev => prev.filter(m => m.id !== id))

      const { data: auditEntry, error: auditError } = await recordModerationAudit({
        entityType: 'guestbook_message',
        entityId: message.id,
        action: 'guestbook_message_deleted',
        actor,
        summary: `Deleted guestbook message from ${message.name}.`,
        metadata: {
          guest_name: message.name,
          guest_email: message.email,
          message_type: message.type,
          message_preview: message.content.slice(0, 120),
        },
      })

      if (auditError) {
        addToast('Deleted the message, but the moderation history could not be recorded.', 'warning')
      } else if (auditEntry) {
        setAuditByMessageId(prev => appendAuditEntry(prev, auditEntry))
      }
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    const selectedMessages = messages.filter((message) => selectedIds.includes(message.id))

    const { error } = await supabase
      .from('guestbook_messages')
      .delete()
      .in('id', selectedIds)

    if (error) {
      addToast('Failed to delete the selected messages', 'error')
      return
    }

    setMessages(prev => prev.filter(message => !selectedIds.includes(message.id)))
    addToast(`Deleted ${selectedIds.length} guestbook message${selectedIds.length === 1 ? '' : 's'}.`, 'success')

    const auditResults = await Promise.allSettled(
      selectedMessages.map((message) =>
        recordModerationAudit({
          entityType: 'guestbook_message',
          entityId: message.id,
          action: 'guestbook_bulk_deleted',
          actor,
          summary: `Bulk deleted guestbook message from ${message.name}.`,
          metadata: {
            guest_name: message.name,
            guest_email: message.email,
            message_type: message.type,
            message_preview: message.content.slice(0, 120),
            bulk_count: selectedMessages.length,
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
      setAuditByMessageId((prev) =>
        successfulAuditEntries.reduce((acc, entry) => appendAuditEntry(acc, entry), prev)
      )
    }

    if (successfulAuditEntries.length !== selectedMessages.length) {
      addToast('Deleted the selected messages, but part of the moderation history could not be recorded.', 'warning')
    }

    setSelectedIds([])
  }

  const filteredMessages = messages.filter((message) => {
    if (filter !== 'all' && message.type !== filter) return false

    const haystack = `${message.name} ${message.email} ${message.content}`.toLowerCase()
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Guestbook Moderation</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Keep the guestbook warm and readable. Search by guest, filter by message type, and bulk-clear anything that
          clearly does not belong.
        </p>
      </div>

      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['all', 'text', 'voice', 'video'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFilter(value)
                    setSelectedIds([])
                  }}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    filter === value
                      ? 'bg-gold-500 text-white'
                      : 'border border-gold-200 bg-white text-charcoal-600 hover:bg-gold-50'
                  }`}
                >
                  {value === 'all' ? 'All messages' : `${value[0].toUpperCase()}${value.slice(1)} only`}
                </button>
              ))}
            </div>
            <p className="text-sm text-charcoal-500">
              Voice and video notes stay visible here so you can spot anything that needs cleanup without losing the
              broader conversation context.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by guest name, email, or note"
              className="min-w-[18rem]"
            />
            {selectedIds.length > 0 && (
              <Button variant="danger" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete selected ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredMessages.map((message) => (
          <div key={message.id} className="bg-white rounded-xl p-6 border border-gold-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <label className="mt-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(message.id)}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(message.id)
                          ? prev.filter((id) => id !== message.id)
                          : [...prev, message.id]
                      )
                    }
                    className="h-4 w-4 rounded border-gold-300 text-gold-600 focus:ring-gold-500"
                  />
                  <span className="sr-only">Select message from {message.name}</span>
                </label>
                <div>
                <p className="font-medium text-charcoal-900">{message.name}</p>
                <p className="text-sm text-charcoal-500">{message.email}</p>
                <p className="text-sm text-charcoal-500">
                  {new Date(message.created_at).toLocaleString()}
                </p>
                  <span className="mt-3 inline-flex rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700">
                    {message.type}
                  </span>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="danger"
                onClick={() => handleDelete(message.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <p className="mt-4 text-charcoal-700">{message.content}</p>
            <div className="mt-4">
              <CompactAuditHistory
                entries={auditByMessageId[message.id] || []}
                title="Moderation history"
                emptyLabel="No moderation history yet."
              />
            </div>
          </div>
        ))}
        {filteredMessages.length === 0 && (
          <div className="rounded-xl border border-gold-100 bg-white px-6 py-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-gold-500" />
            <p className="mt-4 text-charcoal-700">No guestbook messages match this view right now.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AuditLogView() {
  const [entries, setEntries] = useState<ModerationAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState<'all' | 'guest_upload' | 'guestbook_message'>('all')
  const [actionFilter, setActionFilter] = useState<'all' | ModerationAuditAction>('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { addToast } = useToast()

  const fetchAuditEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchModerationAuditTimeline({ limit: 500 })

    if (error) {
      addToast('Failed to load moderation history', 'error')
      setEntries([])
    } else {
      setEntries(data || [])
    }

    setLoading(false)
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAuditEntries()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchAuditEntries])

  const actorOptions = useMemo(() => {
    return Array.from(
      new Set(entries.map((entry) => entry.actor_email).filter((value): value is string => Boolean(value)))
    )
  }, [entries])

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return entries.filter((entry) => {
      if (entityFilter !== 'all' && entry.entity_type !== entityFilter) return false
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false
      if (actorFilter !== 'all' && entry.actor_email !== actorFilter) return false

      if (!normalizedSearch) return true

      const metadataText = JSON.stringify(entry.metadata).toLowerCase()
      const haystack = `${entry.summary} ${entry.actor_name || ''} ${entry.actor_email || ''} ${metadataText}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [actionFilter, actorFilter, entityFilter, entries, searchQuery])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Moderation Audit Trail</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Every recorded moderation action lives here. Use it to confirm who approved, rejected, published, or removed
          content and when those decisions happened.
        </p>
      </div>

      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search guest name, email, summary, or metadata"
          />
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value as typeof entityFilter)}
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          >
            <option value="all">All entities</option>
            <option value="guest_upload">Uploads</option>
            <option value="guestbook_message">Guestbook</option>
          </select>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value as typeof actionFilter)}
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          >
            <option value="all">All actions</option>
            {Object.entries(auditActionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={(event) => setActorFilter(event.target.value)}
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          >
            <option value="all">All actors</option>
            {actorOptions.map((actorEmail) => (
              <option key={actorEmail} value={actorEmail}>
                {actorEmail}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gold-100 bg-white px-6 py-12 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-gold-500" />
          <p className="mt-4 text-charcoal-500">Loading moderation history...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-gold-100 bg-white px-6 py-12 text-center">
          <History className="mx-auto h-10 w-10 text-gold-500" />
          <p className="mt-4 text-charcoal-700">No moderation history matches these filters yet.</p>
        </div>
      ) : (
        <AuditTrailList entries={filteredEntries} />
      )}
    </div>
  )
}

// Analytics Dashboard Component
function Analytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [analytics, setAnalytics] = useState({
    approvedUploads: 0,
    pendingUploads: 0,
    guestbookEntries: 0,
    publishedPhotos: 0,
    guestPhotos: 0,
    professionalPhotos: 0,
  })
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const [
        { count: approvedUploads, error: approvedError },
        { count: pendingUploads, error: pendingError },
        { count: guestbookEntries, error: guestbookError },
        { count: publishedPhotos, error: publishedError },
        { count: guestPhotos, error: guestPhotosError },
        { count: professionalPhotos, error: professionalPhotosError },
      ] = await Promise.all([
        supabase
          .from('guest_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('guest_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('guestbook_messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('is_professional', false)
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('is_professional', true)
          .gte('created_at', startDate.toISOString()),
      ])

      const firstError =
        approvedError ||
        pendingError ||
        guestbookError ||
        publishedError ||
        guestPhotosError ||
        professionalPhotosError

      if (firstError) {
        throw firstError
      }

      setAnalytics({
        approvedUploads: approvedUploads || 0,
        pendingUploads: pendingUploads || 0,
        guestbookEntries: guestbookEntries || 0,
        publishedPhotos: publishedPhotos || 0,
        guestPhotos: guestPhotos || 0,
        professionalPhotos: professionalPhotos || 0,
      })
    } catch {
      addToast('Failed to load analytics', 'error')
    }
    setLoading(false)
  }, [addToast, timeRange])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAnalytics()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchAnalytics])

  const timeRangeLabels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days', 
    '90d': 'Last 90 Days'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display text-charcoal-900">Analytics Dashboard</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-gold-500 text-white'
                  : 'bg-white text-charcoal-600 hover:bg-gold-50 border border-gold-200'
              }`}
            >
              {timeRangeLabels[range]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto" />
          <p className="text-charcoal-500 mt-4">Loading analytics...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Approved Uploads"
              value={analytics.approvedUploads.toString()}
              icon={CheckCircle}
              color="blue"
            />
            <StatCard
              title="Pending Uploads"
              value={analytics.pendingUploads.toString()}
              icon={Eye}
              color="green"
              alert={analytics.pendingUploads > 0}
            />
            <StatCard
              title="Guestbook Entries"
              value={analytics.guestbookEntries.toString()}
              icon={MessageSquare}
              color="amber"
            />
            <StatCard
              title="Photos Published"
              value={analytics.publishedPhotos.toString()}
              icon={Image}
              color="purple"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gold-100">
              <p className="text-sm text-charcoal-500">Guest Photos Published</p>
              <p className="text-3xl font-display text-charcoal-900 mt-2">
                {analytics.guestPhotos}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                Approved guest submissions that made it into the live gallery
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gold-100">
              <p className="text-sm text-charcoal-500">Professional Photos Added</p>
              <p className="text-3xl font-display text-charcoal-900 mt-2">
                {analytics.professionalPhotos}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                Curated additions published during the selected window
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Database Activity Only</p>
              <p className="text-sm text-blue-700 mt-1">
                This admin screen now shows only verified database counts for the selected period. For traffic, page
                views, and audience behavior, use the live Google Analytics and Sentry dashboards outside the app.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Settings Component
function Settings() {
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://www.theporadas.com'
  const mediaBaseUrl = import.meta.env.VITE_MEDIA_BASE_URL || 'Not configured'

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Operations Notes</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          This screen is intentionally read-only. It reflects the live setup and the moderation defaults that are
          already active, instead of pretending to save settings the site does not actually persist here.
        </p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gold-500" />
          Live Site Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-charcoal-600">
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-charcoal-400">Canonical site</p>
            <p className="mt-2 font-medium text-charcoal-900">{siteUrl}</p>
            <p className="mt-2 text-charcoal-500">This is the public URL guests should share and revisit.</p>
          </div>
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-charcoal-400">Media host</p>
            <p className="mt-2 font-medium text-charcoal-900 break-all">{mediaBaseUrl}</p>
            <p className="mt-2 text-charcoal-500">Large video assets stream from the Cloudflare media host, not the frontend deploy.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-gold-500" />
          Moderation Defaults
        </h3>
        <div className="space-y-4">
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="font-medium text-charcoal-900">Guest uploads are live and require approval.</p>
            <p className="mt-2 text-sm text-charcoal-500">
              Uploads come in through the Share page, stay private during review, and now publish into the gallery only
              after curation in <span className="font-medium text-charcoal-700">/admin/photos</span>. Each moderation
              action is now recorded in the audit trail for future reference.
            </p>
          </div>
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="font-medium text-charcoal-900">Guestbook stays open and self-service.</p>
            <p className="mt-2 text-sm text-charcoal-500">
              Guests can post text, voice, and video messages directly. Admin moderation is available later in
              <span className="font-medium text-charcoal-700"> /admin/guestbook</span> if cleanup is ever needed, and
              deletions now leave a moderation history behind.
            </p>
          </div>
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="font-medium text-charcoal-900">Traffic analytics live outside the admin UI.</p>
            <p className="mt-2 text-sm text-charcoal-500">
              Google Analytics and Sentry remain the trustworthy sources for traffic, errors, and audience behavior.
              This admin area only shows database-backed counts and moderation workflow.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gold-500" />
          Export and Backup Guidance
        </h3>
        <div className="space-y-3 text-sm leading-6 text-charcoal-500">
          <p>
            There is no in-app export button anymore because it was placeholder behavior. Use Supabase dashboard exports,
            SQL backups, or your storage providers directly when you need a real backup.
          </p>
          <p>
            The safest operating rhythm is simple: approve uploads, tag them into the right gallery lane, and let the
            public site reflect only content that has already been reviewed.
          </p>
        </div>
      </div>
    </div>
  )
}

// Main Admin Layout
function AdminLayout() {
  const location = useLocation()
  const { signOut, user } = useAuthStore()
  const { addToast } = useToast()

  const handleSignOut = async () => {
    await signOut()
    addToast('Signed out successfully', 'success')
  }

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/photos', label: 'Photos', icon: Image },
    { path: '/admin/guestbook', label: 'Guestbook', icon: MessageSquare },
    { path: '/admin/audit', label: 'Audit Trail', icon: History },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-gold-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display text-xl text-charcoal-900">
              <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
              <span className="text-sm font-normal text-charcoal-500 ml-2">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-charcoal-500">{user?.email}</span>
            <Button size="sm" variant="secondary" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <nav className="w-64 flex-shrink-0" aria-label="Admin navigation">
          <div className="bg-white rounded-xl border border-gold-100 overflow-hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-gold-50 text-gold-700 border-r-2 border-gold-500' 
                      : 'text-charcoal-600 hover:bg-gray-50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="photos" element={<PhotoModeration />} />
            <Route path="guestbook" element={<GuestbookModeration />} />
            <Route path="audit" element={<AuditLogView />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

// Main Admin Component with Auth Check
export default function Admin() {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500" />
      </div>
    )
  }

  // Redirect if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/admin/login" replace state={{ from: redirectTo }} />
  }

  return <AdminLayout />
}
