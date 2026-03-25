import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Navigate, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import {
  deletePhotoComment,
  deleteGalleryPhotos,
  fetchRecentPhotoComments,
  fetchGuestFaceTaggingBatches,
  fetchNextAlbumSortOrder,
  fetchMediaReviewBatches,
  fetchModerationAuditTimeline,
  hidePhotoComment,
  recordModerationAudit,
  supabase,
  type AdminPhotoCommentRecord,
  type GuestFaceTaggingBatch,
  type GuestUpload,
  type GuestbookMessage,
  type ModerationAuditAction,
  type ModerationAuditLog,
  type RecordModerationAuditInput,
} from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
import { 
  LayoutDashboard, 
  Image, 
  MessageSquare, 
  Settings as SettingsIcon,
  Copy,
  Download,
  LogOut,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  BarChart3,
  Video,
  History,
  RefreshCw,
  UploadCloud,
  Users,
  ArrowRight,
  ShieldCheck,
  FolderOpen,
  EyeOff,
} from 'lucide-react'
import { MediaReviewPanel } from '@/components/admin/MediaReviewPanel'
import { AlbumOrganizer } from '@/components/admin/AlbumOrganizer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { getMemoryTrailById, memoryTrails, type MemoryTrailId } from '@/data/memoryTrails'
import { cn } from '@/lib/utils'
import {
  buildGuestTaggingSyncPayloadFromFiles,
  downloadGuestTaggingBatchZip,
  type GuestTaggingManifest,
} from '@/utils/guestTagging'

type AdminNavItem = {
  path: string
  label: string
  icon: React.ElementType
  description: string
}

type AdminNavSection = {
  title: string
  description: string
  items: AdminNavItem[]
}

const adminNavSections: AdminNavSection[] = [
  {
    title: 'Run the day-to-day',
    description: 'The pages you will open most often when new content arrives.',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, description: 'See what needs attention next.' },
      { path: '/admin/photos', label: 'Photos', icon: Image, description: 'Moderate uploads, publish photos, and run guest tagging.' },
      { path: '/admin/albums', label: 'Albums', icon: FolderOpen, description: 'Arrange the live order inside each public album.' },
      { path: '/admin/review', label: 'People Review', icon: Users, description: 'Work through face review and named people.' },
      { path: '/admin/guestbook', label: 'Guestbook', icon: MessageSquare, description: 'Moderate notes, voice, and video messages.' },
    ],
  },
  {
    title: 'Shape the public site',
    description: 'History, reporting, and operating notes.',
    items: [
      { path: '/admin/audit', label: 'Audit Trail', icon: History, description: 'See who changed moderation state and when.' },
      { path: '/admin/analytics', label: 'Analytics', icon: BarChart3, description: 'Track verified database activity inside the app.' },
      { path: '/admin/settings', label: 'Settings', icon: SettingsIcon, description: 'Reference the live setup and operating notes.' },
    ],
  },
]

const adminRouteMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  '/admin': {
    eyebrow: 'Control room',
    title: 'Keep the whole wedding archive moving smoothly.',
    description:
      'Start here to see what needs attention now, then jump straight into the next task for photos, people, or the guestbook.',
  },
  '/admin/photos': {
    eyebrow: 'Photos workflow',
    title: 'Moderate uploads, publish moments, and keep guest tagging moving.',
    description:
      'This is the operational heart of the site: review incoming uploads, decide what goes live, and run the browser-first digiKam loop when guest face tags are worth adding.',
  },
  '/admin/review': {
    eyebrow: 'People workflow',
    title: 'Turn face detections into a browsable people archive.',
    description:
      'Use photo-first review for accuracy, then clean up recurring people in bulk so the public gallery stays useful instead of noisy.',
  },
  '/admin/albums': {
    eyebrow: 'Album workflow',
    title: 'Arrange the live album order exactly how you want it.',
    description:
      'This is the place for sequencing, not moderation: drag photos into order, fix misfiled images, and save the public arrangement album by album.',
  },
  '/admin/guestbook': {
    eyebrow: 'Guestbook workflow',
    title: 'Keep the softer side of the archive tidy and welcoming.',
    description:
      'Review notes and media only when needed, without losing the warmth of the messages that make the site feel lived in.',
  },
  '/admin/audit': {
    eyebrow: 'History',
    title: 'See the moderation paper trail.',
    description:
      'Use this whenever you want to confirm what changed, who changed it, and whether a workflow is behaving the way you expect.',
  },
  '/admin/analytics': {
    eyebrow: 'Verified activity',
    title: 'Read the database-backed pulse of the site.',
    description:
      'This screen is intentionally narrow: it reflects confirmed app activity, while Google Analytics and Sentry remain the source of truth for audience traffic and errors.',
  },
  '/admin/settings': {
    eyebrow: 'Operations notes',
    title: 'Reference the live setup without pretending these are editable settings.',
    description:
      'Use this page as the working notes for how the site is configured, what is intentionally live, and where the real controls live outside this UI.',
  },
}

function getAdminRouteMeta(pathname: string) {
  if (pathname === '/admin') return adminRouteMeta['/admin']

  const match = Object.entries(adminRouteMeta)
    .filter(([path]) => path !== '/admin' && pathname.startsWith(path))
    .sort((left, right) => right[0].length - left[0].length)[0]

  return match ? match[1] : adminRouteMeta['/admin']
}

// Admin sub-pages
function Dashboard() {
  const [stats, setStats] = useState({
    totalPhotos: 0,
    pendingPhotos: 0,
    totalMessages: 0,
    approvedUploads: 0,
    peopleBatchesInFlight: 0,
    lastGuestTaggingSyncLabel: 'No guest sync yet',
  })

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: photoCount },
        { count: pendingCount },
        { count: messageCount },
        { count: approvedUploadCount },
        { data: mediaReviewBatches },
        { data: guestTaggingBatches },
      ] = await Promise.all([
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('guest_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('guestbook_messages').select('*', { count: 'exact', head: true }),
        supabase.from('guest_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        fetchMediaReviewBatches(),
        fetchGuestFaceTaggingBatches(),
      ])

      const latestGuestTaggingBatch = guestTaggingBatches?.[0] || null
      const peopleBatchesInFlight =
        (mediaReviewBatches || []).filter((batch) => batch.status === 'pending' || batch.status === 'in_review').length

      setStats({
        totalPhotos: photoCount || 0,
        pendingPhotos: pendingCount || 0,
        totalMessages: messageCount || 0,
        approvedUploads: approvedUploadCount || 0,
        peopleBatchesInFlight,
        lastGuestTaggingSyncLabel: latestGuestTaggingBatch?.last_synced_at
          ? new Date(latestGuestTaggingBatch.last_synced_at).toLocaleString()
          : 'No guest sync yet',
      })
    }

    void fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-gold-100 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Austin + Jordyn control room</p>
            <h2 className="mt-2 font-display text-2xl leading-tight text-charcoal-900 sm:text-[2rem]">
              A faster weekly view of what needs attention.
            </h2>
            <p className="mt-2 text-sm leading-6 text-charcoal-600">
              Use this like a briefing, not a landing page: check the current state, then jump straight into the next
              workflow.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[24rem]">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/photos">Photos</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/albums">Albums</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/review">People Review</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/guestbook">Guestbook</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/audit">Audit</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminSignalRow
          label="Pending uploads"
          value={stats.pendingPhotos.toString()}
          tone={stats.pendingPhotos > 0 ? 'alert' : 'calm'}
          detail={stats.pendingPhotos > 0 ? 'Waiting in /admin/photos.' : 'Queue is clear.'}
        />
        <AdminSignalRow
          label="People review"
          value={stats.peopleBatchesInFlight.toString()}
          tone={stats.peopleBatchesInFlight > 0 ? 'alert' : 'calm'}
          detail={stats.peopleBatchesInFlight > 0 ? 'Batch still in flight.' : 'No active batch.'}
        />
        <AdminSignalRow
          label="Guest tagging sync"
          value={stats.lastGuestTaggingSyncLabel}
          tone="neutral"
          detail="Last metadata sync back into Gallery."
        />
        <AdminSignalRow
          label="Approved uploads"
          value={stats.approvedUploads.toString()}
          tone="neutral"
          detail="Ready to browse or face-tag later."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Live gallery photos"
          value={stats.totalPhotos}
          icon={Image}
          color="blue"
        />
        <StatCard
          title="Pending review"
          value={stats.pendingPhotos}
          icon={Eye}
          color="amber"
          alert={stats.pendingPhotos > 0}
        />
        <StatCard
          title="Guestbook entries"
          value={stats.totalMessages}
          icon={MessageSquare}
          color="green"
        />
        <StatCard
          title="Approved uploads"
          value={stats.approvedUploads}
          icon={CheckCircle}
          color="purple"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="rounded-[1.5rem] border border-gold-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Recommended rhythm</p>
              <h3 className="mt-1 text-xl font-display text-charcoal-900">Three steps, in order</h3>
            </div>
            <ShieldCheck className="h-5 w-5 text-gold-500" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <WorkflowStep
              step="1"
              title="Photos"
              description="Clear /admin/photos first."
            />
            <WorkflowStep
              step="2"
              title="People"
              description="Tighten names in /admin/review."
            />
            <WorkflowStep
              step="3"
              title="Guestbook"
              description="Clean up messages only when needed."
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-gold-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Scope</p>
              <h3 className="mt-1 text-xl font-display text-charcoal-900">What belongs here</h3>
            </div>
            <FolderOpen className="h-5 w-5 text-gold-500" />
          </div>
          <p className="mt-4 text-sm leading-6 text-charcoal-600">
            Admin is for moderation, people review, and verified site data. Traffic and error
            dashboards still live in Google Analytics and Sentry.
          </p>
          <div className="mt-4">
            <Button variant="secondary" asChild>
              <Link to="/admin/settings">
                Operating notes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminSignalRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'alert' | 'calm' | 'neutral'
}) {
  const toneClasses =
    tone === 'alert'
      ? 'border-amber-300 bg-amber-50'
      : tone === 'calm'
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-gold-100 bg-cream-50/70'

  return (
    <div className={`rounded-[1.25rem] border px-4 py-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">{label}</p>
          <p className="mt-2 text-lg font-medium text-charcoal-900 break-words">{value}</p>
        </div>
      </div>
      <p className="mt-1 text-sm leading-6 text-charcoal-600">{detail}</p>
    </div>
  )
}

function WorkflowStep({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-[1.1rem] border border-gold-100 bg-cream-50/70 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-semibold text-white">
          {step}
        </div>
        <div>
          <p className="text-sm font-medium text-charcoal-900">{title}</p>
          <p className="mt-1 text-sm leading-5 text-charcoal-500">{description}</p>
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
    <div className={`bg-white rounded-[1.2rem] p-4 shadow-sm border ${alert ? 'border-amber-400' : 'border-gold-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-charcoal-500">{title}</p>
          <p className="mt-1 text-[2rem] font-display leading-none text-charcoal-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
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
type GuestVideoVisibility = 'archive_only' | 'guest_highlights'

interface PromotionDraft {
  collection: ModerationCollection
  category: string
  caption: string
  tags: string
  location: string
  videoVisibility: GuestVideoVisibility
  memoryTrail: MemoryTrailId | ''
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

const DEFAULT_GUEST_TAGGING_ROOT = 'C:/Users/bbask/Pictures/Guest Upload Tagging'

function buildGuestTaggingCommands(workingRoot: string) {
  const cleanRoot = workingRoot.trim() || DEFAULT_GUEST_TAGGING_ROOT

  return {
    export: `npm run media:guest:tag:export -- "${cleanRoot}"`,
    import: `npm run media:batch:faces:digikam -- "${cleanRoot}"`,
    sync: `npm run media:guest:tag:sync -- "${cleanRoot}"`,
  }
}

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
    videoVisibility:
      upload.video_visibility === 'guest_highlights'
        ? 'guest_highlights'
        : upload.video_urls?.length
          ? 'guest_highlights'
          : 'archive_only',
    memoryTrail: (upload.memory_trail as MemoryTrailId | null) || '',
  }
}

function getGuestVideoVisibilityLabel(value: GuestVideoVisibility) {
  switch (value) {
    case 'guest_highlights':
      return 'Guest highlights'
    default:
      return 'Archive only'
  }
}

function buildGuestVideoPromotionPatch(draft: PromotionDraft) {
  return {
    video_visibility: draft.videoVisibility,
    memory_trail: draft.memoryTrail || null,
    editorial_title: null,
    editorial_summary: null,
    featured_rank: null,
  }
}

function getPublishedPhotoCount(upload: ModerationUpload, publishedPhotoUrls: Set<string>) {
  return (upload.photo_urls || []).filter((url) => publishedPhotoUrls.has(url)).length
}

interface GuestUploadMediaEntry {
  url: string
  fingerprint: string | null
}

interface GuestUploadDuplicateInsight {
  publishableEntries: GuestUploadMediaEntry[]
  publishableCount: number
  withinUploadCount: number
  approvedDuplicateCount: number
  pendingOverlapCount: number
}

function buildGuestUploadMediaEntries(upload: ModerationUpload) {
  const photoUrls = upload.photo_urls || []
  const photoFingerprints = upload.photo_fingerprints || []

  return photoUrls.map((url, index) => ({
    url,
    fingerprint: photoFingerprints[index] || null,
  }))
}

function buildApprovedFingerprintSet(uploads: ModerationUpload[], excludedUploadId?: string) {
  const fingerprints = new Set<string>()

  for (const upload of uploads) {
    if (upload.id === excludedUploadId || upload.status !== 'approved') continue

    for (const fingerprint of upload.photo_fingerprints || []) {
      if (fingerprint) {
        fingerprints.add(fingerprint)
      }
    }
  }

  return fingerprints
}

function buildPendingFingerprintSet(uploads: ModerationUpload[], excludedUploadId?: string) {
  const fingerprints = new Set<string>()

  for (const upload of uploads) {
    if (upload.id === excludedUploadId || upload.status !== 'pending') continue

    for (const fingerprint of upload.photo_fingerprints || []) {
      if (fingerprint) {
        fingerprints.add(fingerprint)
      }
    }
  }

  return fingerprints
}

function getGuestUploadDuplicateInsight(
  upload: ModerationUpload,
  uploads: ModerationUpload[],
  publishedPhotoUrls: Set<string>,
): GuestUploadDuplicateInsight {
  const approvedFingerprints = buildApprovedFingerprintSet(uploads, upload.id)
  const pendingFingerprints = buildPendingFingerprintSet(uploads, upload.id)
  const seenKeys = new Set<string>()
  const publishableEntries: GuestUploadMediaEntry[] = []

  let withinUploadCount = 0
  let approvedDuplicateCount = 0
  let pendingOverlapCount = 0

  for (const entry of buildGuestUploadMediaEntries(upload)) {
    const entryKey = entry.fingerprint || `url:${entry.url}`

    if (seenKeys.has(entryKey)) {
      withinUploadCount += 1
      continue
    }

    seenKeys.add(entryKey)

    const alreadyApproved =
      publishedPhotoUrls.has(entry.url) ||
      (entry.fingerprint ? approvedFingerprints.has(entry.fingerprint) : false)

    if (alreadyApproved) {
      approvedDuplicateCount += 1
      continue
    }

    if (entry.fingerprint && pendingFingerprints.has(entry.fingerprint)) {
      pendingOverlapCount += 1
    }

    publishableEntries.push(entry)
  }

  return {
    publishableEntries,
    publishableCount: publishableEntries.length,
    withinUploadCount,
    approvedDuplicateCount,
    pendingOverlapCount,
  }
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
  upload_removed_from_gallery: 'Removed from gallery',
  upload_rejected: 'Rejected',
  upload_bulk_rejected: 'Bulk rejected',
  guestbook_message_deleted: 'Deleted message',
  guestbook_bulk_deleted: 'Bulk deleted message',
}

function formatMemoryTrailLabel(trail: MemoryTrailId | '' | null | undefined, fallback?: string | null) {
  if (trail) {
    return getMemoryTrailById(trail)?.label || fallback || trail
  }

  return fallback || 'Editorial lane'
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
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
                        “{photo.message}”
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
            aria-label="Filter audit trail by entity type"
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          >
            <option value="all">All entities</option>
            <option value="guest_upload">Uploads</option>
            <option value="guestbook_message">Guestbook</option>
          </select>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value as typeof actionFilter)}
            aria-label="Filter audit trail by action"
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
            aria-label="Filter audit trail by actor"
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

/* Legacy spotlight editor retired.
function FeaturedContentManager() {
  const [featuresBySlot, setFeaturesBySlot] = useState<Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: null }),
      {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>
    )
  )
  const [drafts, setDrafts] = useState<Record<SiteEditorialFeatureSlot, EditorialDraft>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: createEditorialDraft(definition.slot) }),
      {} as Record<SiteEditorialFeatureSlot, EditorialDraft>
    )
  )
  const [historyBySlot, setHistoryBySlot] = useState<Record<SiteEditorialFeatureSlot, SiteEditorialFeatureHistoryEntry[]>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: [] }),
      {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeatureHistoryEntry[]>
    )
  )
  const [candidateSearchBySlot, setCandidateSearchBySlot] = useState<Record<SiteEditorialFeatureSlot, string>>(() =>
    editorialSlotDefinitions.reduce(
      (acc, definition) => ({ ...acc, [definition.slot]: '' }),
      {} as Record<SiteEditorialFeatureSlot, string>
    )
  )
  const [recentUploads, setRecentUploads] = useState<ModerationUpload[]>([])
  const [recentMessages, setRecentMessages] = useState<GuestbookMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSlot, setSavingSlot] = useState<SiteEditorialFeatureSlot | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SiteEditorialFeatureSlot>('home_newest_standout_upload')
  const { addToast } = useToast()
  const { user } = useAuthStore()
  const actor = getAdminAuditActor(user)

  const loadEditorialState = useCallback(async () => {
    setLoading(true)
    const [featuresResult, uploadsResult, messagesResult, historyResult] = await Promise.all([
      fetchSiteEditorialFeatures(),
      supabase.from('guest_uploads').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('guestbook_messages').select('*').order('created_at', { ascending: false }).limit(20),
      fetchSiteEditorialFeatureHistory(),
    ])

    const featuresError = featuresResult.error
    const uploadsError = uploadsResult.error
    const messagesError = messagesResult.error
    const historyError = historyResult.error

    if (featuresError || uploadsError || messagesError || historyError) {
      addToast('Failed to load featured content settings', 'error')
      setLoading(false)
      return
    }

    const features = (featuresResult.data || []) as SiteEditorialFeature[]
    const bySlot = editorialSlotDefinitions.reduce((acc, definition) => {
      acc[definition.slot] = features.find((feature) => feature.slot === definition.slot) || null
      return acc
    }, {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeature | null>)

    setFeaturesBySlot(bySlot)
    setDrafts(
      editorialSlotDefinitions.reduce((acc, definition) => {
        acc[definition.slot] = createEditorialDraft(definition.slot, bySlot[definition.slot])
        return acc
      }, {} as Record<SiteEditorialFeatureSlot, EditorialDraft>)
    )
    setHistoryBySlot(
      editorialSlotDefinitions.reduce((acc, definition) => {
        acc[definition.slot] = ((historyResult.data as SiteEditorialFeatureHistoryEntry[] | null) || [])
          .filter((entry) => entry.slot === definition.slot)
        return acc
      }, {} as Record<SiteEditorialFeatureSlot, SiteEditorialFeatureHistoryEntry[]>)
    )
    setRecentUploads(((uploadsResult.data as ModerationUpload[] | null) || []))
    setRecentMessages(((messagesResult.data as GuestbookMessage[] | null) || []))
    setLoading(false)
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEditorialState()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadEditorialState])

  function updateDraft(slot: SiteEditorialFeatureSlot, patch: Partial<EditorialDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [slot]: {
        ...previous[slot],
        ...patch,
      },
    }))
  }

  function updateCandidateSearch(slot: SiteEditorialFeatureSlot, value: string) {
    setCandidateSearchBySlot((previous) => ({
      ...previous,
      [slot]: value,
    }))
  }

  function applyQuickAction(slot: SiteEditorialFeatureSlot) {
    if (slot === 'home_newest_standout_upload' || slot === 'film_featured_guest_video') {
      const candidate = recentUploads.find((upload) =>
        slot === 'film_featured_guest_video'
          ? upload.status === 'approved' && (upload.video_urls?.length || 0) > 0
          : upload.status === 'approved'
      )

      if (!candidate) {
        addToast('No recent upload matches that quick action yet.', 'warning')
        return
      }

      updateDraft(slot, {
        sourceType: 'guest_upload',
        sourceId: candidate.id,
        sourceLabel: candidate.guest_name,
        sourceUrl: slot === 'film_featured_guest_video' ? '/film' : '/gallery?collection=Guest%20Uploads',
        title: candidate.message?.trim() || (slot === 'film_featured_guest_video' ? `Featured clip from ${candidate.guest_name}` : `Newest standout upload from ${candidate.guest_name}`),
        summary:
          candidate.message?.trim() ||
          (slot === 'film_featured_guest_video'
            ? 'A guest-shot angle from the room, ready to lead the highlight lane.'
            : 'A guest contribution worth surfacing as one of the first things returning visitors see.'),
        badgeLabel: slot === 'film_featured_guest_video' ? 'Featured guest clip' : 'Guest upload',
        memoryTrail:
          slot === 'film_featured_guest_video'
            ? ((candidate.memory_trail as MemoryTrailId | null) || 'dance-floor')
            : ((candidate.memory_trail as MemoryTrailId | null) || 'dance-floor'),
      })
      return
    }

    if (slot === 'home_featured_guestbook_note') {
      const candidate = recentMessages[0]
      if (!candidate) {
        addToast('No guestbook note is available for that quick action yet.', 'warning')
        return
      }

      updateDraft(slot, {
        sourceType: 'guestbook_message',
        sourceId: candidate.id,
        sourceLabel: candidate.name,
        sourceUrl: `/guestbook?message=${candidate.id}`,
        title: `A note from ${candidate.name}`,
        summary: candidate.content.slice(0, 180),
        badgeLabel: 'Featured note',
        memoryTrail: 'family',
      })
      return
    }

    updateDraft(slot, {
      sourceType: 'film_chapter',
      sourceId: 'the-ceremony',
      sourceLabel: 'The Ceremony',
      sourceUrl: '/film?moment=the-ceremony',
      title: 'The ceremony, back at the center of the week',
      summary: 'A one-click way back into the vows, the room holding its breath, and the part of the day that still feels most surreal.',
      badgeLabel: 'Film moment',
      memoryTrail: 'ceremony',
    })
  }

  async function handleSave(slot: SiteEditorialFeatureSlot) {
    const draft = drafts[slot]
    if (!draft.title.trim()) {
      addToast('Featured content needs a title before it can be saved.', 'error')
      return
    }

    setSavingSlot(slot)
    const previousFeature = featuresBySlot[slot]
    const result = await upsertSiteEditorialFeature({
      slot,
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      trail: draft.trail.trim() || null,
      memoryTrail: draft.memoryTrail || null,
      badgeLabel: draft.badgeLabel.trim() || null,
      ctaLabel: draft.ctaLabel.trim() || null,
      sourceType: draft.sourceType,
      sourceId: draft.sourceId.trim() || null,
      sourceLabel: draft.sourceLabel.trim() || null,
      sourceUrl: draft.sourceUrl.trim() || null,
      startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      isActive: draft.isActive,
      displayOrder: editorialSlotDefinitions.findIndex((definition) => definition.slot === slot),
      actor: {
        userId: user?.id ?? null,
        email: user?.email ?? null,
      },
      metadata: {
        slot,
      },
    })

    if (result.error || !result.data) {
      addToast('Could not save the featured content slot.', 'error')
      setSavingSlot(null)
      return
    }

    setFeaturesBySlot((previous) => ({
      ...previous,
      [slot]: result.data as SiteEditorialFeature,
    }))
    setDrafts((previous) => ({
      ...previous,
      [slot]: createEditorialDraft(slot, result.data as SiteEditorialFeature),
    }))
    const { data: historyEntry, error: historyError } = await recordSiteEditorialFeatureHistory({
      slot,
      featureId: (result.data as SiteEditorialFeature).id,
      changeSummary: `Updated ${editorialSlotDefinitions.find((definition) => definition.slot === slot)?.label || slot}.`,
      actor,
      previousFeature: serializeEditorialFeatureForHistory(previousFeature),
      nextFeature: serializeEditorialFeatureForHistory(result.data as SiteEditorialFeature),
    })

    if (historyError) {
      addToast('Featured slot saved, but the editorial history entry could not be recorded.', 'warning')
    } else if (historyEntry) {
      setHistoryBySlot((previous) => ({
        ...previous,
        [slot]: [historyEntry, ...(previous[slot] || [])],
      }))
    }
    addToast('Featured content slot saved.', 'success')
    setSavingSlot(null)
  }

  const selectedDefinition =
    editorialSlotDefinitions.find((definition) => definition.slot === selectedSlot) || editorialSlotDefinitions[0]
  const selectedDraft = drafts[selectedSlot] || createEditorialDraft(selectedSlot)
  const selectedFeature = featuresBySlot[selectedSlot]
  const selectedHistory = historyBySlot[selectedSlot] || []
  const selectedCandidateSearch = candidateSearchBySlot[selectedSlot] || ''
  const selectedIsSaving = savingSlot === selectedSlot

  const activeSlotCount = Object.values(featuresBySlot).filter((feature) => feature?.is_active).length
  const approvedUploadsCount = recentUploads.filter((upload) => upload.status === 'approved').length
  const guestbookCount = recentMessages.length
  const normalizedCandidateSearch = selectedCandidateSearch.trim().toLowerCase()
  const filteredUploadCandidates = recentUploads
    .filter((upload) => upload.status === 'approved')
    .filter((upload) =>
      selectedSlot === 'film_featured_guest_video' ? (upload.video_urls?.length || 0) > 0 : true
    )
    .filter((upload) => {
      if (!normalizedCandidateSearch) return true
      const haystack = `${upload.guest_name} ${upload.guest_email} ${upload.message || ''}`.toLowerCase()
      return haystack.includes(normalizedCandidateSearch)
    })
    .slice(0, 6)
  const filteredGuestbookCandidates = recentMessages
    .filter((message) => {
      if (!normalizedCandidateSearch) return true
      const haystack = `${message.name} ${message.email} ${message.content}`.toLowerCase()
      return haystack.includes(normalizedCandidateSearch)
    })
    .slice(0, 6)
  const activeSourceCount =
    selectedDraft.sourceType === 'guest_upload'
      ? filteredUploadCandidates.length
      : selectedDraft.sourceType === 'guestbook_message'
        ? filteredGuestbookCandidates.length
        : selectedDraft.sourceType === 'film_chapter'
          ? filmChapterFeatureOptions.length
          : 1

  function applyGuestUploadSelection(upload: ModerationUpload) {
    updateDraft(selectedSlot, {
      sourceType: 'guest_upload',
      sourceId: upload.id,
      sourceLabel: upload.guest_name,
      sourceUrl: selectedSlot === 'film_featured_guest_video' ? '/film' : '/gallery?collection=Guest%20Uploads',
      title:
        upload.editorial_title?.trim() ||
        upload.message?.trim() ||
        (selectedSlot === 'film_featured_guest_video'
          ? `Featured clip from ${upload.guest_name}`
          : `Standout upload from ${upload.guest_name}`),
      summary:
        upload.editorial_summary?.trim() ||
        upload.message?.trim() ||
        (selectedSlot === 'film_featured_guest_video'
          ? 'A guest-shot angle worth highlighting right under the main film.'
          : 'A guest contribution worth putting near the top of the story right now.'),
      badgeLabel:
        selectedSlot === 'film_featured_guest_video'
          ? 'Featured guest clip'
          : 'Guest upload',
      memoryTrail: (upload.memory_trail as MemoryTrailId | null) || selectedDefinition.defaultMemoryTrail || '',
    })
  }

  function applyGuestbookSelection(message: GuestbookMessage) {
    updateDraft(selectedSlot, {
      sourceType: 'guestbook_message',
      sourceId: message.id,
      sourceLabel: message.name,
      sourceUrl: `/guestbook?message=${message.id}`,
      title: `A note from ${message.name}`,
      summary: message.content.slice(0, 180),
      badgeLabel: 'Featured note',
      memoryTrail: 'family',
    })
  }

  function applyFilmChapterSelection(option: (typeof filmChapterFeatureOptions)[number]) {
    updateDraft(selectedSlot, {
      sourceType: 'film_chapter',
      sourceId: option.value,
      sourceLabel: option.label.replace('Film chapter: ', ''),
      sourceUrl: `/film?moment=${option.value}`,
      title: option.label.replace('Film chapter: ', ''),
      summary: 'A direct path back into one chapter of the film without asking guests to restart the full feature.',
      badgeLabel: 'Film moment',
      memoryTrail: selectedDefinition.defaultMemoryTrail || '',
    })
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gold-100 bg-white px-6 py-12 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-gold-500" />
        <p className="mt-4 text-charcoal-500">Loading featured content slots...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Featured Content</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Use this like a small editorial desk, not a CMS. Choose one public slot, decide what should feel alive on
          the site right now, and save that single spotlight before moving to the next one.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.4rem] border border-gold-100 bg-white px-5 py-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Live now</p>
          <p className="mt-3 text-3xl font-display text-charcoal-900">{activeSlotCount}</p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">
            Editorial slots are currently active across Home and Film.
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-gold-100 bg-white px-5 py-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Ready sources</p>
          <p className="mt-3 text-3xl font-display text-charcoal-900">{approvedUploadsCount}</p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">
            Approved uploads are ready to become a standout card or featured clip.
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-gold-100 bg-white px-5 py-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Keepsake notes</p>
          <p className="mt-3 text-3xl font-display text-charcoal-900">{guestbookCount}</p>
          <p className="mt-2 text-sm leading-6 text-charcoal-600">
            Recent guestbook messages are available if you want a softer homepage moment.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-[1.6rem] border border-gold-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-charcoal-500">Featured overview</p>
            <h3 className="mt-2 text-xl font-display text-charcoal-900">Pick the next spotlight.</h3>
            <p className="mt-2 text-sm leading-6 text-charcoal-600">
              Choose a slot first, then make one clean editorial decision at a time.
            </p>
          </div>
          <Button variant="secondary" onClick={() => applyQuickAction(selectedSlot)} disabled={selectedIsSaving}>
            {getQuickActionLabel(selectedSlot)}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {editorialSlotDefinitions.map((definition) => (
            <FeaturedSlotOverviewCard
              key={definition.slot}
              definition={definition}
              draft={drafts[definition.slot]}
              feature={featuresBySlot[definition.slot]}
              isSelected={selectedSlot === definition.slot}
              onSelect={() => setSelectedSlot(definition.slot)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <section className="space-y-6 rounded-[1.6rem] border border-gold-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold-700">Selected slot</p>
              <h3 className="mt-2 text-2xl font-display text-charcoal-900">{selectedDefinition.label}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-charcoal-500">{selectedDefinition.description}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${
                selectedDraft.isActive
                  ? 'border-sage-200 bg-sage-100 text-charcoal-700'
                  : 'border-charcoal-200 bg-charcoal-50 text-charcoal-500'
              }`}
            >
              {selectedDraft.isActive ? 'Active on site' : 'Saved as draft'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor={`${selectedSlot}-source-type`}>Source type</Label>
                <select
                  id={`${selectedSlot}-source-type`}
                  value={selectedDraft.sourceType}
                  onChange={(event) =>
                    updateDraft(selectedSlot, {
                      sourceType: event.target.value as SiteEditorialFeatureSourceType,
                      sourceId: '',
                      sourceLabel: '',
                    })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                >
                  {Object.entries(editorialSourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-[1.15rem] border border-gold-100 bg-cream-50/70 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Selection status</p>
                <p className="mt-2 text-sm font-medium text-charcoal-900">
                  {selectedDraft.sourceId ? 'Source selected' : 'Choose a source next'}
                </p>
                <p className="mt-1 text-sm leading-6 text-charcoal-600">
                  Picking a source fills in the story fields so you can refine instead of starting from scratch.
                </p>
              </div>
            </div>

            {(selectedDraft.sourceType === 'guest_upload' || selectedDraft.sourceType === 'guestbook_message') && (
              <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Source picker</p>
                    <p className="mt-2 text-sm font-medium text-charcoal-900">
                      {selectedDraft.sourceType === 'guest_upload' ? 'Search approved uploads' : 'Search guestbook notes'}
                    </p>
                  </div>
                  <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700">
                    {activeSourceCount} results
                  </span>
                </div>

                <div className="mt-4">
                  <Input
                    id={`${selectedSlot}-source-search`}
                    value={selectedCandidateSearch}
                    onChange={(event) => updateCandidateSearch(selectedSlot, event.target.value)}
                    placeholder={
                      selectedDraft.sourceType === 'guest_upload'
                        ? 'Search by guest name, email, or note'
                        : 'Search by guest name or note'
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3">
                  {selectedDraft.sourceType === 'guest_upload' &&
                    filteredUploadCandidates.map((candidate) => (
                      <FeaturedSourceResultCard
                        key={candidate.id}
                        title={candidate.guest_name}
                        subtitle={
                          candidate.message?.trim() ||
                          (((candidate.video_urls?.length || 0) > 0)
                            ? 'Guest upload ready to spotlight.'
                            : 'Approved upload with no custom note yet.')
                        }
                        meta={`${new Date(candidate.created_at).toLocaleDateString()} · ${
                          ((candidate.video_urls?.length || 0) > 0) ? 'Has video' : 'Photo upload'
                        }`}
                        isSelected={selectedDraft.sourceId === candidate.id}
                        onClick={() => applyGuestUploadSelection(candidate)}
                      />
                    ))}
                  {selectedDraft.sourceType === 'guestbook_message' &&
                    filteredGuestbookCandidates.map((candidate) => (
                      <FeaturedSourceResultCard
                        key={candidate.id}
                        title={candidate.name}
                        subtitle={candidate.content}
                        meta={`${new Date(candidate.created_at).toLocaleDateString()} · ${candidate.type}`}
                        isSelected={selectedDraft.sourceId === candidate.id}
                        onClick={() => applyGuestbookSelection(candidate)}
                      />
                    ))}
                  {activeSourceCount === 0 && (
                    <div className="rounded-[1rem] border border-dashed border-gold-200 bg-white/85 px-4 py-4 text-sm text-charcoal-500">
                      No matches yet. Try a broader search or use the latest recommended source.
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedDraft.sourceType === 'film_chapter' && (
              <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Source picker</p>
                <p className="mt-2 text-sm font-medium text-charcoal-900">Choose a film chapter</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {filmChapterFeatureOptions.map((option) => (
                    <FeaturedSourceResultCard
                      key={option.value}
                      title={option.label.replace('Film chapter: ', '')}
                      subtitle="Use this chapter as the featured return path."
                      meta={`/film?moment=${option.value}`}
                      isSelected={selectedDraft.sourceId === option.value}
                      onClick={() => applyFilmChapterSelection(option)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedDraft.sourceType === 'custom' && (
              <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Custom source</p>
                <div className="mt-4">
                  <Label htmlFor={`${selectedSlot}-source-id-custom`}>Custom source key</Label>
                  <Input
                    id={`${selectedSlot}-source-id-custom`}
                    value={selectedDraft.sourceId}
                    onChange={(event) => updateDraft(selectedSlot, { sourceId: event.target.value })}
                    placeholder="Optional custom identifier"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor={`${selectedSlot}-title`}>Title</Label>
                <Input
                  id={`${selectedSlot}-title`}
                  value={selectedDraft.title}
                  onChange={(event) => updateDraft(selectedSlot, { title: event.target.value })}
                  placeholder="Card headline"
                />
              </div>
              <div>
                <Label htmlFor={`${selectedSlot}-memory-trail`}>Memory trail</Label>
                <select
                  id={`${selectedSlot}-memory-trail`}
                  value={selectedDraft.memoryTrail}
                  onChange={(event) => updateDraft(selectedSlot, { memoryTrail: event.target.value as MemoryTrailId | '' })}
                  className="mt-2 h-11 w-full rounded-xl border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
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

            <div>
              <Label htmlFor={`${selectedSlot}-summary`}>Summary</Label>
              <Textarea
                id={`${selectedSlot}-summary`}
                value={selectedDraft.summary}
                onChange={(event) => updateDraft(selectedSlot, { summary: event.target.value })}
                rows={3}
                placeholder="Short editorial summary for the public card."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <Label htmlFor={`${selectedSlot}-badge-label`}>Badge label</Label>
                <Input
                  id={`${selectedSlot}-badge-label`}
                  value={selectedDraft.badgeLabel}
                  onChange={(event) => updateDraft(selectedSlot, { badgeLabel: event.target.value })}
                  placeholder="Featured note, Guest upload..."
                />
              </div>
              <div>
                <Label htmlFor={`${selectedSlot}-cta-label`}>CTA label</Label>
                <Input
                  id={`${selectedSlot}-cta-label`}
                  value={selectedDraft.ctaLabel}
                  onChange={(event) => updateDraft(selectedSlot, { ctaLabel: event.target.value })}
                  placeholder="Open it, Play clip..."
                />
              </div>
              <div>
                <Label htmlFor={`${selectedSlot}-trail-text`}>Eyebrow text</Label>
                <Input
                  id={`${selectedSlot}-trail-text`}
                  value={selectedDraft.trail}
                  onChange={(event) => updateDraft(selectedSlot, { trail: event.target.value })}
                  placeholder="Now unfolding, Keepsake note..."
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm text-charcoal-600">
                <input
                  type="checkbox"
                  checked={selectedDraft.isActive}
                  onChange={(event) => updateDraft(selectedSlot, { isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-gold-300 text-gold-600 focus:ring-gold-500/30"
                />
                Make this slot active on the public site
            </label>

            <details className="rounded-[1.25rem] border border-gold-100 bg-white/90 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-charcoal-900">
                Advanced settings
                <ChevronDown className="h-4 w-4 text-charcoal-400" />
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <Label htmlFor={`${selectedSlot}-starts-at`}>Starts at</Label>
                    <Input
                      id={`${selectedSlot}-starts-at`}
                      type="datetime-local"
                      value={selectedDraft.startsAt}
                      onChange={(event) => updateDraft(selectedSlot, { startsAt: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${selectedSlot}-ends-at`}>Ends at</Label>
                    <Input
                      id={`${selectedSlot}-ends-at`}
                      type="datetime-local"
                      value={selectedDraft.endsAt}
                      onChange={(event) => updateDraft(selectedSlot, { endsAt: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <Label htmlFor={`${selectedSlot}-source-label`}>Source label override</Label>
                    <Input
                      id={`${selectedSlot}-source-label`}
                      value={selectedDraft.sourceLabel}
                      onChange={(event) => updateDraft(selectedSlot, { sourceLabel: event.target.value })}
                      placeholder="Optional public-facing source label"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${selectedSlot}-source-url`}>Source URL override</Label>
                    <Input
                      id={`${selectedSlot}-source-url`}
                      value={selectedDraft.sourceUrl}
                      onChange={(event) => updateDraft(selectedSlot, { sourceUrl: event.target.value })}
                      placeholder="Optional deep link for the public card"
                    />
                  </div>
                </div>
              </div>
            </details>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSave(selectedSlot)} disabled={selectedIsSaving}>
                {selectedIsSaving ? 'Saving...' : 'Save featured slot'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => updateDraft(selectedSlot, createEditorialDraft(selectedSlot, featuresBySlot[selectedSlot]))}
                disabled={selectedIsSaving}
              >
                Reset changes
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <FeaturedSlotPreviewCard slot={selectedSlot} draft={selectedDraft} />

          {selectedFeature && (
            <div className="rounded-[1.25rem] border border-gold-100 bg-cream-50/70 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Current live row</p>
              <p className="mt-2 text-sm font-medium text-charcoal-900">
                Updated {formatAuditTimestamp(selectedFeature.updated_at)}
                {selectedFeature.updated_by_email ? ` by ${selectedFeature.updated_by_email}` : ''}
              </p>
              <p className="mt-2 text-sm leading-6 text-charcoal-600">
                {selectedFeature.title}
                {selectedFeature.summary ? ` — ${selectedFeature.summary}` : ''}
              </p>
            </div>
          )}

          <details className="rounded-[1.25rem] border border-gold-100 bg-white/90 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-charcoal-900">
              Slot history
              <ChevronDown className="h-4 w-4 text-charcoal-400" />
            </summary>
            <div className="mt-4">
              <EditorialHistoryList entries={selectedHistory} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
*/

function FeaturedContentManager() {
  return <Navigate to="/admin/photos" replace />
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
  const currentPage = getAdminRouteMeta(location.pathname)
  const isDashboardRoute = location.pathname === '/admin'
  const isReviewRoute = location.pathname.startsWith('/admin/review')

  const handleSignOut = async () => {
    await signOut()
    addToast('Signed out successfully', 'success')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(219,180,92,0.14),_transparent_38%),linear-gradient(180deg,#fffdf9_0%,#f8f2ea_100%)]">
      {/* Admin Header */}
      <header className="sticky top-0 z-30 border-b border-gold-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link to="/" className="font-display text-xl text-charcoal-900">
              <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
              <span className="ml-2 text-sm font-normal text-charcoal-500">Admin</span>
            </Link>
            <p className="mt-1 text-sm text-charcoal-500">A calmer workspace for moderation, people review, and site upkeep.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="rounded-full border border-gold-100 bg-cream-50/80 px-4 py-2 text-sm text-charcoal-600">
              Signed in as{' '}
              <span className="font-medium text-charcoal-900">
                {user?.email || 'admin'}
              </span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className={cn('mx-auto px-4 py-6 xl:py-8', isReviewRoute ? 'max-w-[110rem]' : 'max-w-7xl')}>
        {!isDashboardRoute && !isReviewRoute && (
          <section className="mb-4 rounded-[1.15rem] border border-gold-100 bg-white/92 px-4 py-4 shadow-sm sm:px-5">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">{currentPage.eyebrow}</p>
              <h1 className="mt-1 font-display text-[1.6rem] leading-tight text-charcoal-900">
                {currentPage.title}
              </h1>
              <p className="mt-1 text-sm leading-5 text-charcoal-500">{currentPage.description}</p>
            </div>
          </section>
        )}

        {!isReviewRoute && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 xl:hidden">
            {adminNavSections.flatMap((section) => section.items).map((item) => {
              const isActive = location.pathname === item.path

              return (
                <Button key={item.path} variant={isActive ? 'primary' : 'secondary'} size="sm" asChild>
                  <Link to={item.path}>{item.label}</Link>
                </Button>
              )
            })}
          </div>
        )}

        {isReviewRoute ? (
          <main className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.15rem] border border-gold-100 bg-white/92 px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">{currentPage.eyebrow}</p>
                <h1 className="mt-1 text-xl font-display leading-tight text-charcoal-900">{currentPage.title}</h1>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/admin">Back to Dashboard</Link>
              </Button>
            </div>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="photos" element={<PhotoModeration />} />
              <Route path="albums" element={<AlbumOrganizer />} />
              <Route path="review" element={<MediaReviewPanel />} />
              <Route path="guestbook" element={<GuestbookModeration />} />
              <Route path="featured" element={<FeaturedContentManager />} />
              <Route path="audit" element={<AuditLogView />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Routes>
          </main>
        ) : (
          <div className="flex flex-col gap-5 xl:flex-row xl:gap-6">
        {/* Sidebar */}
          <nav className="hidden w-full xl:block xl:w-64 xl:flex-shrink-0" aria-label="Admin navigation">
            <div className="overflow-hidden rounded-[1.4rem] border border-gold-100 bg-white/95 shadow-sm xl:sticky xl:top-24">
              <div className="border-b border-gold-100 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Workspace map</p>
                <p className="mt-2 text-sm leading-5 text-charcoal-500">Open the tool that matches the work in front of you.</p>
              </div>
              <div className="space-y-5 px-3 py-4">
                {adminNavSections.map((section) => (
                  <div key={section.title}>
                    <div className="px-2 pb-1">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-charcoal-400">{section.title}</p>
                    </div>
                    <div className="space-y-2">
                      {section.items.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`block rounded-[1rem] border px-3 py-3 transition-all ${
                              isActive
                                ? 'border-gold-300 bg-gold-50 text-gold-800 shadow-[0_10px_20px_rgba(219,180,92,0.14)]'
                                : 'border-gold-100 bg-white text-charcoal-700 hover:border-gold-200 hover:bg-cream-50/80'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`rounded-lg p-2 ${isActive ? 'bg-white text-gold-700' : 'bg-cream-50 text-charcoal-500'}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{item.label}</p>
                                <p className={`mt-1 text-xs leading-5 ${isActive ? 'text-gold-700/90' : 'text-charcoal-500'}`}>
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="min-w-0 flex-1">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="photos" element={<PhotoModeration />} />
              <Route path="albums" element={<AlbumOrganizer />} />
              <Route path="review" element={<MediaReviewPanel />} />
              <Route path="guestbook" element={<GuestbookModeration />} />
              <Route path="featured" element={<FeaturedContentManager />} />
              <Route path="audit" element={<AuditLogView />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
        )}
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
