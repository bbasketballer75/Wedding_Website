import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAccessibility } from './accessibility-context'
import { applyTheme, readStoredTheme, type ThemeMode } from './theme'
import { ThemeContext } from './theme-context'

const displayName = (theme: ThemeMode) => (theme === 'dark' ? 'Dark' : 'Light')

/**
 * Theme state + DOM application. The context/hook live in `./theme-context` so
 * this module only exports a component (react-refresh fast-refresh contract).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme(window.localStorage))
  const { announce } = useAccessibility()

  useEffect(() => {
    applyTheme(theme, document.documentElement)
    announce(`${displayName(theme)} theme enabled`, 'polite')
  }, [announce, theme])

  useEffect(() => {
    const handleToggle = () => {
      setTheme(previous => (previous === 'dark' ? 'light' : 'dark'))
    }
    window.addEventListener('toggle-theme', handleToggle)
    return () => window.removeEventListener('toggle-theme', handleToggle)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(previous => (previous === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
