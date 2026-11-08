import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

/**
 * Frozen `Label` port (`src/components/ui/Label.tsx`): a thin styled `<label>`
 * that forwards `htmlFor` untouched so the caller owns the association.
 *
 * `htmlFor` is destructured and passed explicitly (instead of relying on the
 * `...props` spread alone) so the static `jsx-a11y/label-has-associated-control`
 * analysis can see the association. The rendered DOM is identical: an
 * `undefined` `htmlFor` renders no attribute, exactly like the frozen app.
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, ...props }, ref) => (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={cn(
        'text-xs font-medium uppercase tracking-[0.15em] text-charcoal-600',
        'mb-2 block',
        className
      )}
      {...props}
    />
  )
)
Label.displayName = 'Label'
