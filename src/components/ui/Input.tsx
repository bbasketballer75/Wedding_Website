import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  hint?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, hint, id, ...props }, ref) => {
    const hintId = hint && id ? `${id}-hint` : undefined
    const errorId = error && id ? `${id}-error` : undefined
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

    return (
      <div className="flex flex-col gap-1.5">
        <input
          id={id}
          type={type}
          className={cn(
            'flex h-11 w-full rounded-full border bg-white/70 backdrop-blur-sm',
            'px-5 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400',
            'transition-all duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-rose-400 focus-visible:ring-rose-400'
              : 'border-gold-200/60',
            className
          )}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          ref={ref}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="px-2 text-xs text-charcoal-500">{hint}</p>
        )}
        {error && (
          <p id={errorId} role="alert" className="px-2 text-xs text-rose-500">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
