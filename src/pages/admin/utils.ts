import { useAuthStore } from '@/stores/authStore'
import {
  type GuestUpload,
  type ModerationAuditLog,
  type RecordModerationAuditInput,
} from '@/lib/supabase'
import { getMemoryTrailById, type MemoryTrailId } from '@/data/memoryTrails'
import {
  LayoutDashboard,
  Image,
  MessageSquare,
  Settings as SettingsIcon,
  FolderOpen,
  History,
  BarChart3,
  Users,
} from 'lucide-react'

// ─── Local types ─────────────────────────────────────────────────────────────

export type AdminNavItem = {
  path: string
  label: string
  icon: React.ElementType
  description: string
}

export type AdminNavSection = {
  title: string
  description: string
  items: AdminNavItem[]
}

export type ModerationUpload = Omit<GuestUpload, 'message'> & { message?: string | null }

export type ModerationCollection = 'Wedding Day' | 'Engagement' | 'Bach+ette' | 'Guest Uploads'
export type GuestVideoVisibility = 'archive_only' | 'guest_highlights'

export interface PromotionDraft {
  collection: ModerationCollection
  category: string
  caption: string
  tags: string
  location: string
  videoVisibility: GuestVideoVisibility
  memoryTrail: MemoryTrailId | ''
}

export type ModerationQueueFilter = 'pending' | 'approved-unpublished' | 'approved-published' | 'rejected'

export type AuditActor = NonNullable<RecordModerationAuditInput['actor']>
export type AuditEntriesByEntityId = Record<string, ModerationAuditLog[]>

export interface GuestUploadMediaEntry {
  url: string
  fingerprint: string | null
}

export interface GuestUploadDuplicateInsight {
  publishableEntries: GuestUploadMediaEntry[]
  publishableCount: number
  withinUploadCount: number
  approvedDuplicateCount: number
  pendingOverlapCount: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const adminNavSections: AdminNavSection[] = [
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

export const adminRouteMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
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

// ─── Utility functions ────────────────────────────────────────────────────────

export function getAdminRouteMeta(pathname: string) {
  if (pathname === '/admin') return adminRouteMeta['/admin']

  const match = Object.entries(adminRouteMeta)
    .filter(([path]) => path !== '/admin' && pathname.startsWith(path))
    .sort((left, right) => right[0].length - left[0].length)[0]

  return match ? match[1] : adminRouteMeta['/admin']
}

export const DEFAULT_GUEST_TAGGING_ROOT = 'C:/Users/bbask/Pictures/Guest Upload Tagging'

export function buildGuestTaggingCommands(workingRoot: string) {
  const cleanRoot = workingRoot.trim() || DEFAULT_GUEST_TAGGING_ROOT

  return {
    export: `npm run media:guest:tag:export -- "${cleanRoot}"`,
    import: `npm run media:batch:faces:digikam -- "${cleanRoot}"`,
    sync: `npm run media:guest:tag:sync -- "${cleanRoot}"`,
  }
}

export const collectionOptions: Array<{
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

export function normalizeTags(rawTags: string) {
  return Array.from(
    new Set(
      rawTags
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

export function createPromotionDraft(upload: ModerationUpload): PromotionDraft {
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

export function getGuestVideoVisibilityLabel(value: GuestVideoVisibility) {
  switch (value) {
    case 'guest_highlights':
      return 'Guest highlights'
    default:
      return 'Archive only'
  }
}

export function buildGuestVideoPromotionPatch(draft: PromotionDraft) {
  return {
    video_visibility: draft.videoVisibility,
    memory_trail: draft.memoryTrail || null,
    editorial_title: null,
    editorial_summary: null,
    featured_rank: null,
  }
}

export function getPublishedPhotoCount(upload: ModerationUpload, publishedPhotoUrls: Set<string>) {
  return (upload.photo_urls || []).filter((url) => publishedPhotoUrls.has(url)).length
}

export function buildGuestUploadMediaEntries(upload: ModerationUpload) {
  const photoUrls = upload.photo_urls || []
  const photoFingerprints = upload.photo_fingerprints || []

  return photoUrls.map((url, index) => ({
    url,
    fingerprint: photoFingerprints[index] || null,
  }))
}

export function buildApprovedFingerprintSet(uploads: ModerationUpload[], excludedUploadId?: string) {
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

export function buildPendingFingerprintSet(uploads: ModerationUpload[], excludedUploadId?: string) {
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

export function getGuestUploadDuplicateInsight(
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

export function getModerationState(upload: ModerationUpload, publishedPhotoUrls: Set<string>): ModerationQueueFilter {
  if (upload.status === 'pending') return 'pending'
  if (upload.status === 'rejected') return 'rejected'
  return getPublishedPhotoCount(upload, publishedPhotoUrls) > 0 ? 'approved-published' : 'approved-unpublished'
}

export function formatMemoryTrailLabel(trail: MemoryTrailId | '' | null | undefined, fallback?: string | null) {
  if (trail) {
    return getMemoryTrailById(trail)?.label || fallback || trail
  }

  return fallback || 'Editorial lane'
}

export function getAdminAuditActor(user: ReturnType<typeof useAuthStore.getState>['user']): AuditActor {
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

export function groupAuditEntries(entries: ModerationAuditLog[]) {
  return entries.reduce<AuditEntriesByEntityId>((acc, entry) => {
    if (!acc[entry.entity_id]) {
      acc[entry.entity_id] = []
    }

    acc[entry.entity_id].push(entry)
    return acc
  }, {})
}

export function appendAuditEntry(previous: AuditEntriesByEntityId, entry: ModerationAuditLog) {
  return {
    ...previous,
    [entry.entity_id]: [entry, ...(previous[entry.entity_id] || [])],
  }
}

export function formatAuditTimestamp(timestamp: string) {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleString()
}

export function getAuditActorLabel(entry: ModerationAuditLog) {
  return entry.actor_name || entry.actor_email || 'Admin'
}
