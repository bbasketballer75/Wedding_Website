import { useCallback, useState } from 'react'
import {
  buildSelectionShareUrl,
  planBatchDownload,
  runBatchDownloadStub,
  type BatchDownloadPlan,
  type QueuedPhoto,
} from './data'

export type GalleryToastKind = 'success' | 'warning' | 'error'

export interface GalleryDownloadsOptions {
  queue: QueuedPhoto[]
  /** Injectable for tests; defaults to the browser origin. */
  origin?: string
  addToast: (message: string, kind?: GalleryToastKind) => void
}

export interface GalleryDownloadsResult {
  downloadingId: string | null
  isDownloadingPack: boolean
  progress: number
  progressStatus: string
  batchPlan: BatchDownloadPlan | null
  handleDownload: (photoId: string) => Promise<void>
  handleDownloadPack: () => Promise<BatchDownloadPlan | null>
  handleShareSelection: () => string | null
}

/**
 * Port of the frozen `useGalleryDownloads`: single-photo download state, batch
 * download plan/state and the clipboard share link.
 *
 * TODO(Wave3/Wave8): the batch executor only drives progress state in Wave 5 —
 * byte packaging needs the `download-pack` function contract or an approved
 * client zip dependency (frozen used jszip). The strategy split (client <=20,
 * server 21–50) is implemented and unit-tested.
 */
export function useGalleryDownloads({
  queue,
  origin,
  addToast,
}: GalleryDownloadsOptions): GalleryDownloadsResult {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isDownloadingPack, setIsDownloadingPack] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [batchPlan, setBatchPlan] = useState<BatchDownloadPlan | null>(null)

  const handleDownload = useCallback(async (photoId: string) => {
    setDownloadingId(photoId)
    try {
      // TODO(Wave3): bytes come from the media layer; Wave 5 tracks UI state only.
      await Promise.resolve()
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const handleDownloadPack = useCallback(async (): Promise<BatchDownloadPlan | null> => {
    const plan = planBatchDownload(queue.map(entry => entry.id))
    setBatchPlan(plan)
    if (plan.strategy === 'none') {
      addToast('Select between 1 and 50 photos to download.', 'warning')
      return plan
    }
    setIsDownloadingPack(true)
    setProgress(0)
    setProgressStatus('Initializing downloads...')
    try {
      await runBatchDownloadStub(plan, (nextProgress, status) => {
        setProgress(nextProgress)
        setProgressStatus(status)
      })
    } catch (error) {
      setProgressStatus(error instanceof Error ? error.message : 'Download failed')
      addToast(error instanceof Error ? error.message : 'Download failed', 'error')
    } finally {
      setIsDownloadingPack(false)
    }
    return plan
  }, [addToast, queue])

  const handleShareSelection = useCallback((): string | null => {
    if (queue.length === 0) return null
    const shareOrigin = origin ?? window.location.origin
    const url = buildSelectionShareUrl(
      shareOrigin,
      queue.map(entry => entry.id)
    )
    void navigator.clipboard?.writeText(url)
    addToast('Share link copied to clipboard', 'success')
    return url
  }, [addToast, origin, queue])

  return {
    downloadingId,
    isDownloadingPack,
    progress,
    progressStatus,
    batchPlan,
    handleDownload,
    handleDownloadPack,
    handleShareSelection,
  }
}
