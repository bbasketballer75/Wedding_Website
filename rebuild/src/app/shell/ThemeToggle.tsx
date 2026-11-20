import { Moon, Sun } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { useTheme } from './theme-context'

/**
 * Theme switch. Parity port of the frozen `src/components/theme/ThemeToggle.tsx`:
 * same button name/title wording, same icon/label mapping and the same classes,
 * but backed by the rebuild's `ThemeProvider` instead of the Zustand UI store.
 *
 * The icon change is a CSS enter animation (`.shell-enter-toggle`) keyed on `theme`,
 * not framer-motion: the toggle lives in the header, which is on every page, and an
 * animation runtime there costs every visitor 46.4 KiB gzip before first paint.
 * `prefers-reduced-motion` is honoured globally in `global.css`.
 */
export function ThemeToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const nextTheme = isDark ? 'Light' : 'Dark'
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
      <span key={theme} className='shell-enter-toggle flex items-center justify-center'>
        <Icon className='h-4 w-4 stroke-[1.8]' aria-hidden='true' />
      </span>
      {label && <span>{isDark ? 'Dark' : 'Light'}</span>}
    </button>
  )
}

export default ThemeToggle
