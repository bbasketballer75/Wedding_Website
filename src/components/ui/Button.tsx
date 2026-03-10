import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        // Primary gold button
        primary: cn(
          'bg-gradient-to-br from-gold-400 to-gold-600 text-white',
          'shadow-[0_4px_14px_rgba(201,160,92,0.4)]',
          'hover:shadow-[0_8px_25px_rgba(201,160,92,0.5)] hover:brightness-110',
          'border border-white/10 rounded-full'
        ),
        // Secondary outline
        secondary: cn(
          'bg-transparent border border-gold-500/60 text-gold-700',
          'hover:bg-gold-50/50 hover:border-gold-500',
          'rounded-full'
        ),
        // Ghost (subtle)
        ghost: cn(
          'bg-transparent text-gold-700',
          'hover:bg-gold-50/50',
          'rounded-full'
        ),
        // Glass effect
        glass: cn(
          'bg-white/70 backdrop-blur-xl text-charcoal-700',
          'border border-white/50 shadow-lg',
          'hover:bg-white/90 hover:shadow-xl',
          'rounded-full'
        ),
        // Shimmer effect for special moments
        shimmer: cn(
          'bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600',
          'bg-[length:200%_100%] animate-shimmer',
          'text-white shadow-gold rounded-full'
        ),
        // Danger/delete
        danger: cn(
          'bg-rose-500 text-white',
          'hover:bg-rose-600',
          'rounded-full'
        ),
      },
      size: {
        sm: 'h-9 px-4 text-xs uppercase tracking-[0.15em]',
        md: 'h-11 px-6 text-xs uppercase tracking-[0.15em]',
        lg: 'h-14 px-8 text-sm uppercase tracking-[0.15em]',
        xl: 'h-16 px-10 text-base uppercase tracking-[0.1em]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  to?: string
  /** Accessible label for icon-only buttons */
  ariaLabel?: string
  /** Whether the button controls an expanded section */
  ariaExpanded?: boolean
  /** ID of the element this button controls */
  ariaControls?: string
  /** Whether this is the current page (for nav buttons) */
  ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | true | false
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    isLoading, 
    children, 
    disabled, 
    to, 
    ariaLabel,
    ariaExpanded,
    ariaControls,
    ariaCurrent,
    ...props 
  }, ref) => {
    // Loading state text for screen readers
    const loadingText = 'Loading, please wait'
    
    // If 'to' prop is provided, render as Link
    if (to) {
      return (
        <Link
          to={to}
          className={cn(buttonVariants({ variant, size, className }))}
          aria-label={ariaLabel}
          aria-current={ariaCurrent}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="sr-only">{loadingText}</span>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading...</span>
            </>
          ) : (
            children
          )}
        </Link>
      )
    }

    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-current={ariaCurrent}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="sr-only">{loadingText}</span>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
