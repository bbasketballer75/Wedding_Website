import { useState } from 'react'
import { motion } from 'framer-motion'
import { UploadSEO } from '@/components/seo/SEOHead'
import { AlertCircle } from 'lucide-react'
import { ClaimModal } from '@/components/gallery/ClaimModal'
import { useUploadQueue } from './upload/useUploadQueue'
import { useGuestUploadSubmit } from './upload/useGuestUploadSubmit'
import { UploadSuccessPanel } from './upload/UploadSuccessPanel'
import { UploadHero } from './upload/UploadHero'
import { UploadDropzone } from './upload/UploadDropzone'
import { UploadQueuePanel } from './upload/UploadQueuePanel'
import { UploadSubmitColumn } from './upload/UploadSubmitColumn'
import { ShareSiteSection } from './upload/ShareSiteSection'

export default function UploadPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const {
    files,
    storedUploads,
    queueNotice,
    isDragging,
    removeFile,
    retryUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    clearQueueNotice,
    completedFiles,
    hasErrors,
    uploadingCount,
    completedPhotoCount,
    completedVideoCount,
    selectedPhotoCount,
    selectedVideoCount,
    aggregateProgress,
    isUploadingAny,
  } = useUploadQueue()

  const { isSubmitted, isSubmitting, submitError, shareToken, handleSubmit } = useGuestUploadSubmit(
    files,
    name,
    email,
    message,
    clearQueueNotice
  )

  if (isSubmitted) {
    return (
      <UploadSuccessPanel
        completedPhotoCount={completedPhotoCount}
        completedVideoCount={completedVideoCount}
        email={email}
        shareToken={shareToken}
      />
    )
  }

  return (
    <div className='min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden' aria-hidden='true'>
        <div className='absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]' />
        <div className='absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]' />
      </div>
      <UploadSEO />

      <div className='mx-auto max-w-6xl px-4'>
        <UploadHero
          selectedPhotoCount={selectedPhotoCount}
          selectedVideoCount={selectedVideoCount}
        />

        <form
          onSubmit={handleSubmit}
          className='mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]'
        >
          <div className='grid gap-6'>
            <UploadDropzone
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
            />

            {queueNotice && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className='rounded-2xl border border-amber-400/25 bg-amber-500/8 px-5 py-4'
              >
                <p className='flex items-start gap-2 text-sm leading-6 text-amber-300'>
                  <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
                  {queueNotice}
                </p>
              </motion.div>
            )}

            {(files.length > 0 || storedUploads.length > 0) && (
              <UploadQueuePanel
                files={files}
                storedUploads={storedUploads}
                completedFiles={completedFiles}
                completedPhotoCount={completedPhotoCount}
                completedVideoCount={completedVideoCount}
                uploadingCount={uploadingCount}
                hasErrors={hasErrors}
                aggregateProgress={aggregateProgress}
                isUploadingAny={isUploadingAny}
                retryUpload={retryUpload}
                removeFile={removeFile}
              />
            )}
          </div>

          <div className='grid gap-6 xl:sticky xl:top-28 xl:self-start'>
            <UploadSubmitColumn
              name={name}
              email={email}
              message={message}
              filesCount={files.length}
              completedFiles={completedFiles}
              completedPhotoCount={completedPhotoCount}
              completedVideoCount={completedVideoCount}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onNameChange={setName}
              onEmailChange={setEmail}
              onMessageChange={setMessage}
            />
          </div>
        </form>

        <ShareSiteSection />
      </div>
      <ClaimModal />
    </div>
  )
}
