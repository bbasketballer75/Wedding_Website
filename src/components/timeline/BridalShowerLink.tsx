import { motion } from 'framer-motion'
import { ExternalLink, Images, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BridalShowerLinkProps {
  className?: string
}

export function BridalShowerLink({ className }: BridalShowerLinkProps) {
  return (
    <motion.a
      href="https://share.google/WCgAknlok6WTR6woX"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative block w-full h-32 rounded-xl overflow-hidden cursor-pointer group",
        "bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100",
        "border-2 border-rose-200/50 hover:border-rose-300",
        className
      )}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-4 right-4 w-20 h-20 bg-rose-200/30 rounded-full blur-xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-4 left-4 w-16 h-16 bg-pink-200/30 rounded-full blur-xl"
          animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-2">
        {/* Icon */}
        <motion.div
          className="relative"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Images className="w-6 h-6 text-rose-500" />
          </div>
          
          {/* Sparkles */}
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
          </motion.div>
        </motion.div>

        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-medium text-charcoal-700">
            View Bridal Shower Photos
          </p>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Open in Google Photos
          </p>
        </div>

        {/* External Link Icon */}
        <motion.div
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ x: -5 }}
          whileHover={{ x: 0 }}
        >
          <ExternalLink className="w-4 h-4 text-rose-400" />
        </motion.div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.a>
  )
}
