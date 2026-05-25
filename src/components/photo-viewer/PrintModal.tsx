import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, Check, ExternalLink, Sparkles } from 'lucide-react'
import { focusManager } from '@/accessibility/focusManagement'
import { cn } from '@/lib/utils'

interface PrintModalProps {
  isOpen: boolean
  onClose: () => void
  photoUrl: string
}

export function PrintModal({ isOpen, onClose, photoUrl }: PrintModalProps) {
  const [copiedProvider, setCopiedProvider] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !containerRef.current) return
    const previousFocus = document.activeElement as HTMLElement

    const release = focusManager.trapFocus(containerRef.current)

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)

    return () => {
      release()
      previousFocus?.focus()
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleProviderSelect = async (providerName: string, url: string) => {
    try {
      // 1. Copy the photo URL to the clipboard
      await navigator.clipboard.writeText(photoUrl)
      setCopiedProvider(providerName)

      // 2. Open the print provider in a new tab/window
      setTimeout(() => {
        window.open(url, '_blank', 'noopener,noreferrer')
      }, 800)

      // 3. Clear toast after 4 seconds
      setTimeout(() => {
        setCopiedProvider(null)
      }, 4000)
    } catch (err) {
      console.error('Failed to copy print URL: ', err)
    }
  }

  const providers = [
    {
      id: 'artifact',
      name: 'Artifact Uprising',
      description: 'Artisan quality matte prints, brass mounts, and custom wedding albums.',
      url: 'https://www.artifactuprising.com/',
      badge: 'Premium Artisan',
      accentColor: 'border-gold-400/30 hover:border-gold-400 bg-white/5 hover:bg-gold-500/10',
    },
    {
      id: 'shutterfly',
      name: 'Shutterfly',
      description:
        'Affordable classic prints, large canvas wraps, and custom personalized photo books.',
      url: 'https://www.shutterfly.com/',
      badge: 'Classic Prints',
      accentColor: 'border-white/10 hover:border-gold-400 bg-white/5 hover:bg-gold-500/10',
    },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            role='dialog'
            aria-modal='true'
            aria-labelledby='print-modal-title'
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className='relative bg-charcoal-900/90 border border-white/10 backdrop-blur-md rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 sm:p-8'
            onClick={e => e.stopPropagation()}
          >
            {/* Ambient Background Glows */}
            <div className='absolute -right-16 -top-16 h-36 w-36 rounded-full bg-gold-500/10 blur-3xl pointer-events-none' />
            <div className='absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-gold-400/5 blur-3xl pointer-events-none' />

            {/* Header */}
            <div className='flex items-center justify-between pb-6 border-b border-white/5'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gold-500/10 border border-gold-400/30 rounded-full flex items-center justify-center text-gold-400'>
                  <Printer className='w-5 h-5' />
                </div>
                <div>
                  <h3 id='print-modal-title' className='font-serif text-2xl text-white'>
                    Order Prints
                  </h3>
                  <p className='text-white/60 text-sm mt-0.5'>
                    Transform digital wedding memories into physical keepsakes
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                type='button'
                aria-label='Close print dialog'
                className='p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            {/* Content */}
            <div className='mt-6 space-y-6'>
              {/* Photo Preview Mini-Card */}
              <div className='flex items-center gap-4 bg-white/5 border border-white/5 rounded-xl p-3'>
                <img
                  src={photoUrl}
                  alt='Selected print preview'
                  className='w-16 h-16 object-cover rounded-lg border border-white/10 shadow-inner'
                />
                <div className='flex-1 min-w-0'>
                  <span className='flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-gold-400'>
                    <Sparkles className='w-3 h-3' /> Selected Photo
                  </span>
                  <p className='text-white/40 text-xs truncate mt-1 break-all select-all font-mono'>
                    {photoUrl}
                  </p>
                </div>
              </div>

              {/* Providers Grid */}
              <div className='grid gap-4 sm:grid-cols-2'>
                {providers.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderSelect(provider.name, provider.url)}
                    type='button'
                    className={cn(
                      'flex flex-col text-left p-5 rounded-xl border transition-all cursor-pointer group relative overflow-hidden',
                      provider.accentColor
                    )}
                  >
                    {/* Badge */}
                    <span className='absolute top-3 right-3 text-[9px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-gold-500/10 text-gold-400 border border-gold-400/20 rounded-full'>
                      {provider.badge}
                    </span>

                    <h4 className='font-serif text-lg text-white group-hover:text-gold-400 transition-colors mt-2'>
                      {provider.name}
                    </h4>
                    <p className='text-white/60 text-xs leading-relaxed mt-2 flex-1'>
                      {provider.description}
                    </p>

                    <span className='mt-4 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-gold-400 uppercase'>
                      Select Provider
                      <ExternalLink className='w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform' />
                    </span>
                  </button>
                ))}
              </div>

              {/* Copy Status Overlay Banner */}
              <AnimatePresence>
                {copiedProvider ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    className='rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center'
                  >
                    <div className='flex items-center justify-center gap-2 text-green-400 font-medium text-sm'>
                      <Check className='w-4 h-4' />
                      <span>Direct high-res image link copied!</span>
                    </div>
                    <p className='text-white/70 text-xs mt-2 leading-relaxed max-w-md mx-auto'>
                      Opening <strong>{copiedProvider}</strong> in a new tab. You can paste this URL
                      (using{' '}
                      <kbd className='bg-white/10 px-1 py-0.5 rounded text-[10px]'>Ctrl+V</kbd> or{' '}
                      <kbd className='bg-white/10 px-1 py-0.5 rounded text-[10px]'>⌘+V</kbd>)
                      directly into their photo uploader!
                    </p>
                  </motion.div>
                ) : (
                  <div className='rounded-xl border border-white/5 bg-white/5 p-4 flex gap-3 text-white/50 text-xs leading-relaxed'>
                    <span className='text-gold-400 shrink-0 select-none'>💡 How it works:</span>
                    <p>
                      External print sites cannot fetch private photos directly. When you select a
                      provider, we copy this photo's direct high-resolution URL to your clipboard.
                      Once their website opens, simply paste the clipboard link into their image
                      uploader!
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PrintModal
