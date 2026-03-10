import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'

const MagneticButton = ({ children, className, onClick, ...props }) => {
  const ref = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = e => {
    const { clientX, clientY } = e
    const { height, width, left, top } = ref.current.getBoundingClientRect()
    const middleX = clientX - (left + width / 2)
    const middleY = clientY - (top + height / 2)

    setPosition({ x: middleX * 0.15, y: middleY * 0.15 })
  }

  const reset = () => {
    setPosition({ x: 0, y: 0 })
  }

  const { x, y } = position

  return (
    <motion.button
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      onClick={onClick}
      animate={{ x, y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export default MagneticButton
