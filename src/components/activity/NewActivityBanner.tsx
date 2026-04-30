import { ArrowUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { activityFeedStore } from '@/stores/activityFeedStore'

export function NewActivityBanner() {
  const newItemsCount = activityFeedStore((state) => state.newItemsCount)
  const clearNewItems = activityFeedStore((state) => state.clearNewItems)
  const prependItems = activityFeedStore((state) => state.prependItems)
  const newItems = activityFeedStore((state) => state.newItems)

  const handleClick = () => {
    prependItems(newItems)
    clearNewItems()
  }

  return (
    <AnimatePresence>
      {newItemsCount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          onClick={handleClick}
          className={cn(
            'sticky top-4 z-10 mx-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg',
            'bg-gold-500/10 text-gold-600 hover:bg-gold-500/20 transition-colors'
          )}
        >
          <span className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4" />
            {newItemsCount} new activity — click to load
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}