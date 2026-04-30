import { motion } from 'framer-motion'
import { Download, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDownloadStore } from '@/stores/downloadStore'

export default function DownloadQueueFAB() {
  const { queuedPhotos, isPanelOpen, togglePanel } = useDownloadStore()

  // Always visible when items exist or panel is open
  const isVisible = queuedPhotos.length > 0 || isPanelOpen

  if (!isVisible) return null

  return (
    <motion.button
      type="button"
      onClick={togglePanel}
      aria-label={isPanelOpen ? 'Close download queue' : 'Open download queue'}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-white shadow-lg hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        duration: 0.2,
        ease: 'easeOut',
      }}
    >
      <Download className="h-5 w-5" />
      {queuedPhotos.length > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            duration: 0.3,
            ease: 'easeOut',
          }}
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-medium text-white"
        >
          {queuedPhotos.length > 99 ? '99+' : queuedPhotos.length}
        </motion.span>
      )}
      <ChevronUp
        className={cn(
          'absolute -bottom-5 h-4 w-4 text-gold-500 transition-transform duration-300',
          isPanelOpen ? 'rotate-0' : 'rotate-180'
        )}
      />
    </motion.button>
  )
}