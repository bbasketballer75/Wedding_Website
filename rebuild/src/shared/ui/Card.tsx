import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Frozen Card family port (`src/components/ui/Card.tsx`): the base Card plus
 * GlassCard / PolaroidCard / MemoryCard and the four composition helpers.
 * Every class string is the oracle's, verbatim.
 */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

// Base Card
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl bg-cream-100 text-charcoal-900 shadow-soft',
        'transition-all duration-500 ease-out',
        interactive && [
          'cursor-pointer',
          'hover:-translate-y-0.5 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
        ],
        className
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export type GlassCardProps = CardProps

// Glass Card (frosted effect)
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl bg-white/70 backdrop-blur-xl',
        'border border-white/50 shadow-glass',
        'transition-all duration-500 ease-out',
        'hover:shadow-lg hover:-translate-y-1',
        interactive && [
          'cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
        ],
        className
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    />
  )
)
GlassCard.displayName = 'GlassCard'

export interface PolaroidCardProps extends HTMLAttributes<HTMLDivElement> {
  rotation?: number
}

// Polaroid Card (for photos)
export const PolaroidCard = forwardRef<HTMLDivElement, PolaroidCardProps>(
  ({ className, rotation = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white p-3 pb-16 shadow-xl',
        'transition-all duration-500 ease-out',
        'hover:scale-105 hover:z-10 hover:shadow-2xl',
        'hover:rotate-0',
        className
      )}
      style={{ transform: `rotate(${rotation}deg)` } satisfies CSSProperties}
      {...props}
    />
  )
)
PolaroidCard.displayName = 'PolaroidCard'

export type MemoryCardProps = CardProps

// Memory Card (for guestbook)
export const MemoryCard = forwardRef<HTMLDivElement, MemoryCardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl bg-cream-50 border border-gold-200/50',
        'p-6 shadow-sm',
        'transition-all duration-300',
        'hover:border-gold-300 hover:shadow-md',
        interactive && [
          'cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
        ],
        className
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    />
  )
)
MemoryCard.displayName = 'MemoryCard'

// Card Header
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

// Card Title
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-display text-2xl font-normal leading-none tracking-tight', className)}
      {...props}
    >
      {children ?? <span className='sr-only'>Card title</span>}
    </h3>
  )
)
CardTitle.displayName = 'CardTitle'

// Card Description
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-charcoal-600', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

// Card Content
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

// Card Footer
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'
