/**
 * Admin navigation model + route metadata, ported from the frozen
 * `src/pages/admin/utils.ts` (nav sections, page copy, audit labels, formatting).
 */
import type { ModerationAuditEntry } from '@/shared/data/moderation'
import {
  BarChart3,
  FolderOpen,
  History,
  Image,
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AdminSection } from './data'

export interface AdminNavItem {
  section: AdminSection
  label: string
  icon: LucideIcon
  description: string
}

export interface AdminNavSection {
  title: string
  items: readonly AdminNavItem[]
}

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    title: 'Run the day-to-day',
    items: [
      {
        section: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        description: 'See what needs attention next.',
      },
      {
        section: 'photos',
        label: 'Photos',
        icon: Image,
        description: 'Moderate uploads, publish photos, and run guest tagging.',
      },
      {
        section: 'albums',
        label: 'Albums',
        icon: FolderOpen,
        description: 'Arrange the live order inside each public album.',
      },
      {
        section: 'review',
        label: 'People Review',
        icon: Users,
        description: 'Work through face review and named people.',
      },
      {
        section: 'claims',
        label: 'Photo Claims',
        icon: ShieldCheck,
        description: 'Review and approve photo ownership and face tag claims.',
      },
      {
        section: 'guestbook',
        label: 'Guestbook',
        icon: MessageSquare,
        description: 'Moderate text messages.',
      },
    ],
  },
  {
    title: 'Shape the public site',
    items: [
      {
        section: 'featured',
        label: 'Featured',
        icon: Sparkles,
        description: 'Set what appears in the homepage and film page spotlight sections.',
      },
      {
        section: 'audit',
        label: 'Audit Trail',
        icon: History,
        description: 'See who changed moderation state and when.',
      },
      {
        section: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        description: 'Track verified database activity inside the app.',
      },
      {
        section: 'settings',
        label: 'Settings',
        icon: SettingsIcon,
        description: 'Reference the live setup and operating notes.',
      },
    ],
  },
]

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap(
  section => section.items
)

export interface AdminRouteMeta {
  eyebrow: string
  title: string
  description: string
}

export const ADMIN_ROUTE_META: Record<AdminSection, AdminRouteMeta> = {
  dashboard: {
    eyebrow: 'Control room',
    title: 'Keep the whole wedding archive moving smoothly.',
    description:
      'Start here to see what needs attention now, then jump straight into the next task for photos, people, or the guestbook.',
  },
  photos: {
    eyebrow: 'Photos workflow',
    title: 'Moderate uploads, publish moments, and keep guest tagging moving.',
    description:
      'This is the operational heart of the site: review incoming uploads, decide what goes live, and run the browser-first digiKam loop when guest face tags are worth adding.',
  },
  review: {
    eyebrow: 'People workflow',
    title: 'Turn face detections into a browsable people archive.',
    description:
      'Use photo-first review for accuracy, then clean up recurring people in bulk so the public gallery stays useful instead of noisy.',
  },
  claims: {
    eyebrow: 'Claims workflow',
    title: 'Review and approve photo ownership and face tag claims.',
    description:
      'Manage self-service verification claims. Confirm identities, review photos/faces, and approve them to display names in elegant gold italics.',
  },
  albums: {
    eyebrow: 'Album workflow',
    title: 'Arrange the live album order exactly how you want it.',
    description:
      'This is the place for sequencing, not moderation: drag photos into order, fix misfiled images, and save the public arrangement album by album.',
  },
  guestbook: {
    eyebrow: 'Guestbook workflow',
    title: 'Keep the softer side of the archive tidy and welcoming.',
    description:
      'Review notes and media only when needed, without losing the warmth of the messages that make the site feel lived in.',
  },
  featured: {
    eyebrow: 'Site editorial',
    title: 'Control what the public site highlights.',
    description:
      'Each slot maps to a live section on the homepage or film page. Set the content, toggle it on, and guests see it immediately.',
  },
  audit: {
    eyebrow: 'History',
    title: 'See the moderation paper trail.',
    description:
      'Use this whenever you want to confirm what changed, who changed it, and whether a workflow is behaving the way you expect.',
  },
  analytics: {
    eyebrow: 'Verified activity',
    title: 'Read the database-backed pulse of the site.',
    description:
      'This screen is intentionally narrow: it reflects confirmed app activity, while Google Analytics and Sentry remain the source of truth for audience traffic and errors.',
  },
  settings: {
    eyebrow: 'Operations notes',
    title: 'Reference the live setup without pretending these are editable settings.',
    description:
      'Use this page as the working notes for how the site is configured, what is intentionally live, and where the real controls live outside this UI.',
  },
}

export function getAdminRouteMeta(section: AdminSection): AdminRouteMeta {
  return ADMIN_ROUTE_META[section]
}

// ─── Audit labels/formatting (frozen utils.ts:477-498) ─────────────────────

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  upload_moved_to_pending: 'Moved to pending review',
  upload_approved_unpublished: 'Approved, not public',
  upload_approved_published: 'Approved + published',
  upload_removed_from_gallery: 'Removed from gallery',
  upload_rejected: 'Rejected',
  upload_bulk_rejected: 'Bulk rejected',
  guestbook_message_deleted: 'Deleted message',
  guestbook_bulk_deleted: 'Bulk deleted message',
  claim_approved: 'Approved claim',
  claim_rejected: 'Rejected claim',
}

export function formatAuditTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleString()
}

export function getAuditActorLabel(entry: Pick<ModerationAuditEntry, 'actorName' | 'actorEmail'>) {
  return entry.actorName || entry.actorEmail || 'Admin'
}

export function getAuditEntityLabel(entityType: string): string {
  if (entityType === 'guest_upload') return 'Upload'
  if (entityType === 'guestbook_message') return 'Guestbook'
  if (entityType === 'photo_claim') return 'Claim'
  return entityType
}

export function formatUploadDate(value: string | null): string {
  if (!value) return 'Unknown upload date'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

export function formatMessageTimestamp(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function formatClaimDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
