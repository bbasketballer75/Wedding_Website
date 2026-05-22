import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDownloadStore } from '@/stores/downloadStore'
import { Loader2 } from 'lucide-react'

export const ProgressModal: React.FC = () => {
  const isDownloading = useDownloadStore(state => state.isDownloading)
  const progress = useDownloadStore(state => state.progress)
  const progressStatus = useDownloadStore(state => state.progressStatus)

  return (
    <AnimatePresence>
      {isDownloading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-md p-6 mx-4 text-center border bg-cream-50/95 border-gold-500/30 rounded-xl shadow-2xl"
          >
            <div className="flex justify-center mb-4">
              <Loader2 className="w-10 h-10 animate-spin text-gold-500" />
            </div>
            
            <h3 className="font-serif text-2xl font-semibold text-charcoal-900 mb-2">
              Preparing Your Gallery Pack
            </h3>
            
            <p className="text-sm text-charcoal-600 mb-6 font-sans">
              {progressStatus || 'Starting your download...'}
            </p>

            {/* Progress Bar Container */}
            <div className="w-full h-2 bg-charcoal-400/10 rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-gold-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>

            <div className="text-right text-xs font-semibold text-gold-600 font-sans">
              {Math.round(progress)}%
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
