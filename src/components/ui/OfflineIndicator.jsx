import { swManager } from '@/utils/serviceWorker'
import { SignalSlashIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showOfflineMessage, setShowOfflineMessage] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // Listen for connection changes
    const handleConnectionChange = ({ online }) => {
      setIsOnline(online)

      if (!online) {
        setShowOfflineMessage(true)
      } else {
        // Hide offline message after a delay when coming back online
        setTimeout(() => setShowOfflineMessage(false), 2000)
      }
    }

    swManager.addListener('connection-change', handleConnectionChange)
    swManager.addListener('update-available', () => {
      setUpdateAvailable(true)
    })

    // Check initial connection
    swManager.checkConnection()

    return () => {
      swManager.removeListener('connection-change', handleConnectionChange)
    }
  }, [])

  const handleUpdateClick = async () => {
    await swManager.skipWaiting()
  }

  return (
    <>
      {/* Connection Status Indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className='fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3'
            role='status'
            aria-live='polite'
            data-testid='offline-indicator'
          >
            {' '}
            <div className='container mx-auto flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <SignalSlashIcon className='w-5 h-5' />
                <span className='font-medium'>You're offline</span>
                <span className='text-sm opacity-90'>Some features may be limited</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className='text-sm underline hover:no-underline'
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Available Banner */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className='fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-3'
            role='status'
            aria-live='polite'
          >
            <div className='container mx-auto flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <span className='font-medium'>Update available!</span>
                <span className='text-sm opacity-90'>A new version of the site is ready</span>
              </div>
              <button
                onClick={handleUpdateClick}
                className='bg-white text-green-600 px-4 py-1 rounded-full text-sm font-medium hover:bg-green-50 transition-colors'
              >
                Update Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Mode Badge (shown in corner when offline) */}
      <AnimatePresence>
        {showOfflineMessage && !isOnline && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className='fixed bottom-4 right-4 z-40 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2'
          >
            <SignalSlashIcon className='w-4 h-4' />
            <span className='text-sm font-medium'>Offline Mode</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online Status Indicator (subtle) */}
      {isOnline && (
        <div className='fixed bottom-4 right-4 z-40'>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            className='bg-green-500 w-3 h-3 rounded-full'
            title='Online'
          />
        </div>
      )}
    </>
  )
}

export default OfflineIndicator
