/**
 * Frozen upload error taxonomy (`src/pages/upload/uploadErrors.ts`) + the exact
 * per-cause user messages (`useUploadQueue.ts`). Distinct slots exist so the UI
 * never collapses timeout / slot / R2 / size failures into one vague message.
 */

export const UPLOAD_ERRORS = {
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UPLOAD_SLOT_UNAVAILABLE: 'UPLOAD_SLOT_UNAVAILABLE',
  R2_PUT_FAILURE: 'R2_PUT_FAILURE',
  UNKNOWN: 'UNKNOWN',
} as const

export type UploadErrorType = (typeof UPLOAD_ERRORS)[keyof typeof UPLOAD_ERRORS]

export const UPLOAD_ERROR_MESSAGES: Record<UploadErrorType, string> = {
  NETWORK_TIMEOUT: 'Connection timed out — check your internet and try again',
  FILE_TOO_LARGE: 'This file exceeds the 500MB limit and was skipped.',
  UPLOAD_SLOT_UNAVAILABLE: 'Upload slot unavailable — try again in a moment',
  R2_PUT_FAILURE: "This one didn't make it through — try uploading again",
  UNKNOWN: 'Something went wrong — try again or skip this file',
}

export function isUploadError(error: unknown): error is UploadErrorType {
  return (
    typeof error === 'string' && Object.values(UPLOAD_ERRORS).includes(error as UploadErrorType)
  )
}

/**
 * Typed transport failure. The frozen implementation threw/rejected bare error
 * strings; the rebuild keeps the same distinct taxonomy but as an Error subclass
 * so it is safe to throw/reject (and carries `type` for assertions/telemetry).
 */
export class UploadFailure extends Error {
  readonly type: UploadErrorType

  constructor(type: UploadErrorType) {
    super(UPLOAD_ERROR_MESSAGES[type])
    this.name = 'UploadFailure'
    this.type = type
  }
}

/** Map a rejected value from the upload pipeline onto its distinct message. */
export function resolveUploadErrorMessage(error: unknown): string {
  if (isUploadError(error)) return UPLOAD_ERROR_MESSAGES[error]
  if (error instanceof UploadFailure) return UPLOAD_ERROR_MESSAGES[error.type]
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name
    if (name === 'AbortError' || name === 'TimeoutError') {
      return UPLOAD_ERROR_MESSAGES.NETWORK_TIMEOUT
    }
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('timeout') || message.includes('network')) {
      return UPLOAD_ERROR_MESSAGES.NETWORK_TIMEOUT
    }
  }
  return UPLOAD_ERROR_MESSAGES.UNKNOWN
}
