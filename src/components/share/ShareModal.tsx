import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { X, Link2, Check, Facebook, Twitter, Mail, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { focusManager } from '@/accessibility/focusManagement'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  url?: string
  imageUrl?: string
}

export function ShareModal({
  isOpen,
  onClose,
  title = "Austin & Jordyn's Wedding",
  description = "Watch our wedding film and browse photos from our special day!",
  url = typeof window !== 'undefined' ? window.location.href : '',
}: ShareModalProps) {
  const [copied, setCopied] = useState(false)

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

  const shareOptions = [
    {
      name: 'Copy Link',
      icon: copied ? Check : Link2,
      color: 'bg-charcoal-100 text-charcoal-700',
      onClick: async () => {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-100 text-blue-700',
      onClick: () => {
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        window.open(fbUrl, '_blank', 'width=600,height=400')
      },
    },
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-sky-100 text-sky-700',
      onClick: () => {
        const text = encodeURIComponent(`${title} 💍 ${description}`)
        const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`
        window.open(twitterUrl, '_blank', 'width=600,height=400')
      },
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-gold-100 text-gold-700',
      onClick: () => {
        const subject = encodeURIComponent(title)
        const body = encodeURIComponent(`${description}\n\n${url}`)
        window.location.href = `mailto:?subject=${subject}&body=${body}`
      },
    },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gold-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-gold-600" />
                </div>
                <div>
                  <h3 id="share-modal-title" className="font-display text-xl text-charcoal-900">Share</h3>
                  <p className="text-charcoal-500 text-sm">Spread the love!</p>
                </div>
              </div>
              <button
                onClick={onClose}
                type="button"
                aria-label="Close share dialog"
                className="p-2 text-charcoal-400 hover:text-charcoal-600 hover:bg-cream-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Preview */}
              <div className="bg-cream-50 rounded-xl p-4 mb-6">
                <p className="font-medium text-charcoal-800 mb-1">{title}</p>
                <p className="text-charcoal-500 text-sm line-clamp-2">{description}</p>
                <p className="text-gold-600 text-xs mt-2 truncate">{url}</p>
              </div>

              {/* Share Options */}
              <div className="grid grid-cols-2 gap-3">
                {shareOptions.map((option) => (
                  <button
                    key={option.name}
                    onClick={option.onClick}
                    type="button"
                    aria-label={`Share via ${option.name}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]",
                      option.color
                    )}
                  >
                    <option.icon className={cn("w-5 h-5", copied && option.name === 'Copy Link' && "text-green-600")} />
                    <span className="font-medium text-sm">{option.name}</span>
                  </button>
                ))}
              </div>

              {/* Native Share (Mobile) */}
              {typeof navigator !== 'undefined' && navigator.share && (
                <Button
                  variant="secondary"
                  className="w-full mt-4"
                  onClick={() => {
                    navigator.share({
                      title,
                      text: description,
                      url,
                    })
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  More Options
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ShareModal
