/** Shared admin UI atoms (frozen `src/pages/admin/shared.tsx` + Dashboard cards). */
import type { LucideIcon } from 'lucide-react'
import type { ModerationAuditEntry } from '@/shared/data/moderation'
import { useState } from 'react'
import {
  AUDIT_ACTION_LABELS,
  formatAuditTimestamp,
  getAuditActorLabel,
  getAuditEntityLabel,
} from '../utils'

// ─── Skeletons / placeholders ───────────────────────────────────────────────

export function AdminPageSkeleton() {
  return (
    <div className='space-y-4 animate-pulse' data-testid='admin-page-skeleton'>
      <div className='theme-skeleton h-8 w-48 rounded-lg' />
      <div className='theme-skeleton h-32 rounded-2xl' />
      <div className='theme-skeleton h-64 rounded-2xl' />
    </div>
  )
}

export function AdminSectionPlaceholder({ section }: { section: string }) {
  return (
    <section className='rounded-[1.5rem] border border-gold-100 bg-white p-6 shadow-sm'>
      <p className='text-[11px] uppercase tracking-[0.32em] text-charcoal-500'>Wave 7-2 seam</p>
      <h2 className='mt-2 font-display text-2xl text-charcoal-900'>
        The {section} workspace lands in W7-2.
      </h2>
      <p className='mt-2 max-w-2xl text-sm leading-6 text-charcoal-600'>
        This section is owned by the second Wave-7 work package. The shell, auth gate, nav and page
        header are live; the page body is injected through the admin page registry.
      </p>
    </section>
  )
}

// ─── Stat card (frozen Dashboard.tsx StatCard) ──────────────────────────────

export interface AdminStatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: 'blue' | 'green' | 'amber' | 'purple'
  alert?: boolean
}

export function AdminStatCard({
  title,
  value,
  icon: Icon,
  color,
  alert = false,
}: AdminStatCardProps) {
  const colors: Record<AdminStatCardProps['color'], string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div
      className={`bg-white rounded-[1.2rem] p-4 shadow-sm border ${alert ? 'border-amber-400' : 'border-gold-100'}`}
    >
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-sm text-charcoal-500'>{title}</p>
          <p className='mt-1 text-[2rem] font-display leading-none text-charcoal-900'>{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>
          <Icon className='h-5 w-5' />
        </div>
      </div>
      {alert && (
        <p className='text-amber-600 text-xs mt-2 flex items-center gap-1'>
          <span className='w-2 h-2 bg-amber-500 rounded-full animate-pulse' />
          Requires attention
        </p>
      )}
    </div>
  )
}

// ─── Audit trail ────────────────────────────────────────────────────────────

export function AuditTrailList({
  entries,
  emptyLabel = 'No moderation history yet.',
}: {
  entries: readonly ModerationAuditEntry[]
  emptyLabel?: string
}) {
  if (entries.length === 0) {
    return (
      <div className='rounded-2xl border border-gold-100 bg-white/80 px-4 py-3 text-sm text-charcoal-500'>
        {emptyLabel}
      </div>
    )
  }

  return (
    <ul className='space-y-3' aria-label='Moderation audit trail'>
      {entries.map(entry => (
        <li
          key={entry.id}
          className='rounded-2xl border border-gold-100 bg-white/88 px-4 py-3'
          data-testid='audit-entry'
        >
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <p className='text-sm font-medium text-charcoal-900'>
                {AUDIT_ACTION_LABELS[entry.action] || entry.summary}
              </p>
              <p className='mt-1 text-xs text-charcoal-400'>
                {getAuditActorLabel(entry)} · {formatAuditTimestamp(entry.createdAt)}
              </p>
            </div>
            <span className='rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700'>
              {getAuditEntityLabel(entry.entityType)}
            </span>
          </div>
          <p className='mt-3 text-sm leading-6 text-charcoal-600'>{entry.summary}</p>
        </li>
      ))}
    </ul>
  )
}

export function CompactAuditHistory({
  entries,
  title = 'Recent history',
  emptyLabel,
}: {
  entries: readonly ModerationAuditEntry[]
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
    <div className='rounded-[1.25rem] border border-gold-100 bg-white/88 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-[10px] uppercase tracking-[0.3em] text-charcoal-500'>{title}</p>
          {latestEntry ? (
            <p className='mt-2 text-sm font-medium text-charcoal-900'>
              {AUDIT_ACTION_LABELS[latestEntry.action] || latestEntry.summary}
            </p>
          ) : (
            <p className='mt-2 text-sm text-charcoal-500'>{emptyLabel}</p>
          )}
        </div>
        {remainingEntries.length > 0 && (
          <button
            type='button'
            onClick={() => setExpanded(current => !current)}
            aria-expanded={expanded}
            className='rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-700 transition-colors hover:bg-gold-100'
          >
            {expanded ? 'Hide history' : `Show ${entries.length} actions`}
          </button>
        )}
      </div>

      {latestEntry && (
        <div className='mt-3 rounded-2xl border border-gold-100 bg-cream-50/70 px-4 py-3'>
          <p className='text-xs text-charcoal-400'>
            {getAuditActorLabel(latestEntry)} · {formatAuditTimestamp(latestEntry.createdAt)}
          </p>
          <p className='mt-2 text-sm leading-6 text-charcoal-600'>{latestEntry.summary}</p>
        </div>
      )}

      {expanded && remainingEntries.length > 0 && (
        <div className='mt-3'>
          <AuditTrailList entries={remainingEntries} />
        </div>
      )}
    </div>
  )
}
