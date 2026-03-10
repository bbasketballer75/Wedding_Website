import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[120px] w-full rounded-2xl border border-gold-200/60 bg-white/70 backdrop-blur-sm',
          'px-5 py-4 text-sm text-charcoal-900 placeholder:text-charcoal-400',
          'transition-all duration-300',
          'focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
