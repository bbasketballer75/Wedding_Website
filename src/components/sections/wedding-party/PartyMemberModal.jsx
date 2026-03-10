import React, { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactDOM from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'

const PartyMemberModal = ({ selectedMember, onClose }) => {
  const modalRef = useRef()

  if (typeof document === 'undefined') return null

  return ReactDOM.createPortal(
    <AnimatePresence>
      {selectedMember && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className='fixed inset-0 z-[9999] bg-dark-950/85 backdrop-blur-md flex items-center justify-center p-8'
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className='glass-panel bg-cream-50/95 border-gold-500/20 rounded-[2.5rem] max-w-[600px] w-full overflow-hidden relative shadow-glass'
          >
            {/* Close Button - Optimized Touch Target (44px) */}
            <button
              onClick={onClose}
              aria-label='Close'
              className='absolute top-6 right-6 w-11 h-11 rounded-full bg-black/5 flex items-center justify-center cursor-pointer z-10 text-dark-500 hover:bg-black/10 hover:scale-110 transition-all duration-300'
            >
              <XMarkIcon className='w-6 h-6' />
            </button>

            {/* Modal Content */}
            <div className='p-12 px-10'>
              <div className='text-center mb-10'>
                <div className='w-[140px] h-[140px] mx-auto mb-8 relative'>
                  {/* SVG Container for Perfect Masking & Zoom */}
                  <svg
                    className='w-full h-full drop-shadow-md'
                    viewBox='0 0 100 100'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <defs>
                      <clipPath id={`modalClip-${selectedMember.id || 'modal'}`}>
                        <circle cx='50' cy='50' r='48' />
                      </clipPath>
                    </defs>

                    {/* Background Circle */}
                    <circle cx='50' cy='50' r='49' fill='#e5e5e5' />

                    {/* The Image - Scaled to 135% to aggressively remove baked-in borders */}
                    {selectedMember.image ? (
                      <image
                        href={selectedMember.image}
                        x='-4'
                        y='-2'
                        width='108'
                        height='108'
                        preserveAspectRatio='xMidYMid slice'
                        clipPath={`url(#modalClip-${selectedMember.id || 'modal'})`}
                      />
                    ) : (
                      <text
                        x='50'
                        y='50'
                        textAnchor='middle'
                        dy='.3em'
                        fontSize='40'
                        fill='rgba(212,175,55,0.4)'
                        fontFamily='serif'
                      >
                        {selectedMember.name.charAt(0)}
                      </text>
                    )}

                    {/* The Ring - Matches PersonCard style */}
                    <circle
                      cx='50'
                      cy='50'
                      r='48'
                      fill='none'
                      stroke={selectedMember.side === 'groom' ? '#d4af37' : '#f9dbe2'}
                      strokeWidth='3'
                      vectorEffect='non-scaling-stroke'
                    />
                  </svg>
                </div>

                <h3 className='font-display text-5xl mb-3 text-dark-900 font-light tracking-tight'>
                  {selectedMember.name}
                </h3>
                <p className='text-gold-600 uppercase tracking-[0.25em] text-sm font-medium'>
                  {selectedMember.role}
                </p>
              </div>

              <div className='bg-white/40 p-8 rounded-3xl relative border border-white/40'>
                <div className='absolute top-4 left-6 font-serif text-[5rem] text-gold-500/10 leading-none'>
                  “
                </div>
                <p className='text-dark-600 leading-relaxed text-lg relative z-1 text-center font-light italic'>
                  {selectedMember.bio}
                </p>
              </div>

              {/* Relationship/Connection Tag */}
              <div className='mt-8 flex justify-center'>
                <span
                  className={`px-6 py-2 rounded-full text-xs uppercase tracking-widest font-medium border ${
                    selectedMember.side === 'groom'
                      ? 'bg-slate-100/50 text-slate-600 border-slate-200'
                      : 'bg-rose-50/50 text-rose-600 border-rose-100'
                  }`}
                >
                  {selectedMember.relation}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default PartyMemberModal
