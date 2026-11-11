import { createContext, useContext } from 'react'
import type { ThemeMode } from './theme'

/**
 * Theme context/hook kept in a non-component module so `ThemeProvider.tsx`
 * only exports components (react-refresh) while the hook stays tree-shakeable.
 */
export interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
