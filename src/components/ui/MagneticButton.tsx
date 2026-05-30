import React, { useRef, useState, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

export interface MagneticButtonProps extends HTMLMotionProps<'button'> {
  children?: ReactNode
  className?: string
}

const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className,
  onClick,
  ...props
}) => {
  const ref = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return
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
