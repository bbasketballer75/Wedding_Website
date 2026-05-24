import { useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { ModerationConfirmDialog } from './ModerationConfirmDialog'
import { BulkActionToolbar } from './BulkActionToolbar'
import { UploadCard } from './UploadCard'
import { useModerationStore } from '@/stores/moderationStore'
import { useToast } from '@/context/ToastContext'
import type { PhotoAlbum } from '@/lib/supabase'

type UploadStatus = 'pending' | 'approved' | 'rejected'

const STATUS_TABS: { value: UploadStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export function GuestUploadModerationList() {
  const {
    uploads,
    selectedUploadIds,
    loading,
    savingIds,
    activeFilter,
    loadUploads,
    selectUpload,
    deselectUpload,
    selectAll,
    deselectAll,
    approveUpload,
    rejectUpload,
    bulkApprove,
    bulkReject,
    bulkPublishToGallery,
    setActiveFilter,
  } = useModerationStore()

  const { addToast } = useToast()
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false)
  const [bulkRejectReason, setBulkRejectReason] = useState('')

  const handlePublishToGallery = async (album: PhotoAlbum) => {
    const count = await bulkPublishToGallery(album)
    if (count > 0) {
      addToast(`${count} photo${count === 1 ? '' : 's'} published to ${album}.`, 'success')
    } else {
      addToast('No photos found to publish (uploads may have no photo URLs).', 'info')
    }
  }

  // Load uploads on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUploads()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadUploads])

  const selectedCount = selectedUploadIds.size
  const isLoading = savingIds.size > 0

  const handleBulkReject = () => {
    void bulkReject(bulkRejectReason.trim() || undefined)
    setShowBulkRejectDialog(false)
    setBulkRejectReason('')
  }

  if (loading) {
    return (
      <div className='rounded-xl border border-gold-100 bg-white p-8'>
        <ListSkeleton count={5} />
      </div>
    )
  }

  return (
    <div className='space-y-4' data-testid='upload-queue'>
      {/* Filter tabs */}
      <div className='flex items-center gap-1 rounded-xl border border-gold-100 bg-white p-1'>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeFilter === tab.value
                ? 'bg-gold-500 text-white'
                : 'text-charcoal-600 hover:bg-gold-100'
            }`}
          >
            {tab.label}
            <span className='ml-2 text-xs opacity-70'>
              ({uploads.filter(u => u.status === tab.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* Bulk action toolbar — approve/reject for pending, publish for approved */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        onApproveAll={activeFilter === 'pending' ? () => void bulkApprove() : undefined}
        onRejectAll={
          activeFilter !== 'approved'
            ? () => {
                setBulkRejectReason('')
                setShowBulkRejectDialog(true)
              }
            : undefined
        }
        onPublishToGallery={activeFilter === 'approved' ? handlePublishToGallery : undefined}
        onDeselectAll={deselectAll}
        isLoading={isLoading}
      />

      {/* Upload list */}
      {uploads.length > 0 ? (
        <div className='space-y-3'>
          {uploads.map(upload => (
            <UploadCard
              key={upload.id}
              upload={upload}
              isSelected={selectedUploadIds.has(upload.id)}
              isSaving={savingIds.has(upload.id)}
              onSelect={() =>
                selectedUploadIds.has(upload.id)
                  ? deselectUpload(upload.id)
                  : selectUpload(upload.id)
              }
              onApprove={() => void approveUpload(upload.id)}
              onReject={reason => void rejectUpload(upload.id, reason)}
            />
          ))}
        </div>
      ) : (
        <div className='rounded-xl border border-dashed border-gold-200 bg-white'>
          <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
            <Inbox className='h-12 w-12 opacity-30' />
            <p className='font-medium text-charcoal-700'>No {activeFilter} uploads</p>
            <p className='text-sm'>
              {activeFilter === 'pending'
                ? 'New guest uploads will appear here for moderation.'
                : `All guest uploads have been moderated.`}
            </p>
          </div>
        </div>
      )}

      {/* Select all checkbox (when items exist) */}
      {uploads.length > 0 && activeFilter === 'pending' && (
        <div className='flex items-center gap-2 text-sm text-charcoal-600'>
          <input
            type='checkbox'
            checked={selectedCount === uploads.length && uploads.length > 0}
            onChange={e => (e.target.checked ? selectAll() : deselectAll())}
            className='h-4 w-4 rounded border-gold-300 text-gold-500 focus:ring-gold-400'
            aria-label='Select all pending uploads'
          />
          <span>Select all {uploads.length} pending uploads</span>
        </div>
      )}

      {/* Bulk reject confirmation dialog */}
      <ModerationConfirmDialog
        isOpen={showBulkRejectDialog}
        onClose={() => setShowBulkRejectDialog(false)}
        onConfirm={handleBulkReject}
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
              onChange={e => setBulkRejectReason(e.target.value)}
              placeholder='Optional: Let the guest know why...'
              rows={3}
            />
          </div>
        </div>
      </ModerationConfirmDialog>
    </div>
  )
}
