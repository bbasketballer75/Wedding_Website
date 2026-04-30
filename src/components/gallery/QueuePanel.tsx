import { X, Download, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useDownloadStore } from '@/stores/downloadStore'
import { downloadBatch } from '@/utils/download'

export default function QueuePanel() {
  const { queuedPhotos, isPanelOpen, removeFromQueue, clearQueue, setDownloading, setProgress } =
    useDownloadStore()

  if (!isPanelOpen) return null

  const handleDownloadAll = async () => {
    if (queuedPhotos.length === 0) return

    setDownloading(true)

    try {
      await downloadBatch(queuedPhotos, (current, total, status) => {
        const progress = Math.round((current / total) * 100)
        setProgress(progress)
        console.log(`Download ${current}/${total}: ${status}`)
      })
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="fixed bottom-20 right-6 z-50 w-full max-w-[320px] rounded-xl border border-cream-200 bg-white shadow-xl sm:max-w-[320px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
        <span className="font-medium text-charcoal-900">
          Download Queue ({queuedPhotos.length})
        </span>
        {queuedPhotos.length > 0 && (
          <button
            onClick={clearQueue}
            className="text-sm text-rose-500 hover:text-rose-600"
            aria-label="Clear all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Photo list */}
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {queuedPhotos.length === 0 ? (
          <div className="py-8 text-center text-sm text-charcoal-500">
            No photos selected
          </div>
        ) : (
          queuedPhotos.map(photo => (
            <div
              key={photo.id}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-cream-50"
            >
              <img
                src={photo.thumbnail || photo.url}
                alt={photo.caption || 'Photo'}
                className="h-12 w-12 rounded-lg object-cover"
              />
              <span className="flex-1 truncate text-sm text-charcoal-700">
                {photo.caption || photo.id}
              </span>
              <button
                onClick={() => removeFromQueue(photo.id)}
                className="text-charcoal-400 hover:text-rose-500"
                aria-label="Remove from queue"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer with Download All */}
      {queuedPhotos.length > 0 && (
        <div className="border-t border-cream-200 p-4">
          <button
            onClick={handleDownloadAll}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gold-600"
          >
            <Download className="h-4 w-4" />
            Download All ({queuedPhotos.length})
          </button>
        </div>
      )}
    </motion.div>
  )
}