import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GalleryCheckboxProps {
  checked: boolean
  onChange: () => void
  indeterminate?: boolean
  ariaLabel: string
}

export default function GalleryCheckbox({
  checked,
  onChange,
  indeterminate = false,
  ariaLabel,
}: GalleryCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-150',
        checked || indeterminate
          ? 'border-gold-500 bg-gold-500 text-white'
          : 'border-white/80 bg-black/30 text-transparent hover:border-gold-300',
        (checked || indeterminate) && 'ring-2 ring-gold-400 ring-offset-1'
      )}
    >
      <CheckCircle2 className="h-4 w-4" />
    </button>
  )
}