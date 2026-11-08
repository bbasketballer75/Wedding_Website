/**
 * Animated family-tree connector, ported from the frozen
 * `src/components/family-tree/FamilyTree.tsx` (`ConnectionLine`).
 */
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

export interface ConnectionLineProps {
  vertical?: boolean
  animated?: boolean
}

export function ConnectionLine({ vertical = false, animated = false }: ConnectionLineProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        vertical ? 'my-1.5 h-6 w-px sm:my-2 sm:h-7' : 'mx-1.5 h-px w-12 sm:mx-2 sm:w-16'
      )}
    >
      <div className='absolute inset-0 bg-gradient-to-r from-transparent via-gold-300 to-transparent' />
      {animated && (
        <motion.div
          className='absolute inset-0 bg-gradient-to-r from-transparent via-gold-500 to-transparent'
          animate={{
            x: vertical ? 0 : ['-100%', '100%'],
            y: vertical ? ['-100%', '100%'] : 0,
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}
