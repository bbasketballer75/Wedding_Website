import { useEffect } from 'react'
import { useAccessibility } from '@/accessibility/AccessibilityProvider'
import { defaultThemeName, isThemeMode, themes } from '@/themes'
import { useUIStore } from '@/stores/uiStore'

export function ThemeController() {
  const currentTheme = useUIStore(state => state.currentTheme)
  const setCurrentTheme = useUIStore(state => state.setCurrentTheme)
  const toggleTheme = useUIStore(state => state.toggleTheme)
  const { announce } = useAccessibility()

  useEffect(() => {
    if (!isThemeMode(currentTheme)) {
      setCurrentTheme(defaultThemeName)
    }
  }, [currentTheme, setCurrentTheme])

  useEffect(() => {
    const theme = isThemeMode(currentTheme) ? currentTheme : defaultThemeName
    const config = themes[theme]
    const root = document.documentElement

    root.dataset.theme = theme
    root.style.colorScheme = theme
    root.classList.remove(...Object.values(themes).map(item => item.className))
    root.classList.add(config.className)

    for (const [name, value] of Object.entries(config.variables)) {
      root.style.setProperty(name, value)
    }
  }, [currentTheme])

  useEffect(() => {
    const handleToggleTheme = () => {
      toggleTheme()
    }

    window.addEventListener('toggle-theme', handleToggleTheme)
    return () => window.removeEventListener('toggle-theme', handleToggleTheme)
  }, [toggleTheme])

  useEffect(() => {
    const theme = isThemeMode(currentTheme) ? currentTheme : defaultThemeName
    announce(`${themes[theme].displayName} theme enabled`, 'polite')
  }, [announce, currentTheme])

  return null
}

export default ThemeController
