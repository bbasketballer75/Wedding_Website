/**
 * GalleryUploadLookup — extracted from src/pages/Gallery.tsx.
 *
 * Self-contained "Check Your Upload Status" panel: own form state, own
 * lookup logic. No props from the page (decoupled by design).
 */
import { useState, type FormEvent } from 'react'
import { fetchGuestUploadStatus } from '@/lib/supabase'
import type { GuestUpload } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'

export function GalleryUploadLookup() {
  const { addToast } = useToast()
  const [uploadStatusEmail, setUploadStatusEmail] = useState('')
  const [uploadStatusResult, setUploadStatusResult] = useState<GuestUpload | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const handleLookupUploadStatus = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = uploadStatusEmail.trim()
    if (!trimmed) return

    setLookupLoading(true)
    setLookupError(null)
    setUploadStatusResult(null)
    try {
      const result = await fetchGuestUploadStatus(trimmed)
      setUploadStatusResult(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to look up status.'
      setLookupError(message)
      addToast(message, 'error')
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <div className='mb-6 rounded-[1.4rem] border border-gold-100 bg-white p-5 shadow-sm'>
      <h3 className='font-display text-lg text-charcoal-900 mb-3'>Check Your Upload Status</h3>
      <p className='text-sm text-charcoal-500 mb-4'>
        Enter the email address you used when uploading to see your status.
      </p>
      <form onSubmit={handleLookupUploadStatus} className='flex gap-3 max-w-md'>
        <Input
          type='email'
          placeholder='your@email.com'
          value={uploadStatusEmail}
          onChange={e => setUploadStatusEmail(e.target.value)}
          className='flex-1'
        />
        <Button type='submit' isLoading={lookupLoading}>
          Look up
        </Button>
      </form>
      {lookupError && <p className='mt-3 text-sm text-rose-600'>{lookupError}</p>}
      {uploadStatusResult && (
        <div className='mt-4 rounded-xl border border-gold-200 bg-cream-50/70 p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium text-charcoal-900'>{uploadStatusResult.guest_name}</p>
              <p className='text-sm text-charcoal-500'>{uploadStatusResult.guest_email}</p>
            </div>
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-sm font-medium',
                uploadStatusResult.status === 'approved' && 'bg-green-100 text-green-700',
                uploadStatusResult.status === 'pending' && 'bg-gold-100 text-gold-700',
                uploadStatusResult.status === 'rejected' && 'bg-rose-100 text-rose-700'
              )}
            >
              {uploadStatusResult.status.charAt(0).toUpperCase() +
                uploadStatusResult.status.slice(1)}
            </span>
          </div>
          {uploadStatusResult.status === 'rejected' && uploadStatusResult.rejection_reason && (
            <div className='mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3'>
              <p className='text-xs font-medium text-rose-700'>Rejection reason:</p>
              <p className='mt-1 text-sm text-rose-600'>{uploadStatusResult.rejection_reason}</p>
            </div>
          )}
          {uploadStatusResult.photo_urls.length > 0 && (
            <div className='mt-3 flex gap-2'>
              {uploadStatusResult.photo_urls.slice(0, 3).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Upload ${idx + 1}`}
                  className='h-12 w-12 rounded-lg object-cover'
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
