import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Frozen class contract for badges.
 *
 * Ported verbatim from the frozen `src/components/ui/Badge.tsx`
 * (`badgeVariants`, lines 5-23). No class was added or dropped — including
 * utilities the frozen design system never declared (e.g. `bg-charcoal-100`,
 * `text-sage-800`), which therefore resolve to nothing in both apps.
 */
export const badgeVariants = cva(
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

export type BadgeVariants = VariantProps<typeof badgeVariants>
