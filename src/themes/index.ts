export interface ThemeConfig {
  name: ThemeMode
  className: string
  displayName: string
  variables: Record<string, string>
}

export type ThemeMode = 'dark' | 'light'

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'dark' || value === 'light'

export const themes: Record<ThemeMode, ThemeConfig> = {
  dark: {
    name: 'dark',
    className: 'dark-theme',
    displayName: 'Dark',
    variables: {
      '--ui-canvas': '#090605',
      '--ui-canvas-soft': '#130d09',
      '--ui-surface': 'rgba(255, 247, 235, 0.07)',
      '--ui-surface-elevated': 'rgba(255, 247, 235, 0.12)',
      '--ui-glass': 'rgba(15, 10, 7, 0.72)',
      '--ui-border': 'rgba(232, 212, 176, 0.18)',
      '--ui-text': '#fff7eb',
      '--ui-muted': 'rgba(255, 247, 235, 0.68)',
      '--ui-subtle': 'rgba(255, 247, 235, 0.48)',
      '--ui-accent': '#d4af37',
      '--ui-accent-strong': '#f5d586',
      '--ui-shadow': '0 24px 70px rgba(0, 0, 0, 0.36)',
      '--ui-focus-ring': 'rgba(245, 213, 134, 0.58)',
    },
  },
  light: {
    name: 'light',
    className: 'light-theme',
    displayName: 'Light',
    variables: {
      '--ui-canvas': '#fbf8f1',
      '--ui-canvas-soft': '#f3ecdf',
      '--ui-surface': 'rgba(255, 255, 255, 0.74)',
      '--ui-surface-elevated': 'rgba(255, 255, 255, 0.92)',
      '--ui-glass': 'rgba(255, 252, 245, 0.82)',
      '--ui-border': 'rgba(126, 94, 44, 0.22)',
      '--ui-text': '#17110d',
      '--ui-muted': 'rgba(23, 17, 13, 0.68)',
      '--ui-subtle': 'rgba(23, 17, 13, 0.48)',
      '--ui-accent': '#9f7430',
      '--ui-accent-strong': '#5e451e',
      '--ui-shadow': '0 22px 60px rgba(75, 49, 21, 0.14)',
      '--ui-focus-ring': 'rgba(159, 116, 48, 0.42)',
    },
  },
}

export const defaultThemeName: ThemeMode = 'dark'
