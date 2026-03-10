import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-full border border-gold-200/60 bg-white/70 backdrop-blur-sm',
          'px-5 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400',
          'transition-all duration-300',
          'focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
