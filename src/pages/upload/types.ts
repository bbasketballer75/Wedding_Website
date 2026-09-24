export interface UploadingFile {
  id: string
  file: File
  status: 'uploading' | 'complete' | 'error'
  preview?: string
  publicUrl?: string
  errorMessage?: string
  progress?: number // 0-100
}

export interface StoredUploadMetadata {
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
