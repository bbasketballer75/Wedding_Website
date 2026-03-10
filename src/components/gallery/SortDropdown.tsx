import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Clock, Heart, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortOption = 'newest' | 'oldest' | 'popular' | 'favorites'

interface SortOptionConfig {
  value: SortOption
  label: string
  icon: React.ElementType
}

const sortOptions: SortOptionConfig[] = [
  { value: 'newest', label: 'Newest First', icon: Calendar },
  { value: 'oldest', label: 'Oldest First', icon: Clock },
  { value: 'popular', label: 'Most Popular', icon: Heart },
]

interface SortDropdownProps {
  value: SortOption
  onChange: (value: SortOption) => void
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = sortOptions.find(opt => opt.value === value) || sortOptions[0]

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm",
          "bg-white border border-gold-200/60 text-charcoal-700",
          "hover:border-gold-400 transition-all"
        )}
      >
        <selectedOption.icon className="w-4 h-4 text-gold-500" />
        <span>{selectedOption.label}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gold-100 overflow-hidden z-50"
          >
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                  value === option.value
                    ? "bg-gold-50 text-gold-700"
                    : "text-charcoal-600 hover:bg-cream-50"
                )}
              >
                <option.icon className={cn(
                  "w-4 h-4",
                  value === option.value ? "text-gold-500" : "text-charcoal-400"
                )} />
                <span>{option.label}</span>
                {value === option.value && (
                  <motion.div
                    layoutId="sort-check"
                    className="ml-auto w-2 h-2 rounded-full bg-gold-500"
                  />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SortDropdown
