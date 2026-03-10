import React from 'react'
import { motion } from 'framer-motion'

// Flying Bat
const FlyingBat = ({ delay, startX, visible = true }) => {
  if (!visible) return null

  return (
    <motion.svg
      viewBox='0 0 50 30'
      style={{ position: 'absolute', width: '40px', height: '24px', zIndex: 4 }}
      initial={{ x: startX, y: '100%', opacity: 0 }}
      animate={{
        x: [startX, startX + 150, startX + 80, startX + 250],
        y: ['80%', '25%', '45%', '-10%'],
        opacity: [0, 0.7, 0.7, 0],
      }}
      transition={{ duration: 10, delay, repeat: Infinity, repeatDelay: 7 }}
    >
      <ellipse cx='25' cy='15' rx='5' ry='4' fill='var(--color-dark-900)' />
      <motion.path
        d='M20 15 Q10 5 5 15 Q10 12 15 15 Q12 10 20 15'
        fill='var(--color-dark-900)'
        animate={{
          d: [
            'M20 15 Q10 5 5 15 Q10 12 15 15 Q12 10 20 15',
            'M20 15 Q10 18 5 15 Q10 16 15 15 Q12 17 20 15',
            'M20 15 Q10 5 5 15 Q10 12 15 15 Q12 10 20 15',
          ],
        }}
        transition={{ duration: 0.3, repeat: Infinity }}
      />
      <motion.path
        d='M30 15 Q40 5 45 15 Q40 12 35 15 Q38 10 30 15'
        fill='var(--color-dark-900)'
        animate={{
          d: [
            'M30 15 Q40 5 45 15 Q40 12 35 15 Q38 10 30 15',
            'M30 15 Q40 18 45 15 Q40 16 35 15 Q38 17 30 15',
            'M30 15 Q40 5 45 15 Q40 12 35 15 Q38 10 30 15',
          ],
        }}
        transition={{ duration: 0.3, repeat: Infinity }}
      />
    </motion.svg>
  )
}

export default FlyingBat
