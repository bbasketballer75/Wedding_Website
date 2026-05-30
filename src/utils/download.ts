import JSZip from 'jszip'
import type { QueuedPhoto } from '@/stores/downloadStore'

/**
 * Download a file from URL
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('Download failed:', error)
    throw new Error('Failed to download file')
  }
}

/**
 * Download with progress tracking
 */
export async function downloadWithProgress(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const response = await fetch(url)
    const contentLength = parseInt(response.headers.get('content-length') || '0')

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const chunks: BlobPart[] = []
    let receivedLength = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value.slice())
      receivedLength += value.length

      if (contentLength && onProgress) {
        onProgress((receivedLength / contentLength) * 100)
      }
    }

    // Combine chunks
    const blob = new Blob(chunks)
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('Download failed:', error)
    throw new Error('Failed to download file')
  }
}

/**
 * Copy image to clipboard
 */
export async function copyImageToClipboard(url: string): Promise<void> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ])
  } catch (error) {
    console.error('Copy failed:', error)
    throw new Error('Failed to copy image')
  }
}

/**
 * Orchestrate hybrid batch download (zipping client-side vs server-side)
 */
export async function downloadBatch(
  photos: QueuedPhoto[],
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  if (!photos || photos.length === 0) {
    throw new Error('No photos provided for batch download')
  }

  // 1. Small batches (<= 20 photos): Zip completely on the client side
  if (photos.length <= 20) {
    try {
      onProgress?.(0, `Starting batch download of ${photos.length} photos...`)

      let completedCount = 0
      const blobs = await Promise.all(
        photos.map(async photo => {
          try {
            const url = photo.downloadUrl || photo.url
            const response = await fetch(url)
            if (!response.ok) throw new Error('Fetch failed')

            const blob = await response.blob()
            completedCount++

            // Allocate 0% to 50% progress for downloading photo blobs
            const downloadProgress = (completedCount / photos.length) * 50
            onProgress?.(
              downloadProgress,
              `Downloaded photo ${completedCount} of ${photos.length}...`
            )
            return { blob, photo }
          } catch (err) {
            console.error(`Failed to fetch photo ${photo.id}:`, err)
            return null
          }
        })
      )

      const successfulBlobs = blobs.filter(
        (b): b is { blob: Blob; photo: QueuedPhoto } => b !== null
      )

      if (successfulBlobs.length === 0) {
        throw new Error('Failed to download any photos in the batch')
      }

      onProgress?.(55, 'Preparing zip compiler...')

      const zip = new JSZip()
      const folder = zip.folder('theporadas-photos')
      if (!folder) {
        throw new Error('Failed to initialize zip directory structure')
      }

      successfulBlobs.forEach((item, index) => {
        const url = item.photo.downloadUrl || item.photo.url
        const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg'
        // Sanitize captions for file safety
        const name = item.photo.caption
          ? `${String(index + 1).padStart(2, '0')}-${item.photo.caption.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}.${ext}`
          : `photo-${String(index + 1).padStart(2, '0')}.${ext}`

        folder.file(name, item.blob)
      })

      // Allocate 60% to 95% progress for zip compilation
      const zipContent = await zip.generateAsync({ type: 'blob' }, metadata => {
        const zipProgress = 60 + (metadata.percent / 100) * 35
        onProgress?.(zipProgress, `Compiling zip package (${Math.round(metadata.percent)}%)...`)
      })

      onProgress?.(98, 'Triggering browser file download...')

      const blobUrl = window.URL.createObjectURL(zipContent)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = 'theporadas-photos.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      onProgress?.(100, 'All downloads finished successfully!')
    } catch (error) {
      console.error('Client-side batch download failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Client-side batch download failed')
    }
  }
  // 2. Large batches (21 to 50 photos): Zip on Netlify Server Function
  else {
    try {
      onProgress?.(5, 'Contacting zip compilation server...')

      const response = await fetch('/.netlify/functions/download-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds: photos.map(p => p.id),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Server-side zip packaging failed')
      }

      onProgress?.(10, 'Receiving zip stream from server...')

      const contentLength = parseInt(response.headers.get('content-length') || '0')
      if (!response.body) {
        throw new Error('No readable data stream received from zip server')
      }

      const reader = response.body.getReader()
      const chunks: BlobPart[] = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value.slice())
        receivedLength += value.length

        if (contentLength) {
          const percent = (receivedLength / contentLength) * 100
          // Allocate 10% to 95% progress for stream reading
          const streamProgress = 10 + (percent / 100) * 85
          onProgress?.(streamProgress, `Downloading zipped archive (${Math.round(percent)}%)...`)
        } else {
          onProgress?.(50, 'Downloading zipped archive...')
        }
      }

      onProgress?.(98, 'Triggering browser file download...')

      const zipBlob = new Blob(chunks, { type: 'application/zip' })
      const blobUrl = window.URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = 'theporadas-photos.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      onProgress?.(100, 'Server-zipped downloads finished successfully!')
    } catch (error) {
      console.error('Server-side batch download failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Server-side batch download failed')
    }
  }
}
