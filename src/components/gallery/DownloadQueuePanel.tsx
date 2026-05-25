import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDownloadStore } from '@/stores/downloadStore'
import { downloadBatch } from '@/utils/download'
import { Download, X, Trash2 } from 'lucide-react'

export const DownloadQueuePanel: React.FC = () => {
  const {
    queue,
    isPanelOpen,
    setPanelOpen,
    togglePanel,
    clearQueue,
    removeFromQueue,
    setDownloading,
    setProgress,
    setProgressStatus,
  } = useDownloadStore()

  if (queue.length === 0) {
    return null
  }

  const handleDownloadAll = async () => {
    try {
      setDownloading(true)
      setProgress(0)
      setProgressStatus('Initializing downloads...')

      await downloadBatch(queue, (prog, stat) => {
        setProgress(prog)
        setProgressStatus(stat)
      })

      // Complete!
      setTimeout(() => {
        setDownloading(false)
        setPanelOpen(false)
        clearQueue()
      }, 1000)
    } catch (error) {
      console.error(error)
      setProgressStatus(error instanceof Error ? error.message : 'Download failed')
      setProgress(0)

      // Keep modal open briefly to show error, then close
      setTimeout(() => {
        setDownloading(false)
      }, 3000)
    }
  }

  const handleClearQueue = () => {
    if (window.confirm('Are you sure you want to remove all photos from your download queue?')) {
      clearQueue()
      setPanelOpen(false)
    }
  }

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <AnimatePresence>
        {!isPanelOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={togglePanel}
            className='fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-5 py-3.5 bg-gold-500 hover:bg-gold-600 active:scale-95 text-cream-50 font-sans font-semibold rounded-full shadow-lg shadow-gold/30 border border-gold-600/25 transition-all duration-300 group'
          >
            <Download className='w-5 h-5 animate-pulse group-hover:scale-110 transition-transform duration-300' />
            <span>Download Queue</span>
            <span className='flex items-center justify-center min-w-5 h-5 px-1.5 bg-cream-50 text-gold-600 rounded-full text-xs font-bold group-hover:bg-cream-100 transition-colors'>
              {queue.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer / Slide-up Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            {/* Backdrop on mobile for better focus */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
              className='fixed inset-0 z-40 bg-charcoal-900/20 backdrop-blur-[1px] md:hidden'
            />

            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className='fixed bottom-0 left-0 right-0 md:left-auto md:right-6 md:bottom-6 z-50 w-full md:w-96 max-h-[85vh] md:max-h-[550px] bg-cream-100/95 backdrop-blur-md border border-t border-gold-500/20 md:border md:rounded-2xl shadow-2xl flex flex-col overflow-hidden'
            >
              {/* Header */}
              <div className='flex items-center justify-between px-5 py-4 border-b border-gold-500/10'>
                <div className='flex items-center gap-2'>
                  <Download className='w-5 h-5 text-gold-600' />
                  <h3 className='font-serif text-lg font-semibold text-charcoal-900'>
                    Download Queue
                  </h3>
                  <span className='px-2 py-0.5 bg-gold-500/10 text-gold-700 rounded-full text-xs font-semibold'>
                    {queue.length}/50
                  </span>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className='p-1 hover:bg-gold-500/10 rounded-full text-charcoal-600 hover:text-charcoal-900 transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              {/* Scrollable list of thumbnails */}
              <div className='flex-1 overflow-y-auto p-4 space-y-3 min-h-32'>
                {queue.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className='flex items-center justify-between p-2 bg-cream-50/60 hover:bg-cream-50 border border-gold-500/5 hover:border-gold-500/10 rounded-xl transition-all duration-300'
                  >
                    <div className='flex items-center gap-3'>
                      <img
                        src={photo.thumbnail}
                        alt={photo.caption || 'Queue Thumbnail'}
                        className='w-12 h-12 object-cover rounded-lg border border-gold-500/10 bg-charcoal-800'
                      />
                      <div className='text-left'>
                        <p className='text-xs font-semibold text-charcoal-900 font-sans'>
                          Photo #{index + 1}
                        </p>
                        {photo.caption ? (
                          <p className='text-[10px] text-charcoal-500 font-sans truncate max-w-[160px]'>
                            {photo.caption}
                          </p>
                        ) : (
                          <p className='text-[10px] text-charcoal-400 font-sans italic'>
                            No caption
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromQueue(photo.id)}
                      className='p-2 text-charcoal-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-colors'
                      title='Remove from queue'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Footer Actions */}
              <div className='p-4 bg-cream-50/80 border-t border-gold-500/10 space-y-2'>
                <button
                  onClick={handleDownloadAll}
                  className='w-full flex items-center justify-center gap-2 py-3 bg-gold-500 hover:bg-gold-600 active:scale-[0.99] text-cream-50 font-sans font-semibold rounded-xl shadow-md transition-all duration-300'
                >
                  <Download className='w-4 h-4' />
                  <span>Download Batch Zip</span>
                </button>
                <button
                  onClick={handleClearQueue}
                  className='w-full flex items-center justify-center gap-1.5 py-2.5 border border-transparent hover:bg-red-500/5 text-charcoal-500 hover:text-red-600 font-sans text-xs font-semibold rounded-xl transition-all duration-300'
                >
                  <Trash2 className='w-3.5 h-3.5' />
                  <span>Clear Queue</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
