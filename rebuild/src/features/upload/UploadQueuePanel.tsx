import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  RefreshCw,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { describeUploadSummary } from './uploadText'
import type { StoredUploadMetadata, UploadingFile } from './types'

export interface UploadQueuePanelProps {
  files: UploadingFile[]
  storedUploads: StoredUploadMetadata[]
  completedFiles: number
  completedPhotoCount: number
  completedVideoCount: number
  uploadingCount: number
  hasErrors: boolean
  aggregateProgress: number
  isUploadingAny: boolean
  retryUpload: (fileId: string) => void
  removeFile: (id: string) => void
}

/** Frozen `UploadQueuePanel` (`src/pages/upload/UploadQueuePanel.tsx`) port. */
export function UploadQueuePanel({
  files,
  storedUploads,
  completedFiles,
  completedPhotoCount,
  completedVideoCount,
  uploadingCount,
  hasErrors,
  aggregateProgress,
  isUploadingAny,
  retryUpload,
  removeFile,
}: UploadQueuePanelProps) {
  const currentFingerprints = new Set(
    files.map(file => `${file.file.name}:${file.file.size}:${file.file.lastModified}`)
  )
  const resumableUploads = storedUploads.filter(
    upload => !currentFingerprints.has(`${upload.name}:${upload.size}:${upload.createdAt}`)
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid='upload-queue-panel'
      className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-6 sm:px-8'
    >
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
            <Upload className='h-3.5 w-3.5' aria-hidden='true' />
            Upload queue
          </span>
          <h3 className='mt-5 text-3xl text-white sm:text-4xl'>
            {completedFiles} of {files.length} files ready to send
          </h3>
          <p className='mt-3 max-w-2xl text-sm text-white/55 sm:text-base'>
            Take a look before sending. Remove anything you don't want, retry anything that didn't
            upload, and send when you're happy with what's ready.
          </p>

          {isUploadingAny && (
            <div className='mt-6 space-y-2 text-left' data-testid='multi-file-progress-bar'>
              <div className='flex items-center justify-between text-xs text-white/50'>
                <span className='text-gold-300 font-semibold'>Overall Upload Progress</span>
                <span className='text-gold-300 font-semibold'>{aggregateProgress}%</span>
              </div>
              <div className='h-2.5 overflow-hidden rounded-full bg-white/10 border border-white/5'>
                <div
                  className='h-full rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-300 transition-all duration-300'
                  style={{ width: `${aggregateProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className='flex flex-wrap items-center gap-3 text-sm text-white/50'>
          <span className='rounded-full border border-white/12 bg-white/6 px-4 py-2'>
            {describeUploadSummary(completedPhotoCount, completedVideoCount)}
          </span>
          {uploadingCount > 0 && (
            <span className='rounded-full border border-gold-400/25 bg-gold-500/8 px-4 py-2 text-gold-300'>
              {uploadingCount} still uploading
            </span>
          )}
          {hasErrors && (
            <span className='rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-rose-300'>
              These didn't upload — retry or remove them before sending
            </span>
          )}
        </div>
      </div>

      <div className='mt-6 space-y-3'>
        <AnimatePresence initial={false}>
          {resumableUploads.map((upload, index) => (
            <motion.div
              key={`stored-${upload.id}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
            >
              <div className='flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center bg-white/5 border border-l-2 border-l-gold-400 border-white/8 rounded-xl'>
                <div className='flex items-center gap-4'>
                  {upload.preview ? (
                    <img
                      src={upload.preview}
                      alt=''
                      className='h-16 w-16 rounded-2xl object-cover'
                    />
                  ) : (
                    <div className='flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/20 bg-gold-500/10 text-gold-400'>
                      {upload.type.startsWith('video/') ? (
                        <Video className='h-6 w-6' aria-hidden='true' />
                      ) : (
                        <ImageIcon className='h-6 w-6' aria-hidden='true' />
                      )}
                    </div>
                  )}
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-white'>{upload.name}</p>
                    <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50'>
                      <span>{(upload.size / 1024 / 1024).toFixed(1)} MB</span>
                      <span className='h-1 w-1 rounded-full bg-gold-300' />
                      <span>{upload.type.startsWith('video/') ? 'Video' : 'Photo'}</span>
                    </div>
                  </div>
                </div>

                <div className='flex-1'>
                  <div className='mb-2 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-gold-300'>
                    <RefreshCw className='h-3.5 w-3.5' aria-hidden='true' />
                    Pending resume
                  </div>
                  <p className='text-xs text-white/50'>
                    This upload was interrupted. Select the same file to resume.
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
          {files.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{
                duration: 0.28,
                delay: (resumableUploads.length + index) * 0.04,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <div
                className={cn(
                  'flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center bg-white/5 border border-white/8 rounded-xl',
                  file.status === 'error' && 'border-rose-400/20 bg-rose-500/10'
                )}
              >
                <div className='flex items-center gap-4'>
                  {file.preview ? (
                    <img src={file.preview} alt='' className='h-16 w-16 rounded-2xl object-cover' />
                  ) : (
                    <div className='flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/20 bg-gold-500/10 text-gold-400'>
                      <Video className='h-6 w-6' aria-hidden='true' />
                    </div>
                  )}
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-white'>{file.file.name}</p>
                    <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50'>
                      <span>{(file.file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <span className='h-1 w-1 rounded-full bg-gold-300' />
                      <span>{file.file.type.startsWith('video/') ? 'Video' : 'Photo'}</span>
                    </div>
                  </div>
                </div>

                <div className='flex-1'>
                  {file.status === 'uploading' && (
                    <div>
                      <div className='mb-2 flex items-center justify-between text-xs text-white/50'>
                        <span>
                          {file.progress !== undefined
                            ? `${file.progress}% uploaded`
                            : 'Uploading for us…'}
                        </span>
                        <span>{file.progress === 100 ? 'Processing…' : 'Sending'}</span>
                      </div>
                      <div className='h-2 overflow-hidden rounded-full bg-white/10'>
                        <div
                          className='h-full rounded-full bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300 transition-all duration-300'
                          style={{ width: `${file.progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {file.status === 'complete' && (
                    <div className='inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300'>
                      <CheckCircle className='h-3.5 w-3.5' aria-hidden='true' />
                      Uploaded and ready
                    </div>
                  )}

                  {file.status === 'error' && (
                    <div className='space-y-2'>
                      <div className='inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300'>
                        <AlertCircle className='h-3.5 w-3.5' aria-hidden='true' />
                        Needs retry
                      </div>
                      <p role='alert' className='text-xs leading-5 text-rose-300'>
                        {file.errorMessage || "This one didn't upload — try again or skip it"}
                      </p>
                      <button
                        type='button'
                        onClick={() => retryUpload(file.id)}
                        className='cursor-pointer text-xs font-medium uppercase tracking-[0.22em] text-gold-300 transition-colors hover:text-gold-400'
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>

                {file.status !== 'complete' && (
                  <button
                    type='button'
                    onClick={() => removeFile(file.id)}
                    className='cursor-pointer self-start rounded-full border border-white/15 bg-white/8 p-2 text-white/60 transition-colors hover:bg-white/14 hover:text-white sm:self-center'
                    aria-label={`Remove ${file.file.name}`}
                  >
                    <X className='h-5 w-5' aria-hidden='true' />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
