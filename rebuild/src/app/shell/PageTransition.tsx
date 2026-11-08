import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Route transition wrapper. Values mirror the frozen app (opacity + 20px rise,
 * 0.5s, easing [0.16, 1, 0.3, 1]); reduced-motion handling lands with the
 * shell a11y pass.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
