import { motion } from 'framer-motion'
import { MapPin, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LocationMapProps {
  location: string
  type: 'town' | 'home'
  className?: string
}

export function LocationMap({ location, type, className }: LocationMapProps) {
  return (
    <motion.div 
      className={cn(
        "relative w-full h-36 rounded-xl",
        className
      )}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background - with overflow hidden for internal elements */}
      <div className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-cream-200 to-gold-100 border border-gold-300">
        {/* Map Grid Pattern */}
        <div className="absolute inset-0 opacity-40">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-gold-600)" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Decorative Roads */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
          <motion.path
            d="M0,50 Q50,30 100,50 T200,50"
            stroke="var(--color-cream-300)"
            strokeWidth="4"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />
          <motion.path
            d="M100,0 Q120,50 100,100"
            stroke="var(--color-cream-300)"
            strokeWidth="3"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </svg>
      </div>

      {/* Location Pin - positioned outside the overflow-hidden container */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: 0.5
        }}
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          {type === 'home' ? (
            <div className="relative">
              <div className="w-11 h-11 bg-gold-500 rounded-full flex items-center justify-center shadow-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gold-400"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          ) : (
            <div className="relative">
              <div className="w-11 h-11 bg-rose-500 rounded-full flex items-center justify-center shadow-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-rose-400"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Location Label */}
      <motion.div 
        className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-gold-200/50 z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <span className="text-xs font-medium text-charcoal-700 whitespace-nowrap">
          {location}
        </span>
      </motion.div>

      {/* Decorative Elements */}
      <motion.div
        className="absolute top-3 right-3 w-2 h-2 bg-gold-300 rounded-full"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
      />
      <motion.div
        className="absolute top-1/2 left-3 w-1.5 h-1.5 bg-rose-300 rounded-full"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
      />
    </motion.div>
  )
}
