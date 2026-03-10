import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gold-100 text-gold-800 border border-gold-200',
        secondary: 'bg-cream-200 text-charcoal-700 border border-cream-300',
        outline: 'border border-gold-500/50 text-gold-700 bg-transparent',
        ghost: 'text-charcoal-600 hover:bg-charcoal-100',
        gold: 'bg-gold-500 text-white',
        rose: 'bg-rose-100 text-rose-800 border border-rose-200',
        sage: 'bg-sage-100 text-sage-800 border border-sage-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
