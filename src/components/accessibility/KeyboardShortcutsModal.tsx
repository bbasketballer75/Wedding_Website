import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'
import { keyboardShortcutManager, type KeyboardShortcut } from '@/accessibility/keyboardShortcuts'

function formatKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = []
  if (shortcut.modifiers?.includes('ctrl')) parts.push('Ctrl')
  if (shortcut.modifiers?.includes('meta')) parts.push('⌘')
  if (shortcut.modifiers?.includes('alt')) parts.push('Alt')
  if (shortcut.modifiers?.includes('shift')) parts.push('Shift')

  const key = shortcut.key
  const keyLabel =
    key === 'arrowleft'
      ? '←'
      : key === 'arrowright'
        ? '→'
        : key === 'escape'
          ? 'Esc'
          : key.length === 1
            ? key.toUpperCase()
            : key.charAt(0).toUpperCase() + key.slice(1)

  parts.push(keyLabel)
  return parts.join('+')
}

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('show-keyboard-shortcuts', handler)
    return () => window.removeEventListener('show-keyboard-shortcuts', handler)
  }, [])

  // Disable the shortcut manager while modal is open so keys don't fire through
  useEffect(() => {
    if (open) {
      keyboardShortcutManager.disable()
    } else {
      keyboardShortcutManager.enable()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const shortcuts = keyboardShortcutManager.getAllShortcuts()
  const categories = Array.from(new Set(shortcuts.map(s => s.category ?? 'General')))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className='fixed inset-0 z-50 flex items-center justify-center p-4'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-charcoal-900/60 backdrop-blur-sm'
            onClick={() => setOpen(false)}
            aria-hidden='true'
          />

          {/* Panel */}
          <motion.div
            role='dialog'
            aria-modal='true'
            aria-label='Keyboard shortcuts'
            className='relative w-full max-w-lg rounded-2xl border border-gold-100 bg-white shadow-xl'
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className='flex items-center justify-between border-b border-gold-100 px-6 py-4'>
              <div className='flex items-center gap-2 text-charcoal-900'>
                <Keyboard className='h-4 w-4 text-gold-500' />
                <span className='text-sm font-semibold uppercase tracking-[0.2em]'>
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className='rounded-lg p-1.5 text-charcoal-400 transition-colors hover:bg-charcoal-50 hover:text-charcoal-900'
                aria-label='Close shortcuts'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className='max-h-[60vh] overflow-y-auto px-6 py-4 space-y-5'>
              {categories.map(category => (
                <div key={category}>
                  <p className='mb-2 text-[10px] font-medium uppercase tracking-[0.3em] text-charcoal-400'>
                    {category}
                  </p>
                  <div className='space-y-1'>
                    {shortcuts
                      .filter(s => (s.category ?? 'General') === category)
                      .map(shortcut => (
                        <div
                          key={formatKey(shortcut)}
                          className='flex items-center justify-between rounded-lg px-3 py-2 hover:bg-cream-50'
                        >
                          <span className='text-sm text-charcoal-700'>{shortcut.description}</span>
                          <kbd className='ml-4 flex-shrink-0 rounded-md border border-charcoal-200 bg-charcoal-50 px-2 py-0.5 font-mono text-xs text-charcoal-600 shadow-sm'>
                            {formatKey(shortcut)}
                          </kbd>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className='border-t border-gold-100 px-6 py-3'>
              <p className='text-center text-[11px] text-charcoal-400'>
                Press{' '}
                <kbd className='rounded border border-charcoal-200 bg-charcoal-50 px-1 font-mono text-[10px]'>
                  Esc
                </kbd>{' '}
                to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
