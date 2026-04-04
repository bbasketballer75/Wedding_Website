import { swManager } from '@/utils/serviceWorker'
import { WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showOfflineMessage, setShowOfflineMessage] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    const handleConnectionChange = ({ online }: { online: boolean }) => {
      setIsOnline(online)

      if (!online) {
        setShowOfflineMessage(true)
      } else {
        setTimeout(() => setShowOfflineMessage(false), 2000)
      }
    }

    swManager.addListener('connection-change', handleConnectionChange)
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true)
    }

    swManager.addListener('update-available', handleUpdateAvailable)

    swManager.checkConnection()

    return () => {
      swManager.removeListener('connection-change', handleConnectionChange)
      swManager.removeListener('update-available', handleUpdateAvailable)
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
                <WifiOff className='w-5 h-5' />
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

      {/* Offline Mode Badge */}
      <AnimatePresence>
        {showOfflineMessage && !isOnline && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className='fixed bottom-4 right-4 z-40 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2'
          >
            <WifiOff className='w-4 h-4' />
            <span className='text-sm font-medium'>Offline Mode</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default OfflineIndicator
