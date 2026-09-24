enum UploadError {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_SLOT_UNAVAILABLE = 'UPLOAD_SLOT_UNAVAILABLE',
  R2_PUT_FAILURE = 'R2_PUT_FAILURE',
  UNKNOWN = 'UNKNOWN',
}

export default UploadError

export function isUploadError(error: unknown): error is UploadError {
  return typeof error === 'string' && Object.values(UploadError).includes(error as UploadError)
}
