import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/shared/ui'
import { lookupUploadStatus, validateUploadLookupEmail, type GuestUploadStatus } from './data'

export interface GalleryUploadLookupProps {
  /** Injectable for tests; defaults to the Wave-5 stub lookup. */
  lookupStatus?: (email: string) => Promise<GuestUploadStatus>
}

/**
 * Frozen `src/components/gallery/GalleryUploadLookup.tsx` port: the standalone
 * "Check Your Upload Status" form. Delta: explicit validation message + labelled
 * email input and a polite live region for the result (the oracle relied on a
 * toast + unlabelled placeholder).
 */
export function GalleryUploadLookup({
  lookupStatus = lookupUploadStatus,
}: GalleryUploadLookupProps) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<GuestUploadStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateUploadLookupEmail(email)
    setError(validationError)
    setResult(null)
    if (validationError) return

    setLoading(true)
    try {
      setResult(await lookupStatus(email.trim()))
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Unable to look up status.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='mb-6 rounded-[1.4rem] border border-gold-100 bg-white p-5 shadow-sm'>
      <h3 className='font-display text-lg text-charcoal-900 mb-3'>Check Your Upload Status</h3>
      <p className='text-sm text-charcoal-500 mb-4'>
        Enter the email address you used when uploading to see your status.
      </p>
      <form onSubmit={event => void handleSubmit(event)} className='flex gap-3 max-w-md' noValidate>
        <Input
          type='email'
          id='gallery-upload-lookup-email'
          aria-label='Email address used for your upload'
          placeholder='your@email.com'
          value={email}
          onChange={event => setEmail(event.target.value)}
          className='flex-1'
        />
        <Button type='submit' isLoading={loading}>
          Look up
        </Button>
      </form>
      {error && (
        <p role='alert' className='mt-3 text-sm text-rose-600'>
          {error}
        </p>
      )}
      <div role='status' aria-live='polite'>
        {result && (
          <div className='mt-4 rounded-xl border border-gold-200 bg-cream-50/70 p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='font-medium text-charcoal-900'>{result.guest_name}</p>
                <p className='text-sm text-charcoal-500'>{result.guest_email}</p>
              </div>
              <span
                className={
                  result.status === 'approved'
                    ? 'inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700'
                    : result.status === 'pending'
                      ? 'inline-flex rounded-full bg-gold-100 px-3 py-1 text-sm font-medium text-gold-700'
                      : 'inline-flex rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700'
                }
              >
                {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
              </span>
            </div>
            {result.status === 'rejected' && result.rejection_reason && (
              <div className='mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3'>
                <p className='text-xs font-medium text-rose-700'>Rejection reason:</p>
                <p className='mt-1 text-sm text-rose-600'>{result.rejection_reason}</p>
              </div>
            )}
            {result.photo_urls.length > 0 && (
              <div className='mt-3 flex gap-2'>
                {result.photo_urls.slice(0, 3).map((url, index) => (
                  <img
                    key={url}
                    src={url}
                    alt={`Upload ${index + 1}`}
                    className='h-12 w-12 rounded-lg object-cover'
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
