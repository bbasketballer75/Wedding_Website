/**
 * Theme storage contract shared with the frozen app and the parity harness.
 *
 * The legacy app persists Zustand state under `ui-store` as
 * `{ state: { currentTheme }, version }`; the parity harness injects that exact
 * shape. Reading the same key means the rebuild renders the same theme the
 * oracle would for a given seeded state.
 */
export type ThemeMode = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'ui-store'
export const DEFAULT_THEME: ThemeMode = 'dark'

interface PersistedUIState {
  state?: { currentTheme?: unknown }
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): ThemeMode {
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY)
    if (!raw) return DEFAULT_THEME
    const parsed = JSON.parse(raw) as PersistedUIState
    return parsed.state?.currentTheme === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme: ThemeMode, root: HTMLElement): void {
  root.dataset.theme = theme
  root.style.colorScheme = theme
  root.classList.remove('dark-theme', 'light-theme')
  root.classList.add(theme === 'light' ? 'light-theme' : 'dark-theme')
}
