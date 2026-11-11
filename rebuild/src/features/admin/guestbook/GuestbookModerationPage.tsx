/**
 * `/admin/guestbook` — guestbook moderation, ported from the frozen
 * `src/pages/admin/GuestbookModeration.tsx`.
 *
 * Frozen parity: heading/description copy, search by guest name/email/note,
 * checkbox selection, bulk delete button, per-message delete action and the
 * `guestbook-moderation-list` testid; every deletion writes an audit entry with
 * the acting admin (`guestbook_message_deleted` / `guestbook_bulk_deleted`).
 *
 * DELTAS (W7-1 report): the frozen page deleted immediately (no confirmation)
 * and used the toast provider; this port opens the shared confirm dialog for
 * both single and bulk deletes (task requirement: "delete with confirmation")
 * and reports results inline.
 */
import { MessageSquare, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModerationAuditEntry } from '@/shared/data/moderation'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { useAdminApi } from '../api-context'
import { useAdminAuth } from '../auth-context'
import { getAdminAuditActor, type AdminGuestbookMessage } from '../data'
import { AdminConfirmDialog } from '../shared/AdminConfirmDialog'
import { CompactAuditHistory } from '../shared/AdminUi'
import { formatMessageTimestamp } from '../utils'

function groupAuditEntriesByEntity(
  entries: readonly ModerationAuditEntry[]
): Record<string, ModerationAuditEntry[]> {
  const grouped: Record<string, ModerationAuditEntry[]> = {}
  for (const entry of entries) {
    const bucket = grouped[entry.entityId] ?? []
    bucket.push(entry)
    grouped[entry.entityId] = bucket
  }
  return grouped
}

export function GuestbookModerationPage() {
  const api = useAdminApi()
  const auth = useAdminAuth()
  const actor = getAdminAuditActor(auth.user)

  const [messages, setMessages] = useState<AdminGuestbookMessage[]>([])
  const [auditEntries, setAuditEntries] = useState<readonly ModerationAuditEntry[]>([])
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<
    { mode: 'single'; message: AdminGuestbookMessage } | { mode: 'bulk' } | null
  >(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback((): Promise<void> => {
    return Promise.all([api.fetchGuestbookMessages(), api.fetchAuditLog()])
      .then(([nextMessages, nextAudit]) => {
        setMessages([...nextMessages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        setAuditEntries(nextAudit.filter(entry => entry.entityType === 'guestbook_message'))
      })
      .catch(() => {
        setMessage({ tone: 'error', text: 'The guestbook moderation queue could not be loaded.' })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const auditByMessageId = groupAuditEntriesByEntity(auditEntries)

  const handleDelete = async (ids: readonly string[]) => {
    if (ids.length === 0) return
    setSaving(true)
    try {
      const deleted = await api.deleteGuestbookMessages({ ids, actor })
      setSelectedIds(new Set())
      setMessage({
        tone: 'success',
        text:
          deleted === 1
            ? 'Message deleted.'
            : `Deleted ${deleted} guestbook message${deleted === 1 ? '' : 's'}.`,
      })
      await load()
      listRef.current?.focus()
    } catch {
      setMessage({ tone: 'error', text: 'The selected messages could not be deleted.' })
    } finally {
      setSaving(false)
      setConfirmTarget(null)
    }
  }

  const filteredMessages = messages.filter(entry => {
    const haystack = `${entry.name} ${entry.email} ${entry.content}`.toLowerCase()
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase())
  })

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <h2 className='text-2xl font-display text-charcoal-900'>Guestbook Moderation</h2>
        <p className='max-w-3xl text-sm leading-6 text-charcoal-500'>
          Keep the guestbook warm and readable. Search by guest and bulk-clear anything that clearly
          does not belong.
        </p>
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className='rounded-xl border border-gold-100 bg-white p-5 shadow-sm'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder='Search by guest name, email, or note'
              className='min-w-[18rem]'
              aria-label='Search guestbook messages'
            />
            {selectedIds.size > 0 && (
              <Button
                variant='danger'
                disabled={saving}
                onClick={() => setConfirmTarget({ mode: 'bulk' })}
              >
                <Trash2 className='mr-2 h-4 w-4' aria-hidden='true' />
                Delete selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      <div
        ref={listRef}
        tabIndex={-1}
        className='space-y-4 outline-none'
        data-testid='guestbook-moderation-list'
      >
        {loading ? (
          <div className='rounded-xl border border-gold-100 bg-white px-6 py-12 text-center text-charcoal-500'>
            Loading guestbook messages...
          </div>
        ) : (
          filteredMessages.map(entry => (
            <div
              key={entry.id}
              className='bg-white rounded-xl p-6 border border-gold-100 shadow-sm'
              data-testid='guestbook-moderation-item'
            >
              <div className='flex items-start justify-between'>
                <div className='flex items-start gap-3'>
                  <label className='mt-1 flex items-center'>
                    <input
                      type='checkbox'
                      checked={selectedIds.has(entry.id)}
                      onChange={() =>
                        setSelectedIds(previous => {
                          const next = new Set(previous)
                          if (next.has(entry.id)) next.delete(entry.id)
                          else next.add(entry.id)
                          return next
                        })
                      }
                      className='h-4 w-4 rounded border-gold-300 text-gold-600 focus:ring-gold-500'
                    />
                    <span className='sr-only'>Select message from {entry.name}</span>
                  </label>
                  <div>
                    <p className='font-medium text-charcoal-900'>{entry.name}</p>
                    <p className='text-sm text-charcoal-500'>{entry.email}</p>
                    <p className='text-sm text-charcoal-500'>
                      {formatMessageTimestamp(entry.createdAt)}
                    </p>
                  </div>
                </div>
                <Button
                  size='sm'
                  variant='danger'
                  aria-label='Delete message'
                  disabled={saving}
                  onClick={() => setConfirmTarget({ mode: 'single', message: entry })}
                >
                  <Trash2 className='w-4 h-4' aria-hidden='true' />
                </Button>
              </div>
              <p className='mt-4 text-charcoal-700'>{entry.content}</p>
              <div className='mt-4'>
                <CompactAuditHistory
                  entries={auditByMessageId[entry.id] ?? []}
                  title='Moderation history'
                  emptyLabel='No moderation history yet.'
                />
              </div>
            </div>
          ))
        )}

        {!loading && filteredMessages.length === 0 && (
          <div className='rounded-xl border border-gold-100 bg-white px-6 py-12 text-center'>
            <MessageSquare className='mx-auto h-10 w-10 text-gold-500' aria-hidden='true' />
            <p className='mt-4 text-charcoal-700'>
              No guestbook messages match this view right now.
            </p>
          </div>
        )}
      </div>

      <AdminConfirmDialog
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (!confirmTarget) return
          const ids = confirmTarget.mode === 'bulk' ? [...selectedIds] : [confirmTarget.message.id]
          void handleDelete(ids)
        }}
        title={
          confirmTarget?.mode === 'single'
            ? 'Delete guestbook message'
            : `Delete ${selectedIds.size} guestbook message${selectedIds.size === 1 ? '' : 's'}`
        }
        confirmLabel={confirmTarget?.mode === 'single' ? 'Delete' : 'Delete selected'}
        confirmVariant='danger'
      >
        <p className='text-sm text-charcoal-600'>
          {confirmTarget?.mode === 'single'
            ? `Delete the note from ${confirmTarget.message.name}? This cannot be undone, and the deletion is recorded in the moderation audit log.`
            : `Delete ${selectedIds.size} selected message${selectedIds.size === 1 ? '' : 's'}? This cannot be undone, and each deletion is recorded in the moderation audit log.`}
        </p>
      </AdminConfirmDialog>
    </div>
  )
}
