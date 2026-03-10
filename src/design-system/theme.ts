/**
 * Theme System
 * Supports light and dark modes with automatic switching
 */

import { tokens } from './tokens'

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface Theme {
  mode: ThemeMode
  colors: {
    background: string
    surface: string
    primary: string
    secondary: string
    text: {
      primary: string
      secondary: string
      disabled: string
    }
    border: string
    divider: string
    overlay: string
    // Semantic colors
    success: string
    error: string
    warning: string
    info: string
  }
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    background: tokens.colors.white,
    surface: tokens.colors.gray[50],
    primary: tokens.colors.primary[500],
    secondary: tokens.colors.sage[500],
    text: {
      primary: tokens.colors.gray[900],
      secondary: tokens.colors.gray[600],
      disabled: tokens.colors.gray[400],
    },
    border: tokens.colors.gray[300],
    divider: tokens.colors.gray[200],
    overlay: 'rgba(0, 0, 0, 0.5)',
    success: tokens.colors.success.main,
    error: tokens.colors.error.main,
    warning: tokens.colors.warning.main,
    info: tokens.colors.info.main,
  },
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: tokens.colors.gray[900],
    surface: tokens.colors.gray[800],
    primary: tokens.colors.primary[400],
    secondary: tokens.colors.sage[400],
    text: {
      primary: tokens.colors.gray[50],
      secondary: tokens.colors.gray[300],
      disabled: tokens.colors.gray[600],
    },
    border: tokens.colors.gray[700],
    divider: tokens.colors.gray[800],
    overlay: 'rgba(0, 0, 0, 0.7)',
    success: tokens.colors.success.light,
    error: tokens.colors.error.light,
    warning: tokens.colors.warning.light,
    info: tokens.colors.info.light,
  },
}

/**
 * Theme Manager
 */
export class ThemeManager {
  private currentTheme: ThemeMode = 'light'
  private listeners: Set<(theme: ThemeMode) => void> = new Set()
  private mediaQuery: MediaQueryList | null = null

  constructor() {
    this.initialize()
  }

  /**
   * Initialize theme system
   */
  private initialize(): void {
    // Load saved theme
    const saved = this.getSavedTheme()
    if (saved) {
      this.currentTheme = saved
    } else if (this.supportsColorScheme()) {
      this.currentTheme = 'auto'
      this.setupMediaQuery()
    }

    this.applyTheme()
  }

  /**
   * Get current theme mode
   */
  getTheme(): ThemeMode {
    return this.currentTheme
  }

  /**
   * Get current theme object
   */
  getThemeObject(): Theme {
    const effectiveMode = this.getEffectiveTheme()
    return effectiveMode === 'dark' ? darkTheme : lightTheme
  }

  /**
   * Get effective theme (resolves 'auto' to actual mode)
   */
  private getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'auto') {
      return this.getSystemTheme()
    }
    return this.currentTheme
  }

  /**
   * Set theme mode
   */
  setTheme(mode: ThemeMode): void {
    this.currentTheme = mode
    this.saveTheme(mode)
    this.applyTheme()
    this.notifyListeners()

    if (mode === 'auto') {
      this.setupMediaQuery()
    } else {
      this.cleanupMediaQuery()
    }
  }

  /**
   * Toggle between light and dark
   */
  toggleTheme(): void {
    const current = this.getEffectiveTheme()
    this.setTheme(current === 'light' ? 'dark' : 'light')
  }

  /**
   * Apply theme to document
   */
  private applyTheme(): void {
    const effectiveMode = this.getEffectiveTheme()
    const theme = effectiveMode === 'dark' ? darkTheme : lightTheme

    // Apply to document
    document.documentElement.setAttribute('data-theme', effectiveMode)
    document.documentElement.style.colorScheme = effectiveMode

    // Apply CSS variables
    this.applyCSSVariables(theme)
  }

  /**
   * Apply theme as CSS variables
   */
  private applyCSSVariables(theme: Theme): void {
    const root = document.documentElement

    // Colors
    root.style.setProperty('--color-background', theme.colors.background)
    root.style.setProperty('--color-surface', theme.colors.surface)
    root.style.setProperty('--color-primary', theme.colors.primary)
    root.style.setProperty('--color-secondary', theme.colors.secondary)
    root.style.setProperty('--color-text-primary', theme.colors.text.primary)
    root.style.setProperty('--color-text-secondary', theme.colors.text.secondary)
    root.style.setProperty('--color-text-disabled', theme.colors.text.disabled)
    root.style.setProperty('--color-border', theme.colors.border)
    root.style.setProperty('--color-divider', theme.colors.divider)
    root.style.setProperty('--color-overlay', theme.colors.overlay)
    root.style.setProperty('--color-success', theme.colors.success)
    root.style.setProperty('--color-error', theme.colors.error)
    root.style.setProperty('--color-warning', theme.colors.warning)
    root.style.setProperty('--color-info', theme.colors.info)
  }

  /**
   * Get system theme preference
   */
  private getSystemTheme(): 'light' | 'dark' {
    if (!this.supportsColorScheme()) return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  /**
   * Check if browser supports color scheme
   */
  private supportsColorScheme(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme)').media !== 'not all'
  }

  /**
   * Setup media query listener for auto mode
   */
  private setupMediaQuery(): void {
    if (!this.supportsColorScheme()) return

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.mediaQuery.addEventListener('change', this.handleMediaQueryChange)
  }

  /**
   * Cleanup media query listener
   */
  private cleanupMediaQuery(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleMediaQueryChange)
      this.mediaQuery = null
    }
  }

  /**
   * Handle system theme change
   */
  private handleMediaQueryChange = (): void => {
    if (this.currentTheme === 'auto') {
      this.applyTheme()
      this.notifyListeners()
    }
  }

  /**
   * Save theme to storage
   */
  private saveTheme(mode: ThemeMode): void {
    localStorage.setItem('theme', mode)
  }

  /**
   * Get saved theme from storage
   */
  private getSavedTheme(): ThemeMode | null {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved
    }
    return null
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(callback: (theme: ThemeMode) => void): () => void {
    this.listeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentTheme)
      } catch (error) {
        console.error('Theme listener error:', error)
      }
    })
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.cleanupMediaQuery()
    this.listeners.clear()
  }
}

// Singleton instance
export const themeManager = new ThemeManager()

export default themeManager
