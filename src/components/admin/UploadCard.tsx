import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { ModerationConfirmDialog } from './ModerationConfirmDialog'
import { cn } from '@/lib/utils'
import type { GuestUpload } from '@/lib/supabase'

interface UploadCardProps {
  upload: GuestUpload
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

  const handleRejectClick = () => {
    setRejectReason('')
    setShowRejectDialog(true)
  }

  return (
    <div className={cn(
      'rounded-xl border bg-white p-4 transition-all',
      isSelected ? 'border-gold-400 ring-2 ring-gold-400/20' : 'border-gold-100'
    )}>
      <div className="flex items-start gap-3">
        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 h-4 w-4 rounded border-gold-300 text-gold-500 focus:ring-gold-400"
        />

        {/* Upload content */}
        <div className="flex-1 min-w-0">
          {/* Photos preview */}
          {upload.photo_urls.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {upload.photo_urls.slice(0, 4).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Upload ${idx + 1}`}
                  className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                />
              ))}
              {upload.photo_urls.length > 4 && (
                <div className="h-16 w-16 rounded-lg bg-gold-100 flex items-center justify-center text-sm text-gold-700">
                  +{upload.photo_urls.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Guest info */}
          <p className="font-medium text-charcoal-900">{upload.guest_name}</p>
          <p className="text-sm text-charcoal-500">{upload.guest_email}</p>
          {upload.message && (
            <p className="mt-2 text-sm text-charcoal-600">{upload.message}</p>
          )}
          <p className="mt-2 text-xs text-charcoal-400">
            Uploaded {new Date(upload.created_at).toLocaleDateString()}
          </p>

          {/* Show rejection reason if rejected */}
          {upload.status === 'rejected' && upload.rejection_reason && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3">
              <p className="text-xs font-medium text-rose-700">Rejection reason:</p>
              <p className="mt-1 text-sm text-rose-600">{upload.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Action buttons - visible for pending uploads */}
        {upload.status === 'pending' && (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isSaving}
              variant="primary"
              className="bg-gold-500 hover:bg-gold-600 min-w-[80px]"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              onClick={handleRejectClick}
              disabled={isSaving}
              variant="danger"
              className="bg-rose-500 hover:bg-rose-600 min-w-[80px]"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Reject confirmation dialog */}
      <ModerationConfirmDialog
        isOpen={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        title="Reject Upload"
        confirmLabel="Reject"
        confirmVariant="danger"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-600">
            Are you sure? This will decline the upload from {upload.guest_name}. Guests will see the rejection reason when they check status.
          </p>
          <div>
            <label className="mb-2 block text-sm font-medium text-charcoal-700">
              Rejection reason (optional)
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional: Let the guest know why..."
              rows={3}
            />
          </div>
        </div>
      </ModerationConfirmDialog>
    </div>
  )
}