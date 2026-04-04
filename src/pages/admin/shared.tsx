import { useState } from 'react'
import { type ModerationAuditLog } from '@/lib/supabase'
import { getAuditActorLabel, formatAuditTimestamp, auditActionLabels } from './utils'

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
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

// ─── AuditTrailList ───────────────────────────────────────────────────────────

export function AuditTrailList({
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

// ─── CompactAuditHistory ──────────────────────────────────────────────────────

export function CompactAuditHistory({
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
