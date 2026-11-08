import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createStubUploadApi } from './data'
import { compressImage as defaultCompressImage } from './imageCompressor'
import { putFileToR2 } from './uploadTransport'
import { resolveUploadErrorMessage } from './uploadErrors'
import { MAX_FILE_SIZE_BYTES } from './uploadText'
import {
  browserUploadStorage,
  clearUploadQueue,
  createUploadId,
  getFileFingerprint,
  loadUploadQueue,
  removeStoredUploadByFingerprint,
  saveUploadQueue,
} from './uploadQueueStorage'
import type { StoredUploadMetadata, UploadApi, UploadStorage, UploadingFile } from './types'

/** Frozen dropzone/queue contract, with injectable transport seams for tests. */
export interface UploadQueueDependencies {
  api?: UploadApi
  storage?: UploadStorage
  compressImage?: (file: File) => Promise<File>
  putFile?: (file: File, onProgress: (progress: number) => void) => Promise<string>
  createPreview?: (file: File) => string | undefined
  now?: () => number
}

export interface UseUploadQueueResult {
  files: UploadingFile[]
  storedUploads: StoredUploadMetadata[]
  queueNotice: string | null
  isDragging: boolean
  addFiles: (newFiles: File[]) => void
  removeFile: (id: string) => void
  retryUpload: (fileId: string) => void
  clearQueue: () => void
  /** Clears only the persisted resume metadata (submit success keeps counts on screen). */
  clearPersistedQueue: () => void
  clearQueueNotice: () => void
  handleDragOver: (event: { preventDefault: () => void }) => void
  handleDragLeave: (event: { preventDefault: () => void }) => void
  handleDrop: (event: { preventDefault: () => void; dataTransfer: { files: unknown } }) => void
  handleFileSelect: (event: { target: { files: unknown; value?: string } }) => void
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

function defaultCreatePreview(file: File): string | undefined {
  if (!file.type.startsWith('image/')) return undefined
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined
  try {
    return URL.createObjectURL(file)
  } catch {
    return undefined
  }
}

function isFileListLike(value: unknown): value is ArrayLike<File> {
  return typeof value === 'object' && value !== null && 'length' in value
}

export function useUploadQueue(dependencies: UploadQueueDependencies = {}): UseUploadQueueResult {
  const storage = useMemo(
    () => dependencies.storage ?? browserUploadStorage(),
    [dependencies.storage]
  )
  const api = useMemo(() => dependencies.api ?? createStubUploadApi(), [dependencies.api])
  const compressImage = dependencies.compressImage ?? defaultCompressImage
  const createPreview = dependencies.createPreview ?? defaultCreatePreview
  const now = dependencies.now ?? Date.now
  const putFile = useMemo(
    () =>
      dependencies.putFile ??
      ((file: File, onProgress: (progress: number) => void) =>
        putFileToR2({ api, file, onProgress })),
    [api, dependencies.putFile]
  )

  const [files, setFiles] = useState<UploadingFile[]>([])
  // Resume metadata is read once, synchronously (no setState-in-effect).
  const [storedUploads, setStoredUploads] = useState<StoredUploadMetadata[]>(() =>
    loadUploadQueue(storage)
  )
  const [isDragging, setIsDragging] = useState(false)
  const [queueNotice, setQueueNotice] = useState<string | null>(null)
  const hadFilesRef = useRef(false)

  // Persist every queue change (completed files are excluded by the storage
  // helper). Only clear the persisted queue once it has actually held files —
  // clearing on first mount would destroy the resume data we just loaded.
  useEffect(() => {
    if (files.length > 0) {
      hadFilesRef.current = true
      saveUploadQueue(files, storage, now())
    } else if (hadFilesRef.current) {
      hadFilesRef.current = false
      clearUploadQueue(storage)
    }
  }, [files, storage, now])

  const refreshStored = useCallback(() => {
    setStoredUploads(loadUploadQueue(storage))
  }, [storage])

  const startUpload = useCallback(
    async (fileObject: UploadingFile) => {
      try {
        let uploadFile = fileObject.file

        // Client-side image compression / WebP conversion (falls back to original).
        if (uploadFile.type.startsWith('image/')) {
          const compressed = await compressImage(uploadFile)
          if (compressed !== uploadFile) {
            uploadFile = compressed
            setFiles(previous =>
              previous.map(file =>
                file.id === fileObject.id
                  ? {
                      ...file,
                      file: compressed,
                      preview: createPreview(compressed) ?? file.preview,
                    }
                  : file
              )
            )
          }
        }

        const publicUrl = await putFile(uploadFile, progress => {
          setFiles(previous =>
            previous.map(file => (file.id === fileObject.id ? { ...file, progress } : file))
          )
        })

        setFiles(previous =>
          previous.map(file =>
            file.id === fileObject.id
              ? { ...file, status: 'complete', publicUrl, progress: undefined }
              : file
          )
        )
        // Completed uploads no longer need resume metadata.
        removeStoredUploadByFingerprint(getFileFingerprint(fileObject.file), storage)
        refreshStored()
      } catch (error) {
        setFiles(previous =>
          previous.map(file =>
            file.id === fileObject.id
              ? {
                  ...file,
                  status: 'error',
                  errorMessage: resolveUploadErrorMessage(error),
                  progress: undefined,
                }
              : file
          )
        )
      }
    },
    [compressImage, createPreview, putFile, storage, refreshStored]
  )

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const savedUploads = loadUploadQueue(storage)
      const storedFingerprints = new Set(savedUploads.map(upload => upload.fingerprint))
      const existingFingerprints = new Set(files.map(({ file }) => getFileFingerprint(file)))
      const batchFingerprints = new Set<string>()
      const notices: string[] = []

      const validFiles = newFiles.filter(file => {
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        const fingerprint = getFileFingerprint(file)

        if (!isImage && !isVideo) {
          notices.push(`${file.name} was skipped because only photos and videos can be uploaded.`)
          return false
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          notices.push(`${file.name} is over the 500MB limit and was skipped.`)
          return false
        }
        if (existingFingerprints.has(fingerprint) || batchFingerprints.has(fingerprint)) {
          notices.push(`${file.name} was already in the queue, so the duplicate was skipped.`)
          return false
        }
        if (storedFingerprints.has(fingerprint)) {
          notices.push(`${file.name} is being resumed from a previous session.`)
        }

        batchFingerprints.add(fingerprint)
        return true
      })

      setQueueNotice(notices.length > 0 ? (notices[0] as string) : null)

      const newUploads: UploadingFile[] = validFiles.map(file => {
        const stored = savedUploads.find(upload => upload.fingerprint === getFileFingerprint(file))
        const preview = stored?.preview || createPreview(file)
        return {
          id: createUploadId(),
          file,
          status: 'uploading' as const,
          ...(preview ? { preview } : {}),
        }
      })

      setFiles(previous => [...previous, ...newUploads])
      for (const upload of newUploads) void startUpload(upload)
    },
    [createPreview, files, startUpload, storage]
  )

  const removeFile = useCallback((id: string) => {
    setFiles(previous => previous.filter(file => file.id !== id))
  }, [])

  const retryUpload = useCallback(
    (fileId: string) => {
      const target = files.find(file => file.id === fileId)
      if (!target) return
      setFiles(previous =>
        previous.map(file =>
          file.id === fileId ? { ...file, status: 'uploading', errorMessage: undefined } : file
        )
      )
      void startUpload(target)
    },
    [files, startUpload]
  )

  const clearQueue = useCallback(() => {
    clearUploadQueue(storage)
    setFiles([])
    setStoredUploads([])
  }, [storage])

  const clearPersistedQueue = useCallback(() => {
    clearUploadQueue(storage)
  }, [storage])

  const clearQueueNotice = useCallback(() => setQueueNotice(null), [])

  const handleDragOver = useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (event: { preventDefault: () => void; dataTransfer: { files: unknown } }) => {
      event.preventDefault()
      setIsDragging(false)
      const dropped = event.dataTransfer.files
      if (isFileListLike(dropped)) addFiles(Array.from(dropped))
    },
    [addFiles]
  )

  const handleFileSelect = useCallback(
    (event: { target: { files: unknown; value?: string } }) => {
      const selected = event.target.files
      if (isFileListLike(selected)) addFiles(Array.from(selected))
    },
    [addFiles]
  )

  const completedFiles = files.filter(file => file.status === 'complete').length
  const hasErrors = files.some(file => file.status === 'error')
  const uploadingCount = files.filter(file => file.status === 'uploading').length
  const completedPhotoCount = files.filter(
    file => file.status === 'complete' && !file.file.type.startsWith('video/')
  ).length
  const completedVideoCount = files.filter(
    file => file.status === 'complete' && file.file.type.startsWith('video/')
  ).length
  const selectedPhotoCount = files.filter(file => !file.file.type.startsWith('video/')).length
  const selectedVideoCount = files.filter(file => file.file.type.startsWith('video/')).length
  const isUploadingAny = files.some(file => file.status === 'uploading')

  const aggregateProgress = (() => {
    if (files.length === 0) return 0
    const total = files.reduce((sum, file) => {
      if (file.status === 'complete') return sum + 100
      if (file.status === 'uploading') return sum + (file.progress ?? 0)
      return sum
    }, 0)
    return Math.round(total / files.length)
  })()

  return {
    files,
    storedUploads,
    queueNotice,
    isDragging,
    addFiles,
    removeFile,
    retryUpload,
    clearQueue,
    clearPersistedQueue,
    clearQueueNotice,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    completedFiles,
    hasErrors,
    uploadingCount,
    completedPhotoCount,
    completedVideoCount,
    selectedPhotoCount,
    selectedVideoCount,
    totalFiles: files.length,
    aggregateProgress,
    isUploadingAny,
  }
}
