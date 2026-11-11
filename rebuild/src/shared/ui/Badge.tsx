import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'
import { badgeVariants, type BadgeVariants } from './badgeVariants'

export type BadgeProps = HTMLAttributes<HTMLDivElement> & BadgeVariants

/**
 * Frozen `Badge` port (`src/components/ui/Badge.tsx`): a plain `div` with the
 * cva class contract, so `<div>` semantics and className merging are unchanged.
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
