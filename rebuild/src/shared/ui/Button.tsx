import { Link } from '@tanstack/react-router'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { buttonVariants, type ButtonVariants } from './buttonVariants'

/**
 * Frozen loading markup: `src/components/ui/Button.tsx` lines 100-138/160-188.
 * The spinner SVG, the sr-only "Loading, please wait" and the "Loading..."
 * label are identical to the oracle.
 */
function ButtonLoadingContent() {
  return (
    <>
      <span className='sr-only'>Loading, please wait</span>
      <svg
        className='animate-spin h-4 w-4'
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        aria-hidden='true'
      >
        <circle
          className='opacity-25'
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
        />
        <path
          className='opacity-75'
          fill='currentColor'
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        />
      </svg>
      <span>Loading...</span>
    </>
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  isLoading?: boolean
  /**
   * Router-aware link support. The frozen `Button` rendered
   * `react-router-dom`'s `Link` when `to` was provided; the rebuild renders
   * TanStack Router's `Link`. Query strings are passed through `search`
   * (TanStack requirement) instead of embedding them in `to`.
   */
  to?: string
  /** TanStack Router search params used with `to`. */
  search?: Record<string, unknown>
  /** Accessible label for icon-only buttons */
  ariaLabel?: string
  /** Whether the button controls an expanded section */
  ariaExpanded?: boolean
  /** ID of the element this button controls */
  ariaControls?: string
  /** Whether this is the current page (for nav buttons) */
  ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | true | false
}

/**
 * Frozen `Button` port (`src/components/ui/Button.tsx`).
 *
 * Deliberate deltas (documented in the Wave-2 task report):
 * - `asChild` is not ported: it relies on `@radix-ui/react-slot`, which is a
 *   phantom dependency in the frozen app (A2) and is not allowed here. The 10
 *   frozen `asChild` call sites pass a router link as the child; `ButtonLink`
 *   / `to` covers exactly that case.
 * - `Link` comes from TanStack Router instead of react-router-dom.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      children,
      disabled,
      to,
      search,
      ariaLabel,
      ariaExpanded,
      ariaControls,
      ariaCurrent,
      ...props
    },
    ref
  ) => {
    // Frozen behavior: a `to` prop renders the router link and ignores button
    // attributes other than label/current/busy (see the oracle's `to` branch).
    if (to) {
      return (
        <Link
          to={to}
          search={search}
          className={cn(buttonVariants({ variant, size, className }))}
          aria-label={ariaLabel}
          aria-current={ariaCurrent}
          aria-busy={isLoading}
        >
          {isLoading ? <ButtonLoadingContent /> : children}
        </Link>
      )
    }

    return (
      <button
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
        {isLoading ? <ButtonLoadingContent /> : children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export interface ButtonLinkProps extends ButtonVariants {
  to: string
  /** TanStack Router search params used with `to`. */
  search?: Record<string, unknown>
  className?: string
  children: ReactNode
  isLoading?: boolean
  ariaLabel?: string
  ariaCurrent?: ButtonProps['ariaCurrent']
}

/**
 * Rebuild-only convenience wrapper kept from Wave 1 so the shell's
 * `NotFoundPage` import keeps working unchanged. Renders the frozen `to`
 * branch of `Button`.
 */
export function ButtonLink({
  to,
  search,
  className,
  variant,
  size,
  isLoading,
  ariaLabel,
  ariaCurrent,
  children,
}: ButtonLinkProps) {
  return (
    <Button
      to={to}
      search={search}
      variant={variant}
      size={size}
      isLoading={isLoading}
      ariaLabel={ariaLabel}
      ariaCurrent={ariaCurrent}
      className={className}
    >
      {children}
    </Button>
  )
}
