import { motion, useReducedMotion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { themes } from '@/themes'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const currentTheme = useUIStore(state => state.currentTheme)
  const toggleTheme = useUIStore(state => state.toggleTheme)
  const prefersReducedMotion = useReducedMotion()
  const isDark = currentTheme === 'dark'
  const nextTheme = isDark ? themes.light.displayName : themes.dark.displayName
  const Icon = isDark ? Moon : Sun

  return (
    <button
      type='button'
      data-testid='theme-toggle'
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={toggleTheme}
      className={cn(
        'group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-[11px] font-medium uppercase tracking-[0.16em] transition-all duration-300',
        'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--ui-text)] shadow-[var(--ui-shadow)] backdrop-blur-xl',
        'hover:border-[color:var(--ui-accent)] hover:bg-[color:var(--ui-surface-elevated)] hover:text-[color:var(--ui-accent-strong)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ui-canvas)]',
        className
      )}
    >
      <motion.span
        key={currentTheme}
        initial={prefersReducedMotion ? false : { rotate: -45, opacity: 0, scale: 0.82 }}
        animate={prefersReducedMotion ? undefined : { rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className='flex items-center justify-center'
      >
        <Icon className='h-4 w-4 stroke-[1.8]' aria-hidden='true' />
      </motion.span>
      {label && <span>{isDark ? 'Dark' : 'Light'}</span>}
    </button>
  )
}

export default ThemeToggle
