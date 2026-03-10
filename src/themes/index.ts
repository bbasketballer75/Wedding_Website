// src/themes/index.ts

export interface ThemeConfig {
  name: string
  className: string // Class to be applied to <html> element
  displayName: string // User-friendly name
  variables: Record<string, string> // CSS variable overrides
}

export const themes: Record<string, ThemeConfig> = {
  light: {
    name: 'light',
    className: 'light-theme',
    displayName: 'Light',
    variables: {
      '--color-gold-500': '#d4af37',
      '--color-gold-600': '#ca8a04',
      '--color-cream-50': '#fefdfb',
      '--color-cream-100': '#fbfaf8',
      '--color-dark-900': '#0a0a0a',
      '--color-dark-700': '#262626',
    },
  },
  dark: {
    name: 'dark',
    className: 'dark-theme',
    displayName: 'Dark',
    variables: {
      '--color-gold-500': '#d4af37',
      '--color-gold-400': '#facc15',
      '--color-cream-50': '#0a0a0a',
      '--color-cream-100': '#171717',
      '--color-dark-900': '#fefdfb',
      '--color-dark-700': '#f0ede8',
    },
  },
  roseGarden: {
    name: 'roseGarden',
    className: 'rose-garden-theme',
    displayName: 'Rose Garden',
    variables: {
      '--color-gold-500': '#e2b4b4',
      '--color-cream-50': '#1a1012',
      '--color-cream-100': '#2a1a1c',
      '--color-dark-900': '#fefafb',
      '--color-dark-700': '#c5a3a8',
    },
  },
  system: {
    name: 'system',
    className: 'system-theme',
    displayName: 'System Preference',
    variables: {},
  },
}

// Default theme to use
export const defaultThemeName = 'light' // Forced to light for Elegant Wedding aesthetic
