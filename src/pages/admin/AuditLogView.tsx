import { useState, useEffect, useCallback, useMemo } from 'react'
import { History } from 'lucide-react'
import {
  fetchModerationAuditTimeline,
  type ModerationAuditAction,
  type ModerationAuditLog,
} from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/context/ToastContext'
import { AuditTrailList } from './shared'
import { auditActionLabels } from './utils'

export function AuditLogView() {
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
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-(--color-gold) focus:ring-2 focus:ring-(--color-gold)"
          >
            <option value="all">All entities</option>
            <option value="guest_upload">Uploads</option>
            <option value="guestbook_message">Guestbook</option>
          </select>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value as typeof actionFilter)}
            aria-label="Filter audit trail by action"
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-(--color-gold) focus:ring-2 focus:ring-(--color-gold)"
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
            className="h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-(--color-gold) focus:ring-2 focus:ring-(--color-gold)"
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
