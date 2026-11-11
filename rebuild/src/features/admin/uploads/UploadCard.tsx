/**
 * One guest-upload moderation card, ported from the frozen
 * `src/components/admin/UploadCard.tsx` (markup/classes/copy).
 */
import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'
import { cn } from '@/shared/lib/cn'
import type { AdminUpload } from '../data'
import { AdminConfirmDialog } from '../shared/AdminConfirmDialog'
import { formatUploadDate } from '../utils'

export interface UploadCardProps {
  upload: AdminUpload
  isSelected: boolean
  isSaving: boolean
  onSelect: () => void
  onApprove: () => void
  onReject: (reason?: string) => void
}

export function UploadCard({
  upload,
  isSelected,
  isSaving,
  onSelect,
  onApprove,
  onReject,
}: UploadCardProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleReject = () => {
    onReject(rejectReason.trim() || undefined)
    setShowRejectDialog(false)
    setRejectReason('')
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 transition-all',
        isSelected ? 'border-gold-400 ring-2 ring-gold-400/20' : 'border-gold-100'
      )}
    >
      <div className='flex items-start gap-3'>
        <input
          type='checkbox'
          checked={isSelected}
          onChange={onSelect}
          className='mt-1 h-4 w-4 rounded border-gold-300 text-gold-500 focus:ring-gold-400'
          aria-label={`Select upload from ${upload.guest_name}`}
        />

        <div className='flex-1 min-w-0'>
          {upload.photoUrls.length > 0 && (
            <div
              className='grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3'
              data-testid='photo-preview-grid'
            >
              {upload.photoUrls.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Upload ${index + 1}`}
                  className='aspect-square rounded-lg object-cover w-full border border-gold-100 bg-gold-50/10'
                />
              ))}
            </div>
          )}

          <p className='font-medium text-charcoal-900'>{upload.guest_name}</p>
          <p className='text-sm text-charcoal-500'>{upload.guest_email}</p>
          {upload.message && <p className='mt-2 text-sm text-charcoal-600'>{upload.message}</p>}
          <p className='mt-2 text-xs text-charcoal-400'>
            Uploaded {formatUploadDate(upload.created_at)}
          </p>

          {upload.status === 'rejected' && upload.rejection_reason && (
            <div className='mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3'>
              <p className='text-xs font-medium text-rose-700'>Rejection reason:</p>
              <p className='mt-1 text-sm text-rose-600'>{upload.rejection_reason}</p>
            </div>
          )}
        </div>

        {upload.status === 'pending' && (
          <div className='flex flex-col gap-2'>
            <Button
              size='sm'
              onClick={onApprove}
              disabled={isSaving}
              variant='primary'
              className='bg-gold-500 hover:bg-gold-600 min-w-[80px]'
              ariaLabel={`Approve upload from ${upload.guest_name}`}
            >
              <CheckCircle2 className='mr-1.5 h-4 w-4' aria-hidden='true' />
              Approve
            </Button>
            <Button
              size='sm'
              onClick={() => {
                setRejectReason('')
                setShowRejectDialog(true)
              }}
              disabled={isSaving}
              variant='danger'
              className='bg-rose-500 hover:bg-rose-600 min-w-[80px]'
              ariaLabel={`Reject upload from ${upload.guest_name}`}
            >
              <XCircle className='mr-1.5 h-4 w-4' aria-hidden='true' />
              Reject
            </Button>
          </div>
        )}
      </div>

      <AdminConfirmDialog
        isOpen={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        title='Reject Upload'
        confirmLabel='Reject'
        confirmVariant='danger'
      >
        <div className='space-y-4'>
          <p className='text-sm text-charcoal-600'>
            Are you sure? This will decline the upload from {upload.guest_name}. Guests will see the
            rejection reason when they check status.
          </p>
          <div>
            <label
              htmlFor={`reject-reason-${upload.id}`}
              className='mb-2 block text-sm font-medium text-charcoal-700'
            >
              Rejection reason (optional)
            </label>
            <Textarea
              id={`reject-reason-${upload.id}`}
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
              placeholder='Optional: Let the guest know why...'
              rows={3}
            />
          </div>
        </div>
      </AdminConfirmDialog>
    </div>
  )
}
