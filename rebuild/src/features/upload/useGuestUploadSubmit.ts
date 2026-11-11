import { useCallback, useState } from 'react'
import { withRetry, isTransientError } from './retry'
import { buildFileFingerprint } from './uploadQueueStorage'
import type { UploadApi, UploadingFile } from './types'

/**
 * Submit phase (frozen `src/pages/upload/useGuestUploadSubmit.ts`).
 *
 * The files are ALREADY in R2 by the time this runs, so the DB insert must not
 * silently fail: transient errors get 3 attempts (exponential backoff) with a
 * visible retry notice, and the share token is fetched after the row lands.
 * A token failure never loses the uploaded submission.
 */
export interface UseGuestUploadSubmitOptions {
  api: UploadApi
  files: UploadingFile[]
  name: string
  email: string
  message: string
  /** Called after a successful submit (page clears the persisted queue). */
  onSuccess?: () => void
  /** Injectable for deterministic tests (immediate sleep + fixed fingerprints). */
  sleep?: (delayMs: number) => Promise<void>
  fingerprintFile?: (file: File) => Promise<string>
}

export interface UseGuestUploadSubmitResult {
  isSubmitted: boolean
  isSubmitting: boolean
  submitError: string | null
  shareToken: string | null
  handleSubmit: (event: { preventDefault: () => void }) => Promise<void>
}

const TRANSIENT_SUBMIT_ERROR =
  "We couldn't reach the archive just now — your files uploaded fine, just hit submit again."
const PERMANENT_SUBMIT_ERROR =
  "Something didn't quite work — give it another go, or reach out if it keeps happening."

export function useGuestUploadSubmit({
  api,
  files,
  name,
  email,
  message,
  onSuccess,
  sleep,
  fingerprintFile = buildFileFingerprint,
}: UseGuestUploadSubmitOptions): UseGuestUploadSubmitResult {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault()

      // Submit is blocked until at least one file is uploaded and both contact
      // fields are filled (frozen gating).
      const completedFiles = files.filter(file => file.status === 'complete' && file.publicUrl)
      if (completedFiles.length === 0 || !name.trim() || !email.trim()) return

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const completedPhotoFiles = completedFiles.filter(
          file => !file.file.type.startsWith('video/')
        )
        const completedVideoFiles = completedFiles.filter(file =>
          file.file.type.startsWith('video/')
        )
        const [photoFingerprints, videoFingerprints] = await Promise.all([
          Promise.all(completedPhotoFiles.map(file => fingerprintFile(file.file))),
          Promise.all(completedVideoFiles.map(file => fingerprintFile(file.file))),
        ])

        const insertedUpload = await withRetry(
          () =>
            api.insertGuestUpload({
              guestName: name.trim(),
              guestEmail: email.trim(),
              message: message.trim() ? message.trim() : null,
              photoUrls: completedPhotoFiles
                .map(file => file.publicUrl)
                .filter((url): url is string => Boolean(url)),
              photoFingerprints,
              videoUrls: completedVideoFiles
                .map(file => file.publicUrl)
                .filter((url): url is string => Boolean(url)),
              videoFingerprints,
            }),
          {
            attempts: 3,
            baseDelayMs: 500,
            ...(sleep ? { sleep } : {}),
            onRetry: (attempt, _error, delayMs) => {
              setSubmitError(
                `Connection blip — retrying (attempt ${attempt + 1} in ${Math.round(delayMs / 100) / 10}s)…`
              )
            },
          }
        )

        // The row is saved: fetch/derive the persistent guest share token. A
        // token failure must not lose the submission (frozen behavior).
        try {
          setShareToken(await api.getOrCreateShareToken(email.trim(), insertedUpload.id))
        } catch {
          setShareToken(null)
        }

        setSubmitError(null)
        setIsSubmitted(true)
        onSuccess?.()
      } catch (error) {
        setSubmitError(isTransientError(error) ? TRANSIENT_SUBMIT_ERROR : PERMANENT_SUBMIT_ERROR)
      } finally {
        setIsSubmitting(false)
      }
    },
    [api, email, files, fingerprintFile, message, name, onSuccess, sleep]
  )

  return { isSubmitted, isSubmitting, submitError, shareToken, handleSubmit }
}
