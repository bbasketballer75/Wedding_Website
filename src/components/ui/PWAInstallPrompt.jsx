import { DevicePhoneMobileIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInWebAppiOS = window.navigator.standalone === true
      const isInWebAppChrome = window.matchMedia('(display-mode: standalone)').matches

      if (isStandalone || isInWebAppiOS || isInWebAppChrome) {
        setIsInstalled(true)
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = e => {
      e.preventDefault()
      setDeferredPrompt(e)

      // Show prompt after a delay
      setTimeout(() => {
        setShowInstallPrompt(true)
      }, 5000)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    checkInstalled()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      // User accepted install prompt
    } else {
      // User dismissed install prompt
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isInstalled || !showInstallPrompt || sessionStorage.getItem('pwa-install-dismissed')) {
    return null
  }

  // iOS doesn't support install prompt, show instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className='fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96'
        role='dialog'
        aria-modal='true'
        aria-live='polite'
      >
        <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4'>
          <div className='flex items-start space-x-3'>
            <div className='flex-shrink-0'>
              <DevicePhoneMobileIcon className='w-6 h-6 text-gold' />
            </div>
            <div className='flex-1 min-w-0'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                Install Our Wedding App
              </h3>
              <p className='mt-1 text-sm text-gray-600 dark:text-gray-300'>
                {isIOS
                  ? 'To install: Tap the share button and then "Add to Home Screen"'
                  : 'Install our app for quick access and offline viewing'}
              </p>
              {!isIOS && (
                <div className='mt-3 flex space-x-2'>
                  <button
                    onClick={handleInstallClick}
                    className='flex-1 bg-gold text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors'
                  >
                    Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className='flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                  >
                    Not now
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className='flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              aria-label='Dismiss installation prompt'
            >
              <XMarkIcon className='w-5 h-5 text-gray-500 dark:text-gray-400' />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PWAInstallPrompt
