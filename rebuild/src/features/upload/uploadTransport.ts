import { UPLOAD_ERRORS, UploadFailure } from './uploadErrors'
import type { UploadApi } from './types'

/**
 * Presign → XHR PUT transport (frozen `useUploadQueue.ts` steps 1-2).
 * XHR (not fetch) deliberately, so upload progress is observable. The XHR
 * factory is injectable for deterministic tests of progress/error/timeout.
 */
export interface PutFileOptions {
  api: UploadApi
  file: File
  onProgress?: (progress: number) => void
  createXhr?: () => XMLHttpRequest
  timeoutMs?: number
}

export async function putFileToR2({
  api,
  file,
  onProgress,
  createXhr = () => new XMLHttpRequest(),
  timeoutMs = 120_000,
}: PutFileOptions): Promise<string> {
  let slot: { uploadUrl: string; publicUrl: string }
  try {
    slot = await api.requestUploadSlot({ contentType: file.type, contentLength: file.size })
  } catch {
    throw new UploadFailure(UPLOAD_ERRORS.UPLOAD_SLOT_UNAVAILABLE)
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = createXhr()

    xhr.upload.addEventListener('progress', event => {
      if (!event.lengthComputable || event.total <= 0) return
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new UploadFailure(UPLOAD_ERRORS.R2_PUT_FAILURE))
      }
    })
    xhr.addEventListener('error', () => reject(new UploadFailure(UPLOAD_ERRORS.NETWORK_TIMEOUT)))
    xhr.addEventListener('timeout', () => reject(new UploadFailure(UPLOAD_ERRORS.NETWORK_TIMEOUT)))
    xhr.addEventListener('abort', () => reject(new UploadFailure(UPLOAD_ERRORS.NETWORK_TIMEOUT)))

    xhr.open('PUT', slot.uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.timeout = timeoutMs
    xhr.send(file)
  })

  return slot.publicUrl
}
