import type { StoredUploadMetadata, UploadStorage, UploadingFile } from './types'

/**
 * Queue persistence (frozen `src/pages/upload/uploadQueueStorage.ts`).
 * Storage is injected so tests are deterministic; the browser default is
 * `window.localStorage`.
 */

export const UPLOAD_QUEUE_KEY = 'wedding-upload-queue'

export function browserUploadStorage(): UploadStorage {
  if (typeof window === 'undefined') {
    const memory = new Map<string, string>()
    return {
      getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: key => {
        memory.delete(key)
      },
    }
  }
  return window.localStorage
}

export function loadUploadQueue(
  storage: UploadStorage = browserUploadStorage()
): StoredUploadMetadata[] {
  try {
    const raw = storage.getItem(UPLOAD_QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is StoredUploadMetadata => {
      if (typeof entry !== 'object' || entry === null) return false
      const candidate = entry as Partial<StoredUploadMetadata>
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.name === 'string' &&
        typeof candidate.size === 'number' &&
        typeof candidate.fingerprint === 'string'
      )
    })
  } catch {
    return []
  }
}

/** Persist everything that is not complete (completed uploads are already in R2). */
export function saveUploadQueue(
  files: readonly UploadingFile[],
  storage: UploadStorage = browserUploadStorage(),
  now: number = Date.now()
): void {
  const toStore: StoredUploadMetadata[] = files
    .filter(file => file.status !== 'complete')
    .map(file => {
      const status: StoredUploadMetadata['status'] = file.status === 'error' ? 'error' : 'paused'
      return {
        id: file.id,
        name: file.file.name,
        type: file.file.type,
        size: file.file.size,
        fingerprint: getFileFingerprint(file.file),
        preview: file.preview ?? '',
        status,
        ...(file.progress === undefined ? {} : { progress: file.progress }),
        createdAt: now,
      }
    })

  try {
    storage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(toStore))
  } catch {
    /* quota / private mode — the in-memory queue still works */
  }
}

export function clearUploadQueue(storage: UploadStorage = browserUploadStorage()): void {
  storage.removeItem(UPLOAD_QUEUE_KEY)
}

export function removeStoredUploadByFingerprint(
  fingerprint: string,
  storage: UploadStorage = browserUploadStorage()
): void {
  const stored = loadUploadQueue(storage)
  const updated = stored.filter(upload => upload.fingerprint !== fingerprint)
  if (updated.length !== stored.length) {
    try {
      storage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(updated))
    } catch {
      /* ignore */
    }
  }
}

export function createUploadId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/** Cheap synchronous fingerprint used to dedupe/resume (name:size:lastModified). */
export function getFileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/** Content fingerprint (SHA-256) with the frozen cheap fallback. */
export async function buildFileFingerprint(file: File): Promise<string> {
  const fallback = `fallback:${file.name}:${file.size}:${file.lastModified}`
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return fallback
    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    const bytes = Array.from(new Uint8Array(digest))
    return `sha256:${bytes.map(value => value.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return fallback
  }
}
