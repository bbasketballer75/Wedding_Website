/**
 * Theme Hook
 * Provides access to theme system in React components
 */

import { useEffect, useState } from 'react'
import type { Theme, ThemeMode } from '../design-system/theme'
import { themeManager } from '../design-system/theme'

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(themeManager.getTheme())
  const [theme, setTheme] = useState<Theme>(themeManager.getThemeObject())

  useEffect(() => {
    // Subscribe to theme changes
    const unsubscribe = themeManager.subscribe(newMode => {
      setMode(newMode)
      setTheme(themeManager.getThemeObject())
    })

    return unsubscribe
  }, [])

  const setThemeMode = (newMode: ThemeMode) => {
    themeManager.setTheme(newMode)
  }

  const toggleTheme = () => {
    themeManager.toggleTheme()
  }

  return {
    mode,
    theme,
    setTheme: setThemeMode,
    toggleTheme,
    isDark: theme.mode === 'dark',
  }
}

export default useTheme
