import { useUIStore } from '@/stores'
import type { Toast as ToastType } from '@/types'
import { AnimatePresence, motion } from 'framer-motion'
import React, { useEffect } from 'react'

// Icons for different toast types
const SuccessIcon = () => (
  <svg width='20' height='20' viewBox='0 0 20 20' fill='currentColor' className='text-green-500'>
    <path
      fillRule='evenodd'
      d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
      clipRule='evenodd'
    />
  </svg>
)

const ErrorIcon = () => (
  <svg width='20' height='20' viewBox='0 0 20 20' fill='currentColor' className='text-red-500'>
    <path
      fillRule='evenodd'
      d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
      clipRule='evenodd'
    />
  </svg>
)

const InfoIcon = () => (
  <svg width='20' height='20' viewBox='0 0 20 20' fill='currentColor' className='text-blue-500'>
    <path
      fillRule='evenodd'
      d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
      clipRule='evenodd'
    />
  </svg>
)

const WarningIcon = () => (
  <svg width='20' height='20' viewBox='0 0 20 20' fill='currentColor' className='text-yellow-500'>
    <path
      fillRule='evenodd'
      d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
      clipRule='evenodd'
    />
  </svg>
)

const CloseIcon = () => (
  <svg width='20' height='20' viewBox='0 0 20 20' fill='currentColor' className='text-gray-400'>
    <path
      fillRule='evenodd'
      d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
      clipRule='evenodd'
    />
  </svg>
)

const ToastComponent: React.FC<{ toast: ToastType }> = ({ toast }) => {
  const { removeToast } = useUIStore()

  // Auto-remove after duration
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        removeToast(toast.id)
      }, toast.duration || 5000)

      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, removeToast])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <SuccessIcon />
      case 'error':
        return <ErrorIcon />
      case 'warning':
        return <WarningIcon />
      case 'info':
      default:
        return <InfoIcon />
    }
  }

  const getStyles = () => {
    const base = 'p-4 rounded-lg shadow-lg backdrop-blur-md border max-w-sm w-full'
    const typeStyles = {
      success:
        'bg-green-50/90 border-green-200 text-green-900 dark:bg-green-800 dark:border-green-600 dark:text-white',
      error:
        'bg-red-50/90 border-red-200 text-red-900 dark:bg-red-800 dark:border-red-600 dark:text-white',
      warning:
        'bg-yellow-50/90 border-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:border-yellow-500 dark:text-white',
      info: 'bg-blue-50/90 border-blue-200 text-blue-900 dark:bg-blue-800 dark:border-blue-600 dark:text-white',
    }

    return `${base} ${typeStyles[toast.type]}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={getStyles()}
      role='alert'
    >
      <div className='flex items-start gap-3'>
        <div className='shrink-0 mt-0.5'>{getIcon()}</div>
        <div className='flex-1 min-w-0'>
          <p className='font-semibold text-sm'>{toast.title}</p>
          {toast.message && <p className='mt-1 text-sm opacity-90'>{toast.message}</p>}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className='mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current'
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => removeToast(toast.id)}
          aria-label='Close notification'
          className='shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current'
        >
          <CloseIcon />
        </button>
      </div>
    </motion.div>
  )
}

export const ToastContainer: React.FC = () => {
  const { toasts } = useUIStore()

  return (
    <div
      className='fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none'
      aria-live='polite'
      aria-label='Notifications'
      role='region'
    >
      <AnimatePresence>
        {toasts.map(toast => (
          <div key={toast.id} className='pointer-events-auto'>
            <ToastComponent toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
