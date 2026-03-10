import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export type ReactionType = 'heart' | 'cry' | 'smile' | 'clap' | 'fire'

interface Reaction {
  type: ReactionType
  emoji: string
  label: string
  count: number
  isActive?: boolean
}

export interface ReactionSummary {
  type: ReactionType
  count: number
  isActive?: boolean
}

interface ReactionPickerProps {
  reactions: ReactionSummary[]
  onReact: (type: ReactionType) => void
  showLabel?: boolean
}

const availableReactions: Omit<Reaction, 'count' | 'isActive'>[] = [
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'cry', emoji: '😢', label: 'Tears' },
  { type: 'smile', emoji: '😊', label: 'Smile' },
  { type: 'clap', emoji: '👏', label: 'Applause' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
]

export function ReactionPicker({ reactions, onReact, showLabel = false }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Merge available reactions with current counts
  const mergedReactions = availableReactions.map(ar => {
    const existing = reactions.find(r => r.type === ar.type)
    return {
      ...ar,
      count: existing?.count || 0,
      isActive: existing?.isActive || false,
    }
  })

  const activeReactions = mergedReactions.filter(r => r.count > 0)

  return (
    <div className="relative">
      {/* Display active reactions */}
      <div className="flex items-center gap-1">
        {activeReactions.map((reaction) => (
          <button
            key={reaction.type}
            type="button"
            onClick={() => onReact(reaction.type)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all",
              reaction.isActive
                ? "bg-gold-100 text-gold-800 ring-1 ring-gold-300"
                : "bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200"
            )}
            aria-label={`${reaction.label} reaction, ${reaction.count} ${reaction.count === 1 ? 'vote' : 'votes'}`}
          >
            <span>{reaction.emoji}</span>
            <span className="font-medium">{reaction.count}</span>
          </button>
        ))}

        {/* Add reaction button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsOpen(true)}
          className={cn(
            "p-1.5 rounded-full text-charcoal-400 hover:text-gold-600 hover:bg-gold-50 transition-all",
            isOpen && "text-gold-600 bg-gold-50"
          )}
          aria-label={isOpen ? 'Close reactions' : 'Add a reaction'}
          aria-expanded={isOpen}
          aria-controls="reaction-picker"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Reaction picker popup */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <button
              type="button"
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-label="Close reactions"
            />
            
            {/* Picker */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.15 }}
              id="reaction-picker"
              className="absolute bottom-full left-0 mb-2 z-50"
              onMouseLeave={() => setIsOpen(false)}
            >
              <div className="flex items-center gap-1 bg-white rounded-full shadow-lg p-2 border border-gold-100">
                {mergedReactions.map((reaction) => (
                  <button
                    key={reaction.type}
                    type="button"
                    onClick={() => {
                      onReact(reaction.type)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "group relative p-2 rounded-full text-2xl transition-all hover:scale-125 hover:-translate-y-1",
                      reaction.isActive && "bg-gold-50"
                    )}
                    title={reaction.label}
                    aria-label={reaction.label}
                  >
                    {reaction.emoji}
                    {showLabel && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-charcoal-400 whitespace-nowrap opacity-0 group-hover:opacity-100">
                        {reaction.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ReactionPicker
