import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label
    ref={ref}
    className={cn(
      'text-xs font-medium uppercase tracking-[0.15em] text-charcoal-600',
      'mb-2 block',
      className
    )}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }
