import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LightningEffectProps {
  isActive?: boolean
}

const LightningEffect: React.FC<LightningEffectProps> = ({ isActive = true }) => {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!isActive) return

    let timeoutId: NodeJS.Timeout

    // Random lightning flashes similar to a real storm
    const triggerLightning = () => {
      setFlash(true)
      setTimeout(() => setFlash(false), 150) // Quick flash

      // Sometimes double flash
      if (Math.random() > 0.7) {
        setTimeout(() => {
          setFlash(true)
          setTimeout(() => setFlash(false), 50)
        }, 300)
      }

      // Schedule next flash
      const nextFlash = Math.random() * 8000 + 4000 // Between 4s and 12s
      timeoutId = setTimeout(triggerLightning, nextFlash)
    }

    timeoutId = setTimeout(triggerLightning, 2000)

    return () => clearTimeout(timeoutId)
  }, [isActive])

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key="lightning-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className='absolute inset-0 bg-white z-[5] pointer-events-none mix-blend-overlay'
        />
      )}
    </AnimatePresence>
  )
}

export default LightningEffect
