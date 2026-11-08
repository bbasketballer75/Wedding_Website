/**
 * `/admin/photos` — guest upload moderation, ported from the frozen
 * `src/pages/admin/PhotoModeration.tsx` + `src/components/admin/GuestUploadModerationList.tsx`
 * + `src/stores/moderationStore.ts` behaviour.
 *
 * Frozen parity: heading/description copy, three status cards, Pending /
 * Approved / Rejected tabs with counts, bulk approve/reject, publish to one of
 * the four product albums, per-upload approve/reject with optional rejection
 * reason, empty/loading states and the `upload-queue` testid.
 *
 * DELTAS (documented in the W7-1 report):
 * - the frozen Zustand store fetched only the active tab (so other tab counts
 *   read 0). This port loads all three status queues in parallel, so tab counts
 *   are accurate; the queue itself still shows only the active tab.
 * - the frozen toast becomes an inline `role=status` message (no ToastProvider).
 * - after a successful transition focus moves to the queue container (W7-1 a11y:
 *   "focus after actions").
 */
import { Eye, CheckCircle, XCircle, Inbox } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ListSkeleton } from '@/shared/ui/Skeleton'
import { Textarea } from '@/shared/ui/Textarea'
import { useAdminApi } from '../api-context'
import { useAdminAuth } from '../auth-context'
import { getAdminAuditActor, type AdminUpload, type AdminUploadStatus } from '../data'
import { AdminConfirmDialog } from '../shared/AdminConfirmDialog'
import { BulkActionToolbar } from './BulkActionToolbar'
import { UploadCard } from './UploadCard'

const STATUS_TABS: ReadonlyArray<{ value: AdminUploadStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

type Queues = Record<AdminUploadStatus, AdminUpload[]>

const EMPTY_QUEUES: Queues = { pending: [], approved: [], rejected: [] }

function sortByNewest(uploads: readonly AdminUpload[]): AdminUpload[] {
  return [...uploads].sort((left, right) =>
    (right.created_at ?? '').localeCompare(left.created_at ?? '')
  )
}

function PhotoStatCard({
  title,
  value,
  icon: Icon,
  color,
  alert,
}: {
  title: string
  value: number
  icon: typeof Eye
  color: 'amber' | 'green' | 'blue'
  alert?: boolean
}) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }
  const iconColorMap = {
    amber: 'text-amber-500',
    green: 'text-green-500',
    blue: 'text-blue-500',
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${colorMap[color]} ${
        alert ? 'ring-2 ring-amber-300' : ''
      }`}
    >
      <div className={`rounded-full bg-white/70 p-2 ${alert ? 'animate-pulse' : ''}`}>
        <Icon className={`h-5 w-5 ${iconColorMap[color]}`} aria-hidden='true' />
      </div>
      <div>
        <p className='text-2xl font-display'>{value}</p>
        <p className='text-xs opacity-80'>{title}</p>
      </div>
    </div>
  )
}

export function UploadModerationPage() {
  const api = useAdminApi()
  const auth = useAdminAuth()
  const actor = getAdminAuditActor(auth.user)

  const [queues, setQueues] = useState<Queues>(EMPTY_QUEUES)
  const [activeTab, setActiveTab] = useState<AdminUploadStatus>('pending')
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set())
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false)
  const [bulkRejectReason, setBulkRejectReason] = useState('')
  const queueRef = useRef<HTMLDivElement>(null)

  const load = useCallback((): Promise<void> => {
    return Promise.all([
      api.fetchUploads('pending'),
      api.fetchUploads('approved'),
      api.fetchUploads('rejected'),
    ])
      .then(([pending, approved, rejected]) => {
        setQueues({
          pending: sortByNewest(pending),
          approved: sortByNewest(approved),
          rejected: sortByNewest(rejected),
        })
        setMessage(null)
      })
      .catch(() => {
        setMessage({ tone: 'error', text: 'The upload queue could not be loaded right now.' })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const activeUploads = queues[activeTab]
  const selectedCount = selectedIds.size
  const isLoading = savingIds.size > 0

  const focusQueue = () => {
    queueRef.current?.focus()
  }

  const applyUpdatedUpload = (updated: AdminUpload) => {
    setQueues(previous => {
      const next: Queues = { pending: [], approved: [], rejected: [] }
      for (const status of STATUS_TABS.map(tab => tab.value)) {
        next[status] = previous[status].filter(upload => upload.id !== updated.id)
      }
      next[updated.status].push(updated)
      next[updated.status] = sortByNewest(next[updated.status])
      return next
    })
  }

  const markSaving = (ids: readonly string[], saving: boolean) => {
    setSavingIds(previous => {
      const next = new Set(previous)
      for (const id of ids) {
        if (saving) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const handleApprove = async (upload: AdminUpload) => {
    markSaving([upload.id], true)
    try {
      const updated = await api.moderateUpload({ id: upload.id, action: 'approve', actor })
      applyUpdatedUpload(updated)
      setMessage({ tone: 'success', text: `Approved the upload from ${upload.guest_name}.` })
      focusQueue()
    } catch {
      setMessage({ tone: 'error', text: 'That upload could not be approved. Please try again.' })
    } finally {
      markSaving([upload.id], false)
    }
  }

  const handleReject = async (upload: AdminUpload, reason?: string) => {
    markSaving([upload.id], true)
    try {
      const updated = await api.moderateUpload({
        id: upload.id,
        action: 'reject',
        ...(reason ? { reason } : {}),
        actor,
      })
      applyUpdatedUpload(updated)
      setMessage({ tone: 'success', text: `Rejected the upload from ${upload.guest_name}.` })
      focusQueue()
    } catch {
      setMessage({ tone: 'error', text: 'That upload could not be rejected. Please try again.' })
    } finally {
      markSaving([upload.id], false)
    }
  }

  const handleBulkApprove = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    markSaving(ids, true)
    try {
      const updated = await api.bulkModerate({ ids, action: 'approve', actor })
      for (const upload of updated) applyUpdatedUpload(upload)
      setSelectedIds(new Set())
      setMessage({
        tone: 'success',
        text: `Approved ${ids.length} upload${ids.length === 1 ? '' : 's'}.`,
      })
      focusQueue()
    } catch {
      setMessage({ tone: 'error', text: 'The selected uploads could not be approved.' })
    } finally {
      markSaving(ids, false)
    }
  }

  const handleBulkReject = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const reason = bulkRejectReason.trim() || undefined
    setShowBulkRejectDialog(false)
    setBulkRejectReason('')
    markSaving(ids, true)
    try {
      const updated = await api.bulkModerate({
        ids,
        action: 'reject',
        ...(reason ? { reason } : {}),
        actor,
      })
      for (const upload of updated) applyUpdatedUpload(upload)
      setSelectedIds(new Set())
      setMessage({
        tone: 'success',
        text: `Rejected ${ids.length} upload${ids.length === 1 ? '' : 's'}.`,
      })
      focusQueue()
    } catch {
      setMessage({ tone: 'error', text: 'The selected uploads could not be rejected.' })
    } finally {
      markSaving(ids, false)
    }
  }

  const handlePublish = async (album: Parameters<typeof api.publishToAlbum>[0]['album']) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    markSaving(ids, true)
    try {
      const { published } = await api.publishToAlbum({ ids, album, actor })
      setSelectedIds(new Set())
      setMessage({
        tone: 'success',
        text:
          published > 0
            ? `${published} photo${published === 1 ? '' : 's'} published to ${album}.`
            : 'No photos found to publish (uploads may have no photo URLs).',
      })
      focusQueue()
    } catch {
      setMessage({ tone: 'error', text: 'Those photos could not be published.' })
    } finally {
      markSaving(ids, false)
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedOnTab = activeUploads.filter(upload => selectedIds.has(upload.id)).length

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-display text-charcoal-900'>Guest Upload Moderation</h2>
        <p className='max-w-3xl text-sm leading-6 text-charcoal-500'>
          Review guest photo submissions. Approve unique photos into the gallery, reject duplicates
          or inappropriate content, and optionally let guests know why their upload was declined.
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <PhotoStatCard
          title='Pending review'
          value={queues.pending.length}
          icon={Eye}
          color='amber'
          alert={queues.pending.length > 0}
        />
        <PhotoStatCard
          title='Approved'
          value={queues.approved.length}
          icon={CheckCircle}
          color='green'
        />
        <PhotoStatCard
          title='Rejected'
          value={queues.rejected.length}
          icon={XCircle}
          color='blue'
        />
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

      {loading ? (
        <div className='rounded-xl border border-gold-100 bg-white p-8'>
          <ListSkeleton count={5} />
        </div>
      ) : (
        <div
          ref={queueRef}
          tabIndex={-1}
          aria-label='Upload moderation queue'
          className='space-y-4 outline-none'
          data-testid='upload-queue'
        >
          <div className='flex items-center gap-1 rounded-xl border border-gold-100 bg-white p-1'>
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                type='button'
                onClick={() => {
                  setActiveTab(tab.value)
                  setSelectedIds(new Set())
                }}
                aria-pressed={activeTab === tab.value}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-gold-500 text-white'
                    : 'text-charcoal-600 hover:bg-gold-100'
                }`}
              >
                {tab.label}
                <span className='ml-2 text-xs opacity-70'>({queues[tab.value].length})</span>
              </button>
            ))}
          </div>

          <BulkActionToolbar
            selectedCount={selectedCount}
            onApproveAll={activeTab === 'pending' ? () => void handleBulkApprove() : undefined}
            onRejectAll={
              activeTab !== 'approved'
                ? () => {
                    setBulkRejectReason('')
                    setShowBulkRejectDialog(true)
                  }
                : undefined
            }
            onPublishToGallery={activeTab === 'approved' ? handlePublish : undefined}
            onDeselectAll={() => setSelectedIds(new Set())}
            isLoading={isLoading}
          />

          {activeUploads.length > 0 ? (
            <div className='space-y-3'>
              {activeUploads.map(upload => (
                <UploadCard
                  key={upload.id}
                  upload={upload}
                  isSelected={selectedIds.has(upload.id)}
                  isSaving={savingIds.has(upload.id)}
                  onSelect={() => toggleSelected(upload.id)}
                  onApprove={() => void handleApprove(upload)}
                  onReject={reason => void handleReject(upload, reason)}
                />
              ))}
            </div>
          ) : (
            <div className='rounded-xl border border-dashed border-gold-200 bg-white'>
              <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
                <Inbox className='h-12 w-12 opacity-30' aria-hidden='true' />
                <p className='font-medium text-charcoal-700'>No {activeTab} uploads</p>
                <p className='text-sm'>
                  {activeTab === 'pending'
                    ? 'New guest uploads will appear here for moderation.'
                    : 'All guest uploads have been moderated.'}
                </p>
              </div>
            </div>
          )}

          {activeUploads.length > 0 && activeTab === 'pending' && (
            <div className='flex items-center gap-2 text-sm text-charcoal-600'>
              <input
                type='checkbox'
                checked={selectedOnTab === activeUploads.length && activeUploads.length > 0}
                onChange={event =>
                  setSelectedIds(
                    event.target.checked
                      ? new Set(activeUploads.map(upload => upload.id))
                      : new Set()
                  )
                }
                className='h-4 w-4 rounded border-gold-300 text-gold-500 focus:ring-gold-400'
                aria-label='Select all pending uploads'
              />
              <span>Select all {activeUploads.length} pending uploads</span>
            </div>
          )}
        </div>
      )}

      <AdminConfirmDialog
        isOpen={showBulkRejectDialog}
        onClose={() => setShowBulkRejectDialog(false)}
        onConfirm={() => void handleBulkReject()}
        title={`Reject ${selectedCount} Upload${selectedCount !== 1 ? 's' : ''}`}
        confirmLabel='Reject All'
        confirmVariant='danger'
      >
        <div className='space-y-4'>
          <p className='text-sm text-charcoal-600'>
            Are you sure? These {selectedCount} upload{selectedCount !== 1 ? 's' : ''} will be
            declined. Guests will see the rejection reason when they check status.
          </p>
          <div>
            <label
              htmlFor='bulk-reject-reason'
              className='mb-2 block text-sm font-medium text-charcoal-700'
            >
              Rejection reason (optional)
            </label>
            <Textarea
              id='bulk-reject-reason'
              value={bulkRejectReason}
              onChange={event => setBulkRejectReason(event.target.value)}
              placeholder='Optional: Let the guest know why...'
              rows={3}
            />
          </div>
        </div>
      </AdminConfirmDialog>
    </div>
  )
}
