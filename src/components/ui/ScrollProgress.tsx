import React from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'

const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll()

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'var(--gradient-gold)',
        transformOrigin: '0%',
        zIndex: 9999,
        scaleX,
      }}
    />
  )
}

export default ScrollProgress
