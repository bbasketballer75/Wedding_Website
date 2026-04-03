import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Photo {
  id: number
  src: string
  caption?: string
}

interface EngagementModalProps {
  selectedPhoto: Photo | null
  onClose: () => void
}

const EngagementModal: React.FC<EngagementModalProps> = ({ selectedPhoto, onClose }) => {
  return (
    <AnimatePresence>
      {selectedPhoto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className='fixed inset-0 bg-[#0a0a0f]/85 backdrop-blur-xl z-[9999] flex items-center justify-center cursor-zoom-out'
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className='absolute top-8 right-8 bg-white/10 border border-white/20 text-white w-11 h-11 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-md z-10 text-[1.2rem]'
          >
            ✕
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className='relative max-w-[90vw] max-h-[90vh] bg-transparent rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]'
          >
            <img
              src={selectedPhoto.src}
              alt={selectedPhoto.caption || 'Engagement Photo'}
              className='max-w-full max-h-[85vh] object-contain rounded-lg block'
            />
            {selectedPhoto.caption && (
              <div className='absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md p-3 px-6 rounded-[30px] w-max max-w-[90%] text-center border border-white/10'>
                <p className='text-(--color-gold) m-0 font-display text-[1.1rem] tracking-wider'>
                  {selectedPhoto.caption}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EngagementModal
