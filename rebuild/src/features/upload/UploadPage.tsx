import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { createDefaultUploadApi } from './data'
import { ShareSiteSection } from './ShareSiteSection'
import { UploadDropzone } from './UploadDropzone'
import { UploadHero } from './UploadHero'
import { UploadQueuePanel } from './UploadQueuePanel'
import { UploadSubmitColumn } from './UploadSubmitColumn'
import { UploadSuccessPanel } from './UploadSuccessPanel'
import { useGuestUploadSubmit } from './useGuestUploadSubmit'
import { useUploadQueue, type UploadQueueDependencies } from './useUploadQueue'
import type { UploadApi, UploadStorage } from './types'

const UPLOAD_DESCRIPTION =
  'Share the wedding site, upload your photos and videos, and help Austin and Jordyn keep the day alive from every angle.'

export interface UploadPageProps {
  /** Typed data boundary (Lead wires the Netlify function + shared/data). */
  api?: UploadApi
  /** localStorage seam (tests inject an in-memory queue). */
  storage?: UploadStorage
  /** Claims wizard seam (W5-2 gallery scope); the frozen page opened ClaimModal. */
  onClaim?: () => void
  /** Transport/preview/clock seams for deterministic tests. */
  compressImage?: (file: File) => Promise<File>
  putFile?: (file: File, onProgress: (progress: number) => void) => Promise<string>
  createPreview?: (file: File) => string | undefined
  fingerprintFile?: (file: File) => Promise<string>
  sleep?: (delayMs: number) => Promise<void>
  now?: () => number
  /** Share-section/success-panel seams. */
  clipboard?: { writeText: (value: string) => Promise<void> }
  schedule?: (callback: () => void, delayMs: number) => unknown
  siteShareUrl?: string
  shareOrigin?: string
}

/**
 * `/upload` page — parity port of the frozen `src/pages/Upload.tsx` (140 lines).
 *
 * Wave-6 scope: hero + claim entry point, dropzone (drag/drop + picker), queue
 * with compression → presign → XHR PUT progress → complete/error/retry, resume
 * from localStorage, submit gating + 3-attempt DB retry after R2 success, share
 * token success panel and the share-the-site section.
 */
export function UploadPage({
  api,
  storage,
  onClaim,
  compressImage,
  putFile,
  createPreview,
  fingerprintFile,
  sleep,
  now,
  clipboard,
  schedule,
  siteShareUrl,
  shareOrigin,
}: UploadPageProps) {
  const client = api ?? createDefaultUploadApi()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submittedSummary, setSubmittedSummary] = useState<{
    photoCount: number
    videoCount: number
  } | null>(null)

  const queueDependencies: UploadQueueDependencies = {
    api: client,
    ...(storage ? { storage } : {}),
    ...(compressImage ? { compressImage } : {}),
    ...(putFile ? { putFile } : {}),
    ...(createPreview ? { createPreview } : {}),
    ...(now ? { now } : {}),
  }
  const queue = useUploadQueue(queueDependencies)

  const submit = useGuestUploadSubmit({
    api: client,
    files: queue.files,
    name,
    email,
    message,
    onSuccess: () => {
      // Keep the counts on screen for the success panel; only drop resume data.
      queue.clearPersistedQueue()
      setSubmittedSummary({
        photoCount: queue.completedPhotoCount,
        videoCount: queue.completedVideoCount,
      })
    },
    ...(sleep ? { sleep } : {}),
    ...(fingerprintFile ? { fingerprintFile } : {}),
  })

  usePageMeta({
    title: 'Share Memories',
    description: UPLOAD_DESCRIPTION,
    canonical: '/upload',
  })

  const handleSubmit = useCallback(
    (event: { preventDefault: () => void }) => {
      void submit.handleSubmit(event)
    },
    [submit]
  )

  if (submit.isSubmitted && submittedSummary) {
    return (
      <UploadSuccessPanel
        completedPhotoCount={submittedSummary.photoCount}
        completedVideoCount={submittedSummary.videoCount}
        email={email}
        shareToken={submit.shareToken}
        {...(clipboard ? { clipboard } : {})}
        {...(schedule ? { schedule } : {})}
        {...(shareOrigin ? { origin: shareOrigin } : {})}
      />
    )
  }

  return (
    <div className='min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden' aria-hidden='true'>
        <div className='absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]' />
        <div className='absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]' />
      </div>

      <div className='mx-auto max-w-6xl px-4'>
        <UploadHero
          selectedPhotoCount={queue.selectedPhotoCount}
          selectedVideoCount={queue.selectedVideoCount}
          {...(onClaim ? { onClaim } : {})}
        />

        <form
          onSubmit={event => handleSubmit(event)}
          className='mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]'
          noValidate
        >
          <div className='grid gap-6'>
            <UploadDropzone
              isDragging={queue.isDragging}
              onDragOver={queue.handleDragOver}
              onDragLeave={queue.handleDragLeave}
              onDrop={queue.handleDrop}
              onFileSelect={queue.handleFileSelect}
            />

            {queue.queueNotice && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className='rounded-2xl border border-amber-400/25 bg-amber-500/8 px-5 py-4'
              >
                <p
                  role='status'
                  aria-live='polite'
                  className='flex items-start gap-2 text-sm leading-6 text-amber-300'
                >
                  <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                  {queue.queueNotice}
                </p>
              </motion.div>
            )}

            {(queue.files.length > 0 || queue.storedUploads.length > 0) && (
              <UploadQueuePanel
                files={queue.files}
                storedUploads={queue.storedUploads}
                completedFiles={queue.completedFiles}
                completedPhotoCount={queue.completedPhotoCount}
                completedVideoCount={queue.completedVideoCount}
                uploadingCount={queue.uploadingCount}
                hasErrors={queue.hasErrors}
                aggregateProgress={queue.aggregateProgress}
                isUploadingAny={queue.isUploadingAny}
                retryUpload={queue.retryUpload}
                removeFile={queue.removeFile}
              />
            )}
          </div>

          <div className='grid gap-6 xl:sticky xl:top-28 xl:self-start'>
            <UploadSubmitColumn
              name={name}
              email={email}
              message={message}
              filesCount={queue.files.length}
              completedFiles={queue.completedFiles}
              completedPhotoCount={queue.completedPhotoCount}
              completedVideoCount={queue.completedVideoCount}
              isSubmitting={submit.isSubmitting}
              submitError={submit.submitError}
              onNameChange={setName}
              onEmailChange={setEmail}
              onMessageChange={setMessage}
            />
          </div>
        </form>

        <ShareSiteSection
          share={{
            ...(siteShareUrl ? { siteUrl: siteShareUrl } : {}),
            ...(clipboard ? { clipboard } : {}),
            ...(schedule ? { schedule } : {}),
          }}
        />
      </div>
    </div>
  )
}

export default UploadPage
