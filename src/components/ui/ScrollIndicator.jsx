import React from 'react'
import { motion } from 'framer-motion'

const ScrollIndicator = ({ onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3, duration: 1 }}
      onClick={onClick}
      className='absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer z-30 flex flex-col items-center gap-2'
    >
      {/* Text */}
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        className='text-gold-500 text-xs tracking-[0.2em] uppercase font-body font-medium'
      >
        Scroll to explore
      </motion.span>

      {/* Animated Arrow */}
      <motion.svg
        width='24'
        height='24'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        className='text-gold-500'
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <path d='M12 5v14M5 12l7 7 7-7' />
      </motion.svg>
    </motion.div>
  )
}

export default ScrollIndicator
