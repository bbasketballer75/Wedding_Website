import { EnvelopeIcon, LinkIcon, PhotoIcon, ShareIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { useState } from 'react'

const ShareButton = ({
  title = "Austin & Jordyn's Wedding",
  text = 'Join us in celebrating our wedding!',
  url = window.location.href,
  className = '',
  variant = 'primary', // primary, secondary, ghost
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        })
        setShowShareMenu(false)
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'AbortError') {
          setShowShareMenu(true)
        }
      }
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Copy failed - handled in UI
    }
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(`${text}\n\n${url}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleFacebookShare = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=400'
    )
  }

  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(`${text} ${url}`)
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank', 'width=600,height=400')
  }

  const handlePinterestShare = () => {
    // Use the og:image if available
    const media = encodeURIComponent(`${window.location.origin}/images/og-image.webp`)
    window.open(
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${media}&description=${encodeURIComponent(text)}`,
      '_blank',
      'width=600,height=400'
    )
  }

  const getButtonClasses = () => {
    const baseClasses =
      'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200'

    switch (variant) {
      case 'primary':
        return `${baseClasses} bg-gold text-white hover:bg-gold/90 shadow-lg hover:shadow-xl`
      case 'secondary':
        return `${baseClasses} bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700`
      case 'ghost':
        return `${baseClasses} bg-transparent text-gold hover:bg-gold/10`
      default:
        return `${baseClasses} bg-gold text-white hover:bg-gold/90`
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button onClick={handleNativeShare} className={getButtonClasses()}>
        <ShareIcon className='w-5 h-5 mr-2' />
        Share
      </button>

      {/* Share Menu */}
      {showShareMenu && (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className='fixed inset-0 z-40' onClick={() => setShowShareMenu(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className='absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50'
          >
            <div className='p-2'>
              {/* Native Share */}
              {navigator.share && (
                <button
                  onClick={handleNativeShare}
                  className='w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                >
                  <ShareIcon className='w-5 h-5 mr-3 text-gray-600 dark:text-gray-400' />
                  <span className='text-gray-900 dark:text-white'>Share...</span>
                </button>
              )}

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className='w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <LinkIcon className='w-5 h-5 mr-3 text-gray-600 dark:text-gray-400' />
                <span className='text-gray-900 dark:text-white'>
                  {copied ? 'Copied!' : 'Copy link'}
                </span>
              </button>

              {/* Email */}
              <button
                onClick={handleEmailShare}
                className='w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <EnvelopeIcon className='w-5 h-5 mr-3 text-gray-600 dark:text-gray-400' />
                <span className='text-gray-900 dark:text-white'>Email</span>
              </button>

              {/* Social Platforms */}
              <div className='border-t border-gray-200 dark:border-gray-700 my-2' />

              <button
                onClick={handleFacebookShare}
                className='w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <div className='w-5 h-5 mr-3 bg-blue-600 rounded' />
                <span className='text-gray-900 dark:text-white'>Facebook</span>
              </button>

              <button
                onClick={handleTwitterShare}
                className='w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <div className='w-5 h-5 mr-3 bg-sky-500 rounded' />
                <span className='text-gray-900 dark:text-white'>Twitter</span>
              </button>

              <button
                onClick={handlePinterestShare}
                className='w-full flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <PhotoIcon className='w-5 h-5 mr-3 text-red-600' />
                <span className='text-gray-900 dark:text-white'>Pinterest</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default ShareButton
