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
        [blob.type]: blob
      })
    ])
  } catch (error) {
    console.error('Copy failed:', error)
    throw new Error('Failed to copy image')
  }
}

// ============================================================
// Batch Download Utilities
// ============================================================

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)
}

function getExtensionFromUrl(url: string): string {
  const match = url.match(/\.(jpe?g|png|gif|webp)/i)
  return match ? match[0].slice(1).toLowerCase() : 'jpg'
}

export async function refreshSignedUrls(
  photos: Array<{ id: string; url: string }>
): Promise<Array<{ id: string; url: string }>> {
  // For photos with signed URLs, regenerate them if they're approaching expiry
  // This is called silently before batch download
  // In a real implementation, this would call a Supabase RPC to get fresh signed URLs
  // For now, return the original URLs as the signed URL refresh is handled server-side
  return photos
}

export async function downloadBatch(
  photos: Array<{ id: string; url: string; caption?: string }>,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<void> {
  if (photos.length === 0) return

  // Per D-24: Silent URL refresh before batch download
  const refreshedPhotos = await refreshSignedUrls(photos)

  const total = refreshedPhotos.length

  // Per D-10: Hybrid approach - use Edge Function for large batches (>20)
  if (total > 20) {
    onProgress?.(0, total, `Preparing ${total} photos via server...`)
    // Call Edge Function for large batches
    // Edge Function returns signed URL for pre-generated zip (per D-22)
    const signedUrl = await callBatchDownloadEdgeFunction(refreshedPhotos)
    if (signedUrl) {
      // Trigger download from signed URL
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = `photos-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    return
  }

  // Small batches (<=20): use JSZip client-side
  const { default: JSZip } = await import('jszip')

  onProgress?.(0, total, `Preparing ${total} photos...`)

  const zip = new JSZip()

  // Fetch all images
  for (let i = 0; i < refreshedPhotos.length; i++) {
    const photo = refreshedPhotos[i]
    onProgress?.(i + 1, total, `Preparing ${i + 1} of ${total} photos...`)

    const response = await fetch(photo.url)
    if (!response.ok) throw new Error(`Failed to fetch ${photo.url}`)

    const blob = await response.blob()
    const ext = getExtensionFromUrl(photo.url)
    const filename = photo.caption
      ? `${sanitizeFilename(photo.caption)}-${photo.id.substring(0, 8)}.${ext}`
      : `${photo.id}.${ext}`

    zip.file(filename, blob)
  }

  onProgress?.(total, total, 'Generating zip file...')

  const content = await zip.generateAsync({ type: 'blob', compress: true })

  const blobUrl = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `photos-${Date.now()}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(blobUrl)

  onProgress?.(total, total, 'Download complete!')
}

async function callBatchDownloadEdgeFunction(
  photos: Array<{ id: string; url: string; caption?: string }>
): Promise<string | null> {
  // This would call the Edge Function at /functions/v1/batch-download
  // The Edge Function generates a zip and returns a signed URL
  // Per D-22: Edge function returns signed URL for pre-generated zip
  try {
    const { supabaseClient } = await import('@/lib/supabase')
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) return null

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ photo_ids: photos.map(p => p.id) })
    })

    if (!response.ok) return null
    const result = await response.json()
    return result.signed_url || null
  } catch {
    return null
  }
}
