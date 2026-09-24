import storage from '@/utils/storage'
import type { StoredUploadMetadata, UploadingFile } from './types'

export const UPLOAD_QUEUE_KEY = 'wedding-upload-queue'

// Load stored upload queue from localStorage
export function loadUploadQueue(): StoredUploadMetadata[] {
  return storage.getJSON<StoredUploadMetadata[]>(UPLOAD_QUEUE_KEY, []) || []
}

// Save upload queue to localStorage (excludes completed uploads)
export function saveUploadQueue(files: UploadingFile[]): void {
  const toStore: StoredUploadMetadata[] = files
    .filter(f => f.status !== 'complete') // Don't persist completed uploads
    .map(f => ({
      id: f.id,
      name: f.file.name,
      type: f.file.type,
      size: f.file.size,
      fingerprint: getFileFingerprint(f.file),
      preview: f.preview || '',
      status: (f.status === 'uploading' ? 'paused' : f.status) as 'uploading' | 'paused' | 'error',
      progress: f.progress,
      createdAt: Date.now(),
    }))

  storage.setJSON(UPLOAD_QUEUE_KEY, toStore)
}

// Clear upload queue from localStorage
export function clearUploadQueue(): void {
  storage.removeItem(UPLOAD_QUEUE_KEY)
}

// Remove a single completed upload from the persisted queue (matched by fingerprint)
export function removeStoredUploadByFingerprint(fingerprint: string): void {
  const stored = loadUploadQueue()
  const updated = stored.filter(u => u.fingerprint !== fingerprint)
  if (updated.length !== stored.length) {
    storage.setJSON(UPLOAD_QUEUE_KEY, updated)
  }
}

export function createUploadId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Cheap, synchronous fingerprint used to dedupe/resume uploads (name:size:lastModified)
export function getFileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

// Content-based fingerprint (SHA-256 of file bytes) with a cheap fallback
export async function buildFileFingerprint(file: File) {
  const fallback = `fallback:${file.name}:${file.size}:${file.lastModified}`

  try {
    if (!crypto?.subtle) {
      return fallback
    }

    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    const bytes = Array.from(new Uint8Array(digest))
    const hex = bytes.map(value => value.toString(16).padStart(2, '0')).join('')
    return `sha256:${hex}`
  } catch {
    return fallback
  }
}
