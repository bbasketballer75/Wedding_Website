/**
 * useGalleryDownloads — extracted from src/pages/Gallery.tsx.
 *
 * Owns download state (current photo id, batch in-flight) and exposes the
 * three download-side-effect handlers: handleDownload (single), handleDownloadPack
 * (zip batch), handleShareSelection (clipboard share link).
 *
 * Photos and queue are read-only params — the hook does not own photo data,
 * only the side effects that operate on it.
 */
import { useCallback, useState } from 'react'
import { downloadBatch, downloadFile } from '@/utils/download'
import { useToast } from '@/context/ToastContext'
import { useDownloadStore } from '@/stores/downloadStore'
import type { GalleryPhoto } from '@/components/gallery/constants'

export interface UseGalleryDownloadsResult {
  downloadingId: string | null
  isDownloadingPack: boolean
  handleDownload: (photoId: string) => Promise<void>
  handleDownloadPack: () => Promise<void>
  handleShareSelection: () => void
}

export interface UseGalleryDownloadsParams {
  photos: GalleryPhoto[]
  selectedPhotoIds: Set<string>
}

export function useGalleryDownloads({
  photos,
  selectedPhotoIds,
}: UseGalleryDownloadsParams): UseGalleryDownloadsResult {
  const { addToast } = useToast()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isDownloadingPack, setIsDownloadingPack] = useState(false)

  const handleDownload = useCallback(
    async (photoId: string) => {
      const photo = photos.find(p => p.id === photoId)
      if (!photo) return

      setDownloadingId(photoId)
      try {
        const filename = `Austin-Jordyn-Wedding-${photo.caption || photo.id}.jpg`
        await downloadFile(photo.downloadUrl || photo.url, filename)
      } catch {
        // Error handled via UI
      }
      setDownloadingId(null)
    },
    [photos]
  )

  const handleDownloadPack = useCallback(async () => {
    const queue = useDownloadStore.getState().queue
    if (queue.length === 0) return
    setIsDownloadingPack(true)
    const { setDownloading, setProgress, setProgressStatus, setPanelOpen, clearQueue } =
      useDownloadStore.getState()
    try {
      setDownloading(true)
      setProgress(0)
      setProgressStatus('Initializing downloads...')

      await downloadBatch(queue, (prog, stat) => {
        setProgress(prog)
        setProgressStatus(stat)
      })

      setTimeout(() => {
        setDownloading(false)
        setPanelOpen(false)
        clearQueue()
      }, 1000)
    } catch (error) {
      console.error(error)
      setProgressStatus(error instanceof Error ? error.message : 'Download failed')
      setProgress(0)

      setTimeout(() => {
        setDownloading(false)
      }, 3000)
    } finally {
      setIsDownloadingPack(false)
    }
  }, [])

  const handleShareSelection = useCallback(() => {
    if (selectedPhotoIds.size === 0) return
    const ids = [...selectedPhotoIds].join(',')
    const shareUrl = `${window.location.origin}/gallery?share=${ids}`
    void navigator.clipboard?.writeText(shareUrl)
    addToast('Share link copied to clipboard', 'success')
  }, [selectedPhotoIds, addToast])

  return {
    downloadingId,
    isDownloadingPack,
    handleDownload,
    handleDownloadPack,
    handleShareSelection,
  }
}
