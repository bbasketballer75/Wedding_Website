/**
 * Confirmation dialog for moderation actions, ported from the frozen
 * `src/components/admin/ModerationConfirmDialog.tsx` markup/animation.
 *
 * A11Y DELTA (required by W7-1): the frozen dialog had no dialog semantics, no
 * Escape handling and no focus management. This port adds `role='dialog'`,
 * `aria-modal`, labelled heading, Escape-to-close, a focus trap and focus
 * restoration to the trigger — without changing the visible copy/classes.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'

export interface AdminConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger'
  confirmDisabled?: boolean
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function AdminConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  confirmDisabled = false,
  children,
}: AdminConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement
    previouslyFocusedRef.current =
      previouslyFocused instanceof HTMLElement ? previouslyFocused : null

    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      const trigger = previouslyFocusedRef.current
      if (trigger && trigger.isConnected) trigger.focus()
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm'
            aria-hidden='true'
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className='fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2'
          >
            <div
              ref={dialogRef}
              role='dialog'
              aria-modal='true'
              aria-labelledby={titleId}
              className='rounded-2xl border border-gold-200 bg-white p-6 shadow-xl'
            >
              <div className='mb-4 flex items-center justify-between'>
                <h2 id={titleId} className='font-display text-xl text-charcoal-900'>
                  {title}
                </h2>
                <button
                  type='button'
                  onClick={onClose}
                  aria-label='Close dialog'
                  className='rounded-full p-1 text-charcoal-400 hover:text-charcoal-600 hover:bg-charcoal-100'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='mb-6'>{children}</div>

              <div className='flex justify-end gap-3'>
                <Button variant='secondary' onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
                  onClick={onConfirm}
                  disabled={confirmDisabled}
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
