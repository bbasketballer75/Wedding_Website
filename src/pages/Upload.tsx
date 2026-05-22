import { useCallback, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UploadSEO } from '@/components/seo/SEOHead'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  Share2,
  MessageCircle,
  Link2,
  Copy,
  Check,
  Facebook,
  Twitter,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Mail,
  Clock3,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, getOrCreateShareToken } from '@/lib/supabase'
import storage from '@/utils/storage'
import { useClaimStore } from '@/stores/claimStore'
import { ClaimModal } from '@/components/gallery/ClaimModal'

enum UploadError {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_SLOT_UNAVAILABLE = 'UPLOAD_SLOT_UNAVAILABLE',
  R2_PUT_FAILURE = 'R2_PUT_FAILURE',
  UNKNOWN = 'UNKNOWN',
}

function isUploadError(error: unknown): error is UploadError {
  return typeof error === 'string' && Object.values(UploadError).includes(error as UploadError)
}

interface UploadingFile {
  id: string
  file: File
  status: 'uploading' | 'complete' | 'error'
  preview?: string
  publicUrl?: string
  errorMessage?: string
  progress?: number // 0-100
}

interface StoredUploadMetadata {
  id: string
  name: string
  type: string
  size: number
  fingerprint: string
  preview: string // Base64 data URL for image preview
  status: 'uploading' | 'paused' | 'error'
  progress?: number // 0-100
  createdAt: number // Timestamp for ordering
}

const UPLOAD_QUEUE_KEY = 'wedding-upload-queue'

// Load stored upload queue from localStorage
function loadUploadQueue(): StoredUploadMetadata[] {
  return storage.getJSON<StoredUploadMetadata[]>(UPLOAD_QUEUE_KEY, []) || []
}

// Save upload queue to localStorage (excludes completed uploads)
function saveUploadQueue(files: UploadingFile[]): void {
  const toStore: StoredUploadMetadata[] = files
    .filter(f => f.status !== 'complete') // Don't persist completed uploads
    .map(f => ({
      id: f.id,
      name: f.file.name,
      type: f.file.type,
      size: f.file.size,
      fingerprint: `${f.file.name}:${f.file.size}:${f.file.lastModified}`,
      preview: f.preview || '',
      status: (f.status === 'uploading' ? 'paused' : f.status) as 'uploading' | 'paused' | 'error',
      progress: f.progress,
      createdAt: Date.now(),
    }))

  storage.setJSON(UPLOAD_QUEUE_KEY, toStore)
}

// Clear upload queue from localStorage
function clearUploadQueue(): void {
  storage.removeItem(UPLOAD_QUEUE_KEY)
}


function formatMediaCount(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}

function describeUploadSummary(photoCount: number, videoCount: number) {
  const parts: string[] = []
  if (photoCount > 0) parts.push(formatMediaCount(photoCount, 'photo'))
  if (videoCount > 0) parts.push(formatMediaCount(videoCount, 'video'))

  if (parts.length === 0) return 'your upload'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} and ${parts[1]}`
}

function describeSubmitLabel(photoCount: number, videoCount: number) {
  if (photoCount === 0 && videoCount === 0) {
    return 'Choose your files first'
  }

  return `Submit ${describeUploadSummary(photoCount, videoCount)}`
}

function createUploadId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function buildFileFingerprint(file: File) {
  const fallback = `fallback:${file.name}:${file.size}:${file.lastModified}`

  try {
    if (!crypto?.subtle) {
      return fallback
    }

    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    const bytes = Array.from(new Uint8Array(digest))
    const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
    return `sha256:${hex}`
  } catch {
    return fallback
  }
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [queueNotice, setQueueNotice] = useState<string | null>(null)

  // Load stored incomplete uploads on mount
  const [storedUploads, setStoredUploads] = useState<StoredUploadMetadata[]>([])

  useEffect(() => {
    // Load stored uploads on mount - StoredUploadMetadata never has 'complete' status
    const stored = loadUploadQueue()
    setStoredUploads(stored)
  }, [])

  // Persist upload queue to localStorage whenever files change
  useEffect(() => {
    if (files.length > 0) {
      saveUploadQueue(files)
    }
  }, [files])

  // Clear localStorage on successful submission
  useEffect(() => {
    if (isSubmitted) {
      clearUploadQueue()
    }
  }, [isSubmitted])

  const siteShareUrl = typeof window !== 'undefined'
    ? import.meta.env.VITE_SITE_URL || window.location.origin
    : import.meta.env.VITE_SITE_URL || ''
  const siteShareTitle = "Austin & Jordyn's Wedding"
  const siteShareDescription = 'Watch the film, browse the gallery, read the guestbook, and share your side of the day.'

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
      const file = fileObj.file

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

      const { uploadUrl, publicUrl } = await slotRes.json() as { uploadUrl: string; publicUrl: string }

      // Step 2: PUT the file directly to R2 using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progressPercent = Math.round((event.loaded / event.total) * 100)
            setFiles(prev =>
              prev.map(f =>
                f.id === fileObj.id ? { ...f, progress: progressPercent } : f
              )
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
      const completedFingerprint = `${fileObj.file.name}:${fileObj.file.size}:${fileObj.file.lastModified}`
      const storedUploads = loadUploadQueue()
      const updatedStored = storedUploads.filter(u => u.fingerprint !== completedFingerprint)
      if (updatedStored.length !== storedUploads.length) {
        storage.setJSON(UPLOAD_QUEUE_KEY, updatedStored)
      }
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
          errorMessage = 'This one didn\'t make it through — try uploading again'
          break
        case UploadError.UNKNOWN:
        default:
          errorMessage = 'Something went wrong — try again or skip this file'
      }

      setFiles(prev =>
        prev.map(f =>
          f.id === fileObj.id
            ? { ...f, status: 'error', errorMessage, progress: undefined }
            : f
        )
      )
    }
  }, [])

  const addFiles = useCallback((newFiles: File[]) => {
    // Load stored uploads for fingerprint matching (resume detection)
    const storedUploads = loadUploadQueue()
    const storedFingerprints = new Set(
      storedUploads.map(u => u.fingerprint)
    )

    const existingFingerprints = new Set(
      files.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`)
    )
    const batchFingerprints = new Set<string>()
    const notices: string[] = []

    const validFiles = newFiles.filter(file => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isValidSize = file.size <= 500 * 1024 * 1024
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`

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
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`
      const storedUpload = storedUploads.find(u => u.fingerprint === fingerprint)
      const isResumed = Boolean(storedUpload)

      return {
        id: createUploadId(),
        file,
        status: 'uploading' as const,
        preview: isResumed && storedUpload?.preview
          ? storedUpload.preview  // Restore preview from stored upload
          : file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined,
      }
    })

    setFiles(prev => [...prev, ...newUploadingFiles])

    newUploadingFiles.forEach(fileObj => {
      void uploadFileToR2(fileObj)
    })
  }, [files, uploadFileToR2])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }, [addFiles])

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (files.length === 0 || !name || !email) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const completedPhotoFiles = files.filter(
        (file) => file.status === 'complete' && !file.file.type.startsWith('video/') && file.publicUrl
      )
      const completedVideoFiles = files.filter(
        (file) => file.status === 'complete' && file.file.type.startsWith('video/') && file.publicUrl
      )

      const [photoFingerprints, videoFingerprints] = await Promise.all([
        Promise.all(completedPhotoFiles.map((file) => buildFileFingerprint(file.file))),
        Promise.all(completedVideoFiles.map((file) => buildFileFingerprint(file.file))),
      ])

      const photoUrls = completedPhotoFiles
        .map(f => f.publicUrl)
        .filter(Boolean) as string[]

      const videoUrls = completedVideoFiles
        .map(f => f.publicUrl)
        .filter(Boolean) as string[]

      const { error } = await supabase
        .from('guest_uploads')
        .insert([
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
        ])

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
      setQueueNotice(null)
    } catch {
      setSubmitError('Something didn\'t quite work — give it another go')
    } finally {
      setIsSubmitting(false)
    }
  }

  const retryUpload = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (file) {
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'uploading', errorMessage: undefined }
            : f
        )
      )
      void uploadFileToR2(file)
    }
  }

  const handleCopyShareLink = async () => {
    await navigator.clipboard.writeText(siteShareUrl)
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 1800)
  }

  const openShareWindow = (url: string) => {
    window.open(url, '_blank', 'width=640,height=520')
  }

  const completedFiles = files.filter(f => f.status === 'complete').length
  const hasErrors = files.some(f => f.status === 'error')
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const completedPhotoCount = files.filter(f => f.status === 'complete' && !f.file.type.startsWith('video/')).length
  const completedVideoCount = files.filter(f => f.status === 'complete' && f.file.type.startsWith('video/')).length
  const selectedPhotoCount = files.filter(f => !f.file.type.startsWith('video/')).length
  const selectedVideoCount = files.filter(f => f.file.type.startsWith('video/')).length

  if (isSubmitted) {
    const uploadSummary = describeUploadSummary(completedPhotoCount, completedVideoCount)

    return (
      <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] px-4 pb-20 pt-32">
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
        </div>
        <UploadSEO />

        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            data-testid="upload-success-panel"
            className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 text-center sm:px-10"
          >
            <div className="absolute -right-10 top-6 h-28 w-28 rounded-full bg-gold-500/8 blur-3xl" />
            <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-gold-400/5 blur-3xl" />

            <div className="relative">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 shadow-sm"
              >
                <CheckCircle className="h-10 w-10 text-green-400" />
              </motion.div>

              <span className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400 mt-6">
                <Sparkles className="h-3.5 w-3.5" />
                Upload received
              </span>

              <h1 className="mt-6 text-4xl text-white sm:text-5xl">
                Thank you for adding to the archive.
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
                Your {uploadSummary} {completedPhotoCount + completedVideoCount === 1 ? 'is' : 'are'} uploaded and pending review.
                We’ll take a look and add the approved moments to the shared archive after review.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/50">
                <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                  {completedPhotoCount > 0 ? formatMediaCount(completedPhotoCount, 'photo') : 'No photos'}
                </span>
                <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                  {completedVideoCount > 0 ? formatMediaCount(completedVideoCount, 'video') : 'No videos'}
                </span>
                <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                  Contact saved for {email}
                </span>
              </div>

              {shareToken && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mt-8 p-6 rounded-xl border border-gold-400/30 bg-gradient-to-br from-gold-500/15 via-gold-500/5 to-transparent text-left relative overflow-hidden"
                >
                  <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-gold-500/10 blur-2xl pointer-events-none" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] font-semibold text-gold-400">
                        <Sparkles className="h-3 w-3" /> Your Memory Album Link
                      </span>
                      <h3 className="text-lg font-serif text-white mt-1">Share your contributions!</h3>
                      <p className="text-white/60 text-xs mt-1 leading-relaxed max-w-md">
                        This unique link compiles all your approved photo uploads and guestbook messages in one gorgeous public showcase.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 sm:w-48">
                      <button
                        type="button"
                        onClick={async () => {
                          const guestLink = `${window.location.origin}/guest/${shareToken}`
                          await navigator.clipboard.writeText(guestLink)
                          setShareCopied(true)
                          setTimeout(() => setShareCopied(false), 2000)
                        }}
                        className="w-full shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 px-4 py-2.5 text-xs font-semibold text-cream-50 transition-all cursor-pointer"
                      >
                        {shareCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Album Link
                          </>
                        )}
                      </button>
                      <Button
                        to={`/guest/${shareToken}`}
                        variant="secondary"
                        size="sm"
                        className="w-full text-center border-white/10 hover:border-gold-400/30 text-xs py-2 bg-white/5 text-white flex items-center justify-center gap-1"
                      >
                        View My Album
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gold-200/15 bg-white/5 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">Step 1</p>
                  <p className="mt-3 text-sm font-semibold text-white">We review it first.</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">Nothing goes public automatically. We sort through everything before it appears anywhere on the site.</p>
                </div>
                <div className="rounded-xl border border-gold-200/15 bg-white/5 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">Step 2</p>
                  <p className="mt-3 text-sm font-semibold text-white">We tag it into the right story lane.</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">The best photos get captioned, tagged, and placed into the wedding-day, engagement, or guest-upload collections.</p>
                </div>
                <div className="rounded-xl border border-gold-200/15 bg-white/5 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">Step 3</p>
                  <p className="mt-3 text-sm font-semibold text-white">The approved moments join the archive.</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">Photos can appear in the live gallery, and approved video clips can stay private, join the guest-highlight lane, or become a featured moment later.</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Button to="/gallery?collection=Guest+Photos" variant="secondary" size="lg">
                  Guest Photos
                </Button>
                <Button to="/gallery" variant="secondary" size="lg">
                  View Gallery
                </Button>
                <Button onClick={() => window.location.reload()} size="lg">
                  Share more
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
      </div>
      <UploadSEO />

      <div className="mx-auto max-w-6xl px-4">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-8 sm:px-8 sm:py-10"
        >
          <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-gold-500/8 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-gold-400/5 blur-3xl" />

          <div className="relative">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400">
              <Sparkles className="h-3.5 w-3.5" />
              Contribute to the Archive
            </span>

            <h1 className="mt-6 text-5xl text-white sm:text-6xl">
              Preserve the moments from your perspective.
            </h1>

            <p className="mt-5 max-w-2xl text-base text-white/55 sm:text-lg">
              Phone photos, shaky dance-floor videos, ceremony candids, quiet table moments:
              the whole archive gets better when your side of the day is part of it too.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-white/50">
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                {selectedPhotoCount > 0 ? formatMediaCount(selectedPhotoCount, 'selected photo') : 'Photos welcome'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                {selectedVideoCount > 0 ? formatMediaCount(selectedVideoCount, 'selected video') : 'Videos welcome'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2">
                Reviewed before posting
              </span>
            </div>
          </div>
        </motion.section>

        {/* Photo Claiming Banner */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-gold-500/15 via-gold-500/5 to-transparent backdrop-blur-md border border-gold-500/20 px-6 py-6 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-gold-500/10 text-gold-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-white">Already uploaded memories?</h3>
              <p className="mt-1 text-sm text-white/70 max-w-xl">
                Claim ownership of your uploaded photos or face clusters you appear in. Get your name verified and beautifully displayed in gold italics across the gallery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => useClaimStore.getState().openWizard()}
            className="relative shrink-0 overflow-hidden rounded-lg bg-gold-500 hover:bg-gold-600 px-5 py-2.5 text-sm font-semibold text-cream-50 shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            Claim My Photos
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.section>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="grid gap-6">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="upload-dropzone"
              className={cn(
                'relative overflow-hidden rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all sm:px-8 sm:py-10',
                isDragging
                  ? 'border-gold-400 bg-gold-500/8 shadow-[0_0_60px_-20px_rgba(198,156,78,0.3)]'
                  : 'border-gold-200/20 bg-white/4 hover:border-gold-400/40 hover:bg-white/6'
              )}
            >
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                aria-label="Select photos or videos to upload"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />

              <motion.div
                animate={isDragging ? { y: [0, -10, 0] } : { y: 0 }}
                transition={isDragging ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border border-gold-400/20 bg-gold-500/10 sm:h-20 sm:w-20"
              >
                <Upload className="h-9 w-9 text-gold-400 sm:h-10 sm:w-10" />
              </motion.div>

              <h2 className="mt-6 text-4xl text-white sm:text-5xl">
                {isDragging ? 'Drop them right here.' : 'Drop photos or videos to begin.'}
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
                Click anywhere or drag your files in
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/50">
                <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-gold-400" />
                    JPG, PNG, HEIC
                  </span>
                </span>
                <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Video className="h-4 w-4 text-gold-400" />
                    MP4, MOV
                  </span>
                </span>
                <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2">
                  Up to 50 files, 500MB each
                </span>
              </div>
            </motion.section>

            {queueNotice && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-400/25 bg-amber-500/8 px-5 py-4"
              >
                <p className="flex items-start gap-2 text-sm leading-6 text-amber-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {queueNotice}
                </p>
              </motion.div>
            )}

            {(files.length > 0 || storedUploads.length > 0) && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-6 sm:px-8"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400">
                      <Upload className="h-3.5 w-3.5" />
                      Upload queue
                    </span>
                    <h3 className="mt-5 text-3xl text-white sm:text-4xl">
                      {completedFiles} of {files.length} files ready to send
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm text-white/55 sm:text-base">
                      Take a look before sending. Remove anything you don't want, retry anything that didn't upload, and send when you're happy with what's ready.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
                    <span className="rounded-full border border-white/12 bg-white/6 px-4 py-2">
                      {describeUploadSummary(completedPhotoCount, completedVideoCount)}
                    </span>
                    {uploadingCount > 0 && (
                      <span className="rounded-full border border-gold-400/25 bg-gold-500/8 px-4 py-2 text-gold-300">
                        {uploadingCount} still uploading
                      </span>
                    )}
                    {hasErrors && (
                      <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-rose-300">
                        These didn't upload — retry or remove them before sending
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <AnimatePresence initial={false}>
                  {(() => {
                    // Combine stored uploads (for resume) with current files
                    // storedUploads that are already in files (matched by fingerprint) should not be shown twice
                    const currentFingerprints = new Set(
                      files.map(f => `${f.file.name}:${f.file.size}:${f.file.lastModified}`)
                    )

                    const resumableUploads = storedUploads.filter(
                      u => !currentFingerprints.has(`${u.name}:${u.size}:${u.createdAt}`)
                    )

                    return (
                      <>
                        {resumableUploads.map((u, idx) => (
                          <motion.div
                            key={`stored-${u.id}`}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.28, delay: idx * 0.04 }}
                          >
                            <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center bg-white/5 border border-l-2 border-l-gold-400 border-white/8 rounded-xl">
                              {/* Preview */}
                              <div className="flex items-center gap-4">
                                {u.preview ? (
                                  <img src={u.preview} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/20 bg-gold-500/10 text-gold-400">
                                    {u.type.startsWith('video/') ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">{u.name}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                                    <span>{(u.size / 1024 / 1024).toFixed(1)} MB</span>
                                    <span className="h-1 w-1 rounded-full bg-gold-300" />
                                    <span>{u.type.startsWith('video/') ? 'Video' : 'Photo'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Resume state */}
                              <div className="flex-1">
                                <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-gold-300 mb-2">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Pending resume
                                </div>
                                <p className="text-xs text-white/50">
                                  This upload was interrupted. Select the same file to resume.
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        {files.map((file, idx) => (
                          <motion.div
                            key={file.id}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -16 }}
                            transition={{ duration: 0.28, delay: (resumableUploads.length + idx) * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                          >
                            <div
                              className={cn(
                                'flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center bg-white/5 border border-white/8 rounded-xl',
                                file.status === 'error' && 'border-rose-400/20 bg-rose-500/10'
                              )}
                            >
                              <div className="flex items-center gap-4">
                                {file.preview ? (
                                  <img src={file.preview} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/20 bg-gold-500/10 text-gold-400">
                                    <Video className="h-6 w-6" />
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {file.file.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                                    <span>{(file.file.size / 1024 / 1024).toFixed(1)} MB</span>
                                    <span className="h-1 w-1 rounded-full bg-gold-300" />
                                    <span>{file.file.type.startsWith('video/') ? 'Video' : 'Photo'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex-1">
                                {file.status === 'uploading' && (
                                  <div>
                                    <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                                      <span>{file.progress !== undefined ? `${file.progress}% uploaded` : 'Uploading for us…'}</span>
                                      <span>{file.progress === 100 ? 'Processing…' : 'Sending'}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300 transition-all duration-300"
                                        style={{ width: `${file.progress ?? 0}%` }}
                                      />
                                    </div>
                                    {file.progress !== undefined && file.progress < 100 && (
                                      <p className="mt-2 text-xs text-white/50">
                                        Keep this window open while your file uploads
                                      </p>
                                    )}
                                  </div>
                                )}

                                {file.status === 'complete' && (
                                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Uploaded and ready
                                  </div>
                                )}

                                {file.status === 'error' && (
                                  <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300">
                                      <AlertCircle className="h-3.5 w-3.5" />
                                      Needs retry
                                    </div>
                                    <p className="text-xs leading-5 text-rose-300">
                                      {file.errorMessage || 'This one didn\'t upload — try again or skip it'}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => retryUpload(file.id)}
                                      className="cursor-pointer text-xs font-medium uppercase tracking-[0.22em] text-gold-300 transition-colors hover:text-gold-400"
                                    >
                                      Try again
                                    </button>
                                  </div>
                                )}
                              </div>

                              {file.status !== 'complete' && (
                                <button
                                  type="button"
                                  onClick={() => removeFile(file.id)}
                                  className="cursor-pointer self-start rounded-full border border-white/15 bg-white/8 p-2 text-white/60 transition-colors hover:bg-white/14 hover:text-white sm:self-center"
                                  aria-label={`Remove ${file.file.name}`}
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </>
                    )
                  })()}
                  </AnimatePresence>
                </div>
              </motion.section>
            )}
          </div>

          <div className="grid gap-6 xl:sticky xl:top-28 xl:self-start">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-6"
            >
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-400">
                <Mail className="h-3.5 w-3.5" />
                Your details
              </span>

              <h2 className="mt-5 text-3xl text-white">
                Tell us who this upload came from.
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/55">
                We only need enough information to credit the memories and send you a quick note when they are approved.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <Label htmlFor="name" className="text-white/70">Your Name</Label>
                  <Input
                    id="name"
                    className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Sarah Johnson"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-white/70">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                  <p className="mt-2 text-xs text-white/50">
                    We keep this in case we need to reach you about your photos.
                  </p>
                </div>

                <div>
                  <Label htmlFor="message" className="text-white/70">Add a Note (Optional)</Label>
                  <Textarea
                    id="message"
                    className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us where these were taken, who shared them, or leave a little note from the day."
                    rows={4}
                  />
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5"
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">
                Before you send
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                A few reassurance points
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/55">
                <li className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                  Only Austin & Jordyn can see these until they are approved.
                </li>
                <li className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                  Uploads stay in review until we sort and caption them for the gallery.
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                  Your contact details stay with the submission in case we need context while reviewing it.
                </li>
                <li className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                  Duplicates and oversized files are called out before submission so the queue stays honest.
                </li>
              </ul>
            </motion.section>

            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3"
              >
                <p className="flex items-center gap-2 text-sm text-rose-300">
                  <AlertCircle className="h-4 w-4" />
                  {submitError}
                </p>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">
                    Final step
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    Send everything through for review.
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 text-gold-600" />
              </div>

              <p className="mt-3 text-sm leading-6 text-white/55">
                You can submit once at least one file is marked ready and your contact details are filled in. Files that
                failed will stay out until you retry or remove them.
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-gold-400">What happens next</p>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  After you send, the upload enters a private review queue. Approved photos can be published into the
                  live gallery, while approved video clips can be kept private, added to guest highlights, or featured later.
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="mt-6 w-full"
                disabled={files.length === 0 || !name || !email || isSubmitting || completedFiles === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : completedFiles === 0 && files.length > 0 ? (
                  'Wait for uploads…'
                ) : (
                  describeSubmitLabel(completedPhotoCount, completedVideoCount)
                )}
              </Button>
            </motion.div>
          </div>
        </form>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-6 sm:px-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">
                Pass the site along
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Send the full site to anyone who still has not watched or browsed yet.
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                These buttons share the site itself. Uploads still happen separately above.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label={shareCopied ? 'Copied' : 'Copy link'}
              >
                {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const body = encodeURIComponent(`${siteShareTitle} — ${siteShareDescription} ${siteShareUrl}`)
                  window.location.href = `sms:?&body=${body}`
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Text it"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteShareUrl)}`)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Share on Facebook"
              >
                <Facebook className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${siteShareTitle} — ${siteShareDescription}`)}&url=${encodeURIComponent(siteShareUrl)}`)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Share on X"
              >
                <Twitter className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const subject = encodeURIComponent(siteShareTitle)
                  const body = encodeURIComponent(`${siteShareDescription}\n\n${siteShareUrl}`)
                  window.location.href = `mailto:?subject=${subject}&body=${body}`
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                aria-label="Share via email"
              >
                <Mail className="h-4 w-4" />
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.share({
                      title: siteShareTitle,
                      text: siteShareDescription,
                      url: siteShareUrl,
                    }).catch(() => {})
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
                  aria-label="More share options"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <div className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm">
                <Link2 className="h-4 w-4 text-gold-400" />
                <span className="max-w-[11rem] truncate sm:max-w-[13rem] text-white/40">{siteShareUrl}</span>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
      <ClaimModal />
    </div>
  )
}
