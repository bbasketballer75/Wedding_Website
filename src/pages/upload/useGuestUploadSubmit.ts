import { useCallback, useEffect, useState } from 'react'
import { supabase, getOrCreateShareToken } from '@/lib/supabase'
import { withRetry, isTransientError } from '@/utils/retry'
import { buildFileFingerprint } from './uploadQueueStorage'
import { clearUploadQueue } from './uploadQueueStorage'
import type { UploadingFile } from './types'

export interface UseGuestUploadSubmitResult {
  isSubmitted: boolean
  isSubmitting: boolean
  submitError: string | null
  shareToken: string | null
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

export function useGuestUploadSubmit(
  files: UploadingFile[],
  name: string,
  email: string,
  message: string,
  onSuccess: () => void
): UseGuestUploadSubmitResult {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)

  // Clear localStorage on successful submission
  useEffect(() => {
    if (isSubmitted) {
      clearUploadQueue()
    }
  }, [isSubmitted])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (files.length === 0 || !name || !email) {
        return
      }

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const completedPhotoFiles = files.filter(
          file =>
            file.status === 'complete' && !file.file.type.startsWith('video/') && file.publicUrl
        )
        const completedVideoFiles = files.filter(
          file =>
            file.status === 'complete' && file.file.type.startsWith('video/') && file.publicUrl
        )

        const [photoFingerprints, videoFingerprints] = await Promise.all([
          Promise.all(completedPhotoFiles.map(file => buildFileFingerprint(file.file))),
          Promise.all(completedVideoFiles.map(file => buildFileFingerprint(file.file))),
        ])

        const photoUrls = completedPhotoFiles.map(f => f.publicUrl).filter(Boolean) as string[]

        const videoUrls = completedVideoFiles.map(f => f.publicUrl).filter(Boolean) as string[]

        // Insert with retry — the R2 files are already uploaded, so a transient
        // network failure here would otherwise orphan the upload. Retry covers
        // 3 attempts with exponential backoff for transient errors only; permanent
        // failures (validation, RLS, etc.) surface immediately.
        const { error } = await withRetry(
          () =>
            supabase.from('guest_uploads').insert([
              {
                guest_name: name,
                guest_email: email,
                message: message || null,
                photo_urls: photoUrls,
                photo_fingerprints: photoFingerprints,
                video_urls: videoUrls,
                video_fingerprints: videoFingerprints,
                status: 'pending',
              },
            ]),
          {
            attempts: 3,
            baseDelayMs: 500,
            onRetry: (attempt, _err, delayMs) => {
              setSubmitError(
                `Connection blip — retrying (attempt ${attempt + 1} in ${Math.round(delayMs / 100) / 10}s)…`
              )
            },
          }
        )

        if (error) {
          throw error
        }

        // Generate or retrieve the persistent unique share token
        try {
          const token = await getOrCreateShareToken(email)
          setShareToken(token)
        } catch (tokenErr) {
          console.error('Failed to generate sharing token:', tokenErr)
        }

        setIsSubmitted(true)
        onSuccess()
      } catch (err) {
        console.error('Guest upload submit failed:', err)
        const transient = isTransientError(err)
        setSubmitError(
          transient
            ? "We couldn't reach the archive just now — your files uploaded fine, just hit submit again."
            : "Something didn't quite work — give it another go, or reach out if it keeps happening."
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [files, name, email, message, onSuccess]
  )

  return {
    isSubmitted,
    isSubmitting,
    submitError,
    shareToken,
    handleSubmit,
  }
}
