import { describe, expect, it } from 'vitest'
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY } from '@/app/shell/theme'

function storageWith(value: string | null): Pick<Storage, 'getItem'> {
  return {
    getItem: (key: string) => (key === THEME_STORAGE_KEY ? value : null),
  }
}

describe('readStoredTheme', () => {
  it('defaults to dark when nothing is stored', () => {
    expect(readStoredTheme(storageWith(null))).toBe('dark')
  })

  it('reads the frozen app’s persisted Zustand shape', () => {
    expect(readStoredTheme(storageWith(JSON.stringify({ state: { currentTheme: 'light' } })))).toBe(
      'light'
    )
  })

  it('falls back to dark for unknown or corrupt state', () => {
    expect(readStoredTheme(storageWith('{bad json'))).toBe('dark')
    expect(readStoredTheme(storageWith(JSON.stringify({ state: { currentTheme: 'neon' } })))).toBe(
      'dark'
    )
  })
})

describe('applyTheme', () => {
  it('sets the theme class, data attribute and color scheme', () => {
    const root = document.createElement('html')

    applyTheme('light', root)
    expect(root.classList.contains('light-theme')).toBe(true)
    expect(root.classList.contains('dark-theme')).toBe(false)
    expect(root.dataset.theme).toBe('light')

    applyTheme('dark', root)
    expect(root.classList.contains('dark-theme')).toBe(true)
    expect(root.classList.contains('light-theme')).toBe(false)
    expect(root.dataset.theme).toBe('dark')
  })
})
