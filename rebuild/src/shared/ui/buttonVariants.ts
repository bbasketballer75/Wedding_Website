import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * Frozen class contract for buttons.
 *
 * Ported verbatim from the frozen `src/components/ui/Button.tsx`
 * (`buttonVariants`, lines 7-64) — same base string, same six variants, same
 * five sizes, same `sm:` breakpoints and focus-ring / active-scale classes.
 * Only the import path changed (`@/lib/utils` -> `@/shared/lib/cn`).
 *
 * The variants live in their own module so `Button.tsx` exports components
 * only (keeps `react-refresh/only-export-components` clean without an eslint
 * suppression); the public API is unchanged through `./index.ts`.
 */
export const buttonVariants = cva(
  // Base styles
  'inline-flex max-w-full items-center justify-center gap-2 text-center text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer whitespace-normal break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        // Primary gold button — text uses charcoal-900 (not white) so contrast
        // passes WCAG AA at all sizes. White on gold-500 (#d4af37) was 2.1:1,
        // which fails the 4.5:1 minimum for normal text. Charcoal-900 on
        // gold-500 is ~9:1 (AAA).
        primary: cn(
          'bg-gold-500 text-charcoal-900',
          'shadow-[0_4px_14px_rgba(201,160,92,0.4)]',
          'hover:bg-gold-600 hover:shadow-[0_8px_25px_rgba(201,160,92,0.5)]',
          'border border-gold-600/30 rounded-full'
        ),
        // Secondary outline
        secondary: cn(
          'bg-transparent border border-[color:var(--ui-border)] text-[color:var(--ui-accent-strong)]',
          'hover:bg-[color:var(--ui-surface-elevated)] hover:border-[color:var(--ui-accent)]',
          'rounded-full'
        ),
        // Ghost (subtle)
        ghost: cn(
          'bg-transparent text-[color:var(--ui-accent-strong)]',
          'hover:bg-[color:var(--ui-surface-elevated)]',
          'rounded-full'
        ),
        // Glass effect
        glass: cn(
          'bg-[color:var(--ui-surface)] backdrop-blur-xl text-[color:var(--ui-text)]',
          'border border-[color:var(--ui-border)] shadow-[var(--ui-shadow)]',
          'hover:bg-[color:var(--ui-surface-elevated)] hover:shadow-xl',
          'rounded-full'
        ),
        // Shimmer effect for special moments
        shimmer: cn(
          'bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600',
          'bg-[length:200%_100%] animate-shimmer',
          'text-white shadow-gold rounded-full'
        ),
        // Danger/delete
        danger: cn('bg-rose-500 text-white', 'hover:bg-rose-600', 'rounded-full'),
      },
      size: {
        sm: 'min-h-9 px-4 py-2 text-[11px] uppercase tracking-[0.15em] sm:text-xs',
        md: 'min-h-11 px-5 py-3 text-[11px] uppercase tracking-[0.15em] sm:px-6 sm:text-xs',
        lg: 'min-h-12 px-6 py-3 text-xs uppercase tracking-[0.14em] sm:min-h-14 sm:px-8 sm:text-sm sm:tracking-[0.15em]',
        xl: 'min-h-14 px-7 py-3 text-sm uppercase tracking-[0.1em] sm:min-h-16 sm:px-10 sm:text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
