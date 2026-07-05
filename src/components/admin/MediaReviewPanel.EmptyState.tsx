import { Users } from 'lucide-react'

/**
 * Reusable empty-state card with icon + title + description. Used by both the
 * "no batch selected" and "no faces staged" branches of MediaReviewPanel.
 *
 * Lives in its own .tsx file (not combined with the helpers module) so that
 * the `react-refresh/only-export-components` rule stays happy: components and
 * plain values can't share a module or fast-refresh breaks.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
      <Icon className='h-12 w-12 opacity-30' />
      <p className='font-medium text-charcoal-700'>{title}</p>
      <p className='text-sm'>{description}</p>
    </div>
  )
}

// Re-export so consumers can do `import { EmptyState, Users } from './MediaReviewPanel.EmptyState'`
export { Users }
