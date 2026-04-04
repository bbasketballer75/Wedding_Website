import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { publicNavLinks } from './publicNav'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !panelRef.current) return

    const panel = panelRef.current
    const focusableSelectors =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors))

    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        if (focusableElements.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className='fixed inset-0 z-[9998] bg-dark-950/20 backdrop-blur-sm'
          />

          {/* Menu Panel */}
          <motion.div
            ref={panelRef}
            role='dialog'
            aria-modal='true'
            aria-label='Navigation menu'
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            className='fixed top-0 right-0 bottom-0 w-[85%] max-w-[400px] z-[9999] p-8 overflow-auto shadow-2xl bg-cream-50 border-l border-gold-500/10'
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label='Close menu'
              className='absolute top-6 right-6 bg-transparent border-none text-dark-700 text-4xl cursor-pointer p-0 leading-none hover:text-gold-600 transition-colors'
            >
              ×
            </button>

            {/* Brand */}
            <div className='my-12 text-center'>
              <Link to='/' onClick={onClose} className='no-underline'>
                <div className='font-display text-4xl font-medium text-gold-500 tracking-[0.4em]'>
                  A&J
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav data-testid='mobile-nav' className='flex flex-col gap-2'>
              {publicNavLinks.map((link, index) => {
                const isActive = location.pathname === link.path
                return (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.1 }}
                  >
                    <Link
                      to={link.path}
                      onClick={onClose}
                      className={`
                        block w-full border-b border-gold-500/5 font-body text-lg font-normal uppercase tracking-[0.3em] py-5 text-left transition-all duration-300 no-underline
                        ${isActive ? 'text-gold-600 pl-4' : 'text-dark-700/70 hover:text-gold-600'}
                      `}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                )
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default MobileMenu
