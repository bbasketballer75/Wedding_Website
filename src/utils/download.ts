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
