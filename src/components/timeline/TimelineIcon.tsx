import { motion } from 'framer-motion'
import { Briefcase, Heart, Sparkles, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'

type IconType = 'meeting' | 'first-date' | 'wedding' | 'generic'

interface TimelineIconProps {
  type: IconType
  className?: string
}

const iconConfig = {
  'meeting': {
    icon: Briefcase,
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
    shadowColor: 'shadow-blue-200',
    label: 'Where it all began'
  },
  'first-date': {
    icon: Heart,
    bgColor: 'bg-rose-100',
    iconColor: 'text-rose-600',
    shadowColor: 'shadow-rose-200',
    label: 'Love sparked'
  },
  'wedding': {
    icon: CircleDot,
    bgColor: 'bg-gold-100',
    iconColor: 'text-gold-600',
    shadowColor: 'shadow-gold-200',
    label: 'Forever begins'
  },
  'generic': {
    icon: Sparkles,
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
    shadowColor: 'shadow-purple-200',
    label: 'Special moment'
  }
}

const BOUNCE_ANIMATION = {
  y: [0, -4, 0],
  transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const }
}

export function TimelineIcon({ type, className }: TimelineIconProps) {
  const config = iconConfig[type] || iconConfig.generic
  const Icon = config.icon
  const pulseOuterClass = config.bgColor.replace('100', '200')
  const pulseInnerClass = config.bgColor.replace('100', '300')

  return (
    <motion.div 
      className={cn(
        "relative w-full h-36 rounded-xl",
        className
      )}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background */}
      <div className={cn(
        "absolute inset-0 rounded-xl overflow-hidden",
        config.bgColor
      )} />

      <div className="absolute left-1/2 top-14 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className={cn(
            "absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full",
            pulseOuterClass
          )}
          animate={{
            y: BOUNCE_ANIMATION.y,
            scale: [0.92, 1.2, 0.92],
            opacity: [0.22, 0.45, 0.22]
          }}
          transition={BOUNCE_ANIMATION.transition}
        />
        <motion.div
          className={cn(
            "absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full",
            pulseInnerClass
          )}
          animate={{
            y: BOUNCE_ANIMATION.y,
            scale: [0.9, 1.08, 0.9],
            opacity: [0.28, 0.62, 0.28]
          }}
          transition={{ ...BOUNCE_ANIMATION.transition, delay: 0.15 }}
        />

        <motion.div
          className={cn(
            "relative w-14 h-14 rounded-full flex items-center justify-center",
            "bg-white"
          )}
          style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' }}
          animate={{ y: BOUNCE_ANIMATION.y }}
          transition={BOUNCE_ANIMATION.transition}
        >
          <Icon className={cn("w-7 h-7", config.iconColor)} />
          
          {/* Sparkle effects - all absolutely positioned, don't affect layout */}
          {type === 'first-date' && (
            <>
              <motion.div
                className="absolute -top-2 -right-2 text-sm"
                style={{ filter: 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.5))' }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              >
                ✨
              </motion.div>
              <motion.div
                className="absolute -bottom-2 -left-2 text-sm"
                style={{ filter: 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.5))' }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.8 }}
              >
                💕
              </motion.div>
            </>
          )}
          {type === 'wedding' && (
            <motion.div
              className="absolute -top-2 -right-2 text-sm"
              style={{ filter: 'drop-shadow(0 0 4px rgba(198, 156, 78, 0.5))' }}
              animate={{ scale: [0, 1, 0], rotate: [0, 180, 360], opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Label - at bottom */}
      <motion.div 
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-md z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-xs font-medium text-charcoal-600 whitespace-nowrap">
          {config.label}
        </span>
      </motion.div>
    </motion.div>
  )
}
