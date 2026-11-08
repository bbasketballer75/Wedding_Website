import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAccessibility } from './AccessibilityProvider'
import { applyTheme, DEFAULT_THEME, readStoredTheme, type ThemeMode } from './theme'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const displayName = (theme: ThemeMode) => (theme === 'dark' ? 'Dark' : 'Light')

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

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

export { DEFAULT_THEME }
