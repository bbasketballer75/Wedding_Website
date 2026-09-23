import { useCallback, useEffect, useState } from 'react'
import UploadError, { isUploadError } from './uploadErrors'
import type { StoredUploadMetadata, UploadingFile } from './types'
import {
  loadUploadQueue,
  saveUploadQueue,
  clearUploadQueue,
  createUploadId,
  getFileFingerprint,
  removeStoredUploadByFingerprint,
} from './uploadQueueStorage'
import { compressImage } from '@/utils/imageCompressor'

export interface UseUploadQueueResult {
  files: UploadingFile[]
  storedUploads: StoredUploadMetadata[]
  queueNotice: string | null
  isDragging: boolean
  addFiles: (newFiles: File[]) => void
  removeFile: (id: string) => void
  retryUpload: (fileId: string) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  clearQueue: () => void
  clearQueueNotice: () => void
  // derived counts
  completedFiles: number
  hasErrors: boolean
  uploadingCount: number
  completedPhotoCount: number
  completedVideoCount: number
  selectedPhotoCount: number
  selectedVideoCount: number
  totalFiles: number
  aggregateProgress: number
  isUploadingAny: boolean
}

export function useUploadQueue(): UseUploadQueueResult {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [queueNotice, setQueueNotice] = useState<string | null>(null)
  const [storedUploads, setStoredUploads] = useState<StoredUploadMetadata[]>([])

  // Load stored uploads on mount - StoredUploadMetadata never has 'complete' status
  useEffect(() => {
    const stored = loadUploadQueue()
    setStoredUploads(stored)
  }, [])

  // Persist upload queue to localStorage whenever files change.
  // Also persist the empty queue so removing the last file doesn't leave stale entries.
  useEffect(() => {
    if (files.length > 0) {
      saveUploadQueue(files)
    } else {
      clearUploadQueue()
    }
  }, [files])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const uploadFileToR2 = useCallback(async (fileObj: UploadingFile) => {
    try {
      let file = fileObj.file

      // Client-side image compression & WebP conversion
      if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(file)
          file = compressed
          // Update file and preview in our state list
          setFiles(prev =>
            prev.map(f =>
              f.id === fileObj.id
                ? {
                    ...f,
                    file: compressed,
                    preview: URL.createObjectURL(compressed),
                  }
                : f
            )
          )
        } catch (compError) {
          console.error('Image compression failed, falling back to original file:', compError)
        }
      }

      // Step 1: request a pre-signed PUT URL from our Netlify function
      const slotRes = await fetch('/.netlify/functions/guest-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
      })

      if (!slotRes.ok) {
        const status = slotRes.status
        let errorType = UploadError.UPLOAD_SLOT_UNAVAILABLE
        if (status === 429 || status === 503) {
          errorType = UploadError.UPLOAD_SLOT_UNAVAILABLE
        }
        setFiles(prev =>
          prev.map(f =>
            f.id === fileObj.id
              ? { ...f, status: 'error', errorMessage: errorType, progress: undefined }
              : f
          )
        )
        return
      }

      const { uploadUrl, publicUrl } = (await slotRes.json()) as {
        uploadUrl: string
        publicUrl: string
      }

      // Step 2: PUT the file directly to R2 using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) {
            const progressPercent = Math.round((event.loaded / event.total) * 100)
            setFiles(prev =>
              prev.map(f => (f.id === fileObj.id ? { ...f, progress: progressPercent } : f))
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(UploadError.R2_PUT_FAILURE)
          }
        })

        xhr.addEventListener('error', () => reject(UploadError.NETWORK_TIMEOUT))
        xhr.addEventListener('timeout', () => reject(UploadError.NETWORK_TIMEOUT))
        xhr.addEventListener('abort', () => reject(UploadError.NETWORK_TIMEOUT))

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.timeout = 120000 // 2 minute timeout
        xhr.send(file)
      })

      setFiles(prev =>
        prev.map(f =>
          f.id === fileObj.id
            ? { ...f, status: 'complete', publicUrl, errorMessage: undefined, progress: undefined }
            : f
        )
      )

      // Clean up stored upload from localStorage on successful completion
      removeStoredUploadByFingerprint(getFileFingerprint(fileObj.file))
    } catch (error) {
      let errorType = UploadError.UNKNOWN
      let errorMessage = 'Something went wrong — try again or skip this file'

      if (isUploadError(error)) {
        errorType = error
      } else if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('abort')) {
          errorType = UploadError.NETWORK_TIMEOUT
        } else if (error.message.includes('timeout')) {
          errorType = UploadError.NETWORK_TIMEOUT
        }
      }

      // Set specific message based on error type
      switch (errorType) {
        case UploadError.NETWORK_TIMEOUT:
          errorMessage = 'Connection timed out — check your internet and try again'
          break
        case UploadError.FILE_TOO_LARGE:
          errorMessage = 'This file exceeds the 500MB limit and was skipped.'
          break
        case UploadError.UPLOAD_SLOT_UNAVAILABLE:
          errorMessage = 'Upload slot unavailable — try again in a moment'
          break
        case UploadError.R2_PUT_FAILURE:
          errorMessage = "This one didn't make it through — try uploading again"
          break
        case UploadError.UNKNOWN:
        default:
          errorMessage = 'Something went wrong — try again or skip this file'
      }

      setFiles(prev =>
        prev.map(f =>
          f.id === fileObj.id ? { ...f, status: 'error', errorMessage, progress: undefined } : f
        )
      )
    }
  }, [])

  const addFiles = useCallback(
    (newFiles: File[]) => {
      // Load stored uploads for fingerprint matching (resume detection)
      const storedUploads = loadUploadQueue()
      const storedFingerprints = new Set(storedUploads.map(u => u.fingerprint))

      const existingFingerprints = new Set(files.map(({ file }) => getFileFingerprint(file)))
      const batchFingerprints = new Set<string>()
      const notices: string[] = []

      const validFiles = newFiles.filter(file => {
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        const isValidSize = file.size <= 500 * 1024 * 1024
        const fingerprint = getFileFingerprint(file)

        if (!isImage && !isVideo) {
          notices.push(`${file.name} was skipped because only photos and videos can be uploaded.`)
          return false
        }

        if (!isValidSize) {
          notices.push(`${file.name} is over the 500MB limit and was skipped.`)
          return false
        }

        if (existingFingerprints.has(fingerprint) || batchFingerprints.has(fingerprint)) {
          notices.push(`${file.name} was already in the queue, so the duplicate was skipped.`)
          return false
        }

        // Check against stored uploads - if match found, it's a resume
        if (storedFingerprints.has(fingerprint)) {
          const storedUpload = storedUploads.find(u => u.fingerprint === fingerprint)
          if (storedUpload) {
            notices.push(`${file.name} is being resumed from a previous session.`)
          }
        }

        batchFingerprints.add(fingerprint)
        return true
      })

      setQueueNotice(notices.length > 0 ? notices[0] : null)

      const newUploadingFiles: UploadingFile[] = validFiles.map(file => {
        const fingerprint = getFileFingerprint(file)
        const storedUpload = storedUploads.find(u => u.fingerprint === fingerprint)
        const isResumed = Boolean(storedUpload)

        return {
          id: createUploadId(),
          file,
          status: 'uploading' as const,
          preview:
            isResumed && storedUpload?.preview
              ? storedUpload.preview // Restore preview from stored upload
              : file.type.startsWith('image/')
                ? URL.createObjectURL(file)
                : undefined,
        }
      })

      setFiles(prev => [...prev, ...newUploadingFiles])

      newUploadingFiles.forEach(fileObj => {
        void uploadFileToR2(fileObj)
      })
    },
    [files, uploadFileToR2]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
    },
    [addFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files)
        addFiles(selectedFiles)
      }
    },
    [addFiles]
  )

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const retryUpload = useCallback(
    (fileId: string) => {
      const file = files.find(f => f.id === fileId)
      if (file) {
        setFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, status: 'uploading', errorMessage: undefined } : f
          )
        )
        void uploadFileToR2(file)
      }
    },
    [files, uploadFileToR2]
  )

  const clearQueue = useCallback(() => {
    clearUploadQueue()
  }, [])

  const clearQueueNotice = useCallback(() => {
    setQueueNotice(null)
  }, [])

  // Derived counts
  const completedFiles = files.filter(f => f.status === 'complete').length
  const hasErrors = files.some(f => f.status === 'error')
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const completedPhotoCount = files.filter(
    f => f.status === 'complete' && !f.file.type.startsWith('video/')
  ).length
  const completedVideoCount = files.filter(
    f => f.status === 'complete' && f.file.type.startsWith('video/')
  ).length
  const selectedPhotoCount = files.filter(f => !f.file.type.startsWith('video/')).length
  const selectedVideoCount = files.filter(f => f.file.type.startsWith('video/')).length

  const totalFiles = files.length
  const activeUploadingFiles = files.filter(
    f => f.status === 'uploading' || f.status === 'complete'
  )
  const totalProgressSum = activeUploadingFiles.reduce((acc, f) => {
    if (f.status === 'complete') return acc + 100
    return acc + (f.progress ?? 0)
  }, 0)
  const aggregateProgress = totalFiles > 0 ? Math.round(totalProgressSum / totalFiles) : 0
  const isUploadingAny = files.some(f => f.status === 'uploading')

  return {
    files,
    storedUploads,
    queueNotice,
    isDragging,
    addFiles,
    removeFile,
    retryUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    clearQueue,
    clearQueueNotice,
    completedFiles,
    hasErrors,
    uploadingCount,
    completedPhotoCount,
    completedVideoCount,
    selectedPhotoCount,
    selectedVideoCount,
    totalFiles,
    aggregateProgress,
    isUploadingAny,
  }
}
