import { cva, type VariantProps } from 'class-variance-authority'
import { Link } from '@tanstack/react-router'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Wave 1 primitive: only the variants the shell needs are ported, but the base
 * classes and primary/secondary styles match the frozen app exactly so the 404
 * buttons are pixel-identical. Wave 2 completes the variant/size set.
 */
const buttonVariants = cva(
  'inline-flex max-w-full cursor-pointer items-center justify-center gap-2 whitespace-normal break-words text-center text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary: cn(
          'rounded-full border border-gold-600/30 bg-gold-500 text-charcoal-900',
          'shadow-[0_4px_14px_rgba(201,160,92,0.4)]',
          'hover:bg-gold-600 hover:shadow-[0_8px_25px_rgba(201,160,92,0.5)]'
        ),
        secondary: cn(
          'rounded-full border border-[color:var(--ui-border)] bg-transparent text-[color:var(--ui-accent-strong)]',
          'hover:border-[color:var(--ui-accent)] hover:bg-[color:var(--ui-surface-elevated)]'
        ),
      },
      size: {
        sm: 'min-h-9 px-4 py-2 text-[11px] uppercase tracking-[0.15em] sm:text-xs',
        md: 'min-h-11 px-5 py-3 text-[11px] uppercase tracking-[0.15em] sm:px-6 sm:text-xs',
        lg: 'min-h-12 px-6 py-3 text-xs uppercase tracking-[0.14em] sm:min-h-14 sm:px-8 sm:text-sm sm:tracking-[0.15em]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  children: ReactNode
}

export function Button({ className, variant, size, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
}

interface ButtonLinkProps extends ButtonVariantProps {
  to: string
  className?: string
  children: ReactNode
}

export function ButtonLink({ to, className, variant, size, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  )
}
