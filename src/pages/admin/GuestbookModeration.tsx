import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  fetchModerationAuditTimeline,
  recordModerationAudit,
  supabase,
  type GuestbookMessage,
} from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/context/ToastContext'
import {
  getAdminAuditActor,
  groupAuditEntries,
  appendAuditEntry,
  type AuditEntriesByEntityId,
} from './utils'
import { CompactAuditHistory } from './shared'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'

export function GuestbookModeration() {
  const [messages, setMessages] = useState<GuestbookMessage[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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
    const haystack = `${message.name} ${message.email} ${message.content}`.toLowerCase()
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase())
  })

  return (
    <ComponentErrorBoundary componentName="Guestbook Moderation">
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Guestbook Moderation</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          Keep the guestbook warm and readable. Search by guest and bulk-clear anything that clearly does not belong.
        </p>
      </div>

      <div className="rounded-xl border border-gold-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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

      <div data-testid="guestbook-moderation-list" className="space-y-4">
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
                </div>
              </div>
              <Button
                size="sm"
                variant="danger"
                aria-label="Delete message"
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
    </ComponentErrorBoundary>
  )
}
