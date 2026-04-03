/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  duration: number
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

interface ToastProviderProps {
  children: React.ReactNode
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000) => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, message, type, duration }])

      setTimeout(() => {
        removeToast(id)
      }, duration)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className='fixed top-6 left-1/2 -translate-x-1/2 z-10000 flex flex-col gap-2 w-full max-w-sm pointer-events-none'>
        <AnimatePresence>
          {toasts.map(toast => (
            <ToastItem key={toast.id} {...toast} onDismiss={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastItemProps {
  message: string
  type: ToastType
  onDismiss: () => void
}

const ToastItem = ({ message, type, onDismiss }: ToastItemProps) => {
  const variants = {
    initial: { opacity: 0, y: -20, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  }

  const bgColors: Record<ToastType, string> = {
    success: 'bg-[#050508]/90 border-(--color-gold) text-white',
    error: 'bg-red-950/90 border-red-500/50 text-white',
    warning: 'bg-amber-950/90 border-amber-500/50 text-white',
    info: 'bg-[#050508]/90 border-white/20 text-white',
  }

  const icons: Record<ToastType, string> = {
    success: '✨',
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
  }

  return (
    <motion.div
      layout
      variants={variants}
      initial='initial'
      animate='animate'
      exit='exit'
      onClick={onDismiss}
      className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-xl border backdrop-blur-md shadow-2xl ${bgColors[type]} cursor-pointer hover:scale-[1.02] transition-transform`}
      role='alert'
    >
      <span className='text-xl'>{icons[type]}</span>
      <p className='m-0 text-sm font-medium'>{message}</p>
    </motion.div>
  )
}
