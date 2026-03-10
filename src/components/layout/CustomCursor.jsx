import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { colors } from '@/tokens/designTokens'

const CustomCursor = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const updateMousePosition = e => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseOver = e => {
      if (
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'A' ||
        e.target.closest('button') ||
        e.target.closest('a')
      ) {
        setIsHovering(true)
      } else {
        setIsHovering(false)
      }
    }

    window.addEventListener('mousemove', updateMousePosition)
    window.addEventListener('mouseover', handleMouseOver)

    return () => {
      window.removeEventListener('mousemove', updateMousePosition)
      window.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  return (
    <>
      <motion.div
        className='cursor'
        animate={{
          x: mousePosition.x - 16,
          y: mousePosition.y - 16,
          scale: isHovering ? 1.5 : 1,
          opacity: 1,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '32px',
          height: '32px',
          border: `2px solid ${colors.gold[500]}`,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          mixBlendMode: 'difference',
        }}
      />
      <motion.div
        className='cursor-dot'
        animate={{
          x: mousePosition.x - 4,
          y: mousePosition.y - 4,
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '8px',
          height: '8px',
          backgroundColor: colors.gold[500],
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
    </>
  )
}

export default CustomCursor
