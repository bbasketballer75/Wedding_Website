/**
 * `/admin/audit` — moderation audit trail, ported from the frozen
 * `src/pages/admin/AuditLogView.tsx`.
 *
 * Frozen parity: heading/description copy, entity/action/actor selects, free-text
 * search over summary + actor + metadata, 500-row read limit, loading/empty
 * states and the frozen action labels.
 *
 * DELTA (W7-1 report): inline error message instead of the toast provider.
 */
import { History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ModerationAuditEntry } from '@/shared/data/moderation'
import { Input } from '@/shared/ui/Input'
import { useAdminApi } from '../api-context'
import { AuditTrailList } from '../shared/AdminUi'
import { AUDIT_ACTION_LABELS } from '../utils'

type EntityFilter = 'all' | 'guest_upload' | 'guestbook_message' | 'photo_claim'

const ENTITY_FILTERS: ReadonlyArray<{ value: EntityFilter; label: string }> = [
  { value: 'all', label: 'All entities' },
  { value: 'guest_upload', label: 'Uploads' },
  { value: 'guestbook_message', label: 'Guestbook' },
  { value: 'photo_claim', label: 'Claims' },
]

export function AuditLogPage() {
  const api = useAdminApi()
  const [entries, setEntries] = useState<readonly ModerationAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchAuditEntries = useCallback((): Promise<void> => {
    return api
      .fetchAuditLog()
      .then(data => {
        setEntries(data)
        setLoadError(null)
      })
      .catch(() => {
        setEntries([])
        setLoadError('Failed to load moderation history. Please try again.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [api])

  useEffect(() => {
    void fetchAuditEntries()
  }, [fetchAuditEntries])

  const actorOptions = useMemo(() => {
    return Array.from(
      new Set(
        entries
          .map(entry => entry.actorEmail)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    ).sort()
  }, [entries])

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return entries.filter(entry => {
      if (entityFilter !== 'all' && entry.entityType !== entityFilter) return false
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false
      if (actorFilter !== 'all' && entry.actorEmail !== actorFilter) return false
      if (!normalizedSearch) return true

      const metadataText = JSON.stringify(entry.metadata).toLowerCase()
      const haystack =
        `${entry.summary} ${entry.actorName ?? ''} ${entry.actorEmail ?? ''} ${metadataText}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [actionFilter, actorFilter, entityFilter, entries, searchQuery])

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <h2 className='text-2xl font-display text-charcoal-900'>Moderation Audit Trail</h2>
        <p className='max-w-3xl text-sm leading-6 text-charcoal-500'>
          Every recorded moderation action lives here. Use it to confirm who approved, rejected,
          published, or removed content and when those decisions happened.
        </p>
      </div>

      {loadError && (
        <p
          role='alert'
          className='rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'
        >
          {loadError}
        </p>
      )}

      <div className='rounded-xl border border-gold-100 bg-white p-5 shadow-sm'>
        <div className='grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]'>
          <Input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder='Search guest name, email, summary, or metadata'
            aria-label='Search audit trail'
          />
          <select
            value={entityFilter}
            onChange={event => setEntityFilter(event.target.value as EntityFilter)}
            aria-label='Filter audit trail by entity type'
            className='h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-400'
          >
            {ENTITY_FILTERS.map(filter => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={event => setActionFilter(event.target.value)}
            aria-label='Filter audit trail by action'
            className='h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-400'
          >
            <option value='all'>All actions</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={event => setActorFilter(event.target.value)}
            aria-label='Filter audit trail by actor'
            className='h-11 rounded-full border border-gold-200/70 bg-white px-4 text-sm text-charcoal-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-400'
          >
            <option value='all'>All actors</option>
            {actorOptions.map(actorEmail => (
              <option key={actorEmail} value={actorEmail}>
                {actorEmail}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className='rounded-xl border border-gold-100 bg-white px-6 py-12 text-center'>
          <div className='mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-gold-500' />
          <p className='mt-4 text-charcoal-500'>Loading moderation history...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className='rounded-xl border border-gold-100 bg-white px-6 py-12 text-center'>
          <History className='mx-auto h-10 w-10 text-gold-500' aria-hidden='true' />
          <p className='mt-4 text-charcoal-700'>No moderation history matches these filters yet.</p>
        </div>
      ) : (
        <AuditTrailList entries={filteredEntries} />
      )}
    </div>
  )
}
