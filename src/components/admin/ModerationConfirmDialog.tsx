import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ModerationConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger'
  children: React.ReactNode
}

export function ModerationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  children,
}: ModerationConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-2xl border border-gold-200 bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl text-charcoal-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-charcoal-400 hover:text-charcoal-600 hover:bg-charcoal-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                {children}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}