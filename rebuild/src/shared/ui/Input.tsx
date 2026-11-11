import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  hint?: string
}

/**
 * Frozen `Input` port (`src/components/ui/Input.tsx`).
 *
 * The oracle builds `${id}-hint` / `${id}-error` ids and wires
 * `aria-describedby` / `aria-invalid` from them; that contract is preserved
 * exactly, as is the wrapper `div` (flex column) and every class string.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, hint, id, ...props }, ref) => {
    const hintId = hint && id ? `${id}-hint` : undefined
    const errorId = error && id ? `${id}-error` : undefined
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

    return (
      <div className='flex flex-col gap-1.5'>
        <input
          id={id}
          type={type}
          className={cn(
            'theme-input flex h-11 w-full rounded-xl border backdrop-blur-sm',
            'px-5 py-2 text-sm placeholder:text-[color:var(--ui-subtle)]',
            'transition-all duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-rose-400 focus-visible:ring-rose-400'
              : 'border-[color:var(--ui-border)]',
            className
          )}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          ref={ref}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className='theme-muted px-2 text-xs'>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role='alert' className='px-2 text-xs text-rose-500'>
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
