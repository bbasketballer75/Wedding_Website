import React from 'react'
import { motion } from 'framer-motion'

const ProposalPolaroid = ({ photo, onClick, style, aspectClass = 'aspect-4/5' }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, rotate: 1 }}
      className='w-full bg-white p-4 pb-12 shadow-[0_10px_30px_rgba(0,0,0,0.15)] cursor-pointer relative'
      style={style}
      onClick={onClick}
    >
      {photo ? (
        <>
          <div className={`overflow-hidden ${aspectClass} bg-gray-100 mb-4`}>
            <img
              src={photo.src}
              alt='The Proposal'
              className='w-full h-full object-cover'
              loading='lazy'
              style={{ objectPosition: photo.objectPosition || 'center' }}
            />
          </div>
          {photo.caption && (
            <div className='absolute bottom-3 left-0 right-0 text-center font-accent text-[1.8rem] text-(--color-text)'>
              {photo.caption}
            </div>
          )}
        </>
      ) : (
        <div className='text-center p-8 text-gray-400'>Photo not found</div>
      )}
    </motion.div>
  )
}

export default ProposalPolaroid
