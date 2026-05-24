import { defaultThemeName } from '@/themes' // Import defaultThemeName
import type { Toast, UserPreferences } from '@/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UIState {
  // Theme
  currentTheme: string // Stores the name of the active theme (e.g., 'dark', 'roseGarden')
  systemTheme: 'light' | 'dark' // Stores the detected system preference
  setCurrentTheme: (themeName: string) => void
  setSystemTheme: (theme: 'light' | 'dark') => void

  // Toast notifications
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void

  // Loading states
  isLoading: boolean
  loadingMessage?: string
  setLoading: (loading: boolean, message?: string) => void

  // Modal states
  activeModal: string | null
  openModal: (modalId: string) => void
  closeModal: () => void

  // User preferences
  preferences: Omit<UserPreferences, 'theme'> // Omit theme from preferences as it's now currentTheme
  updatePreferences: (prefs: Partial<Omit<UserPreferences, 'theme'>>) => void

  // Menu states
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  // Scroll states
  isScrolled: boolean
  setScrolled: () => void
  activeSection: string
  setActiveSection: (section: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      currentTheme: defaultThemeName,
      systemTheme:
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : 'light',
      setCurrentTheme: themeName => set({ currentTheme: themeName }),
      setSystemTheme: theme => set({ systemTheme: theme }),

      // Toast notifications
      toasts: [],
      addToast: toast => {
        const id = Math.random().toString(36).substr(2, 9)
        const newToast = { ...toast, id }
        set(state => ({ toasts: [...state.toasts, newToast] }))

        // Auto-remove toast after duration
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, toast.duration || 5000)
        }
      },
      removeToast: id =>
        set(state => ({
          toasts: state.toasts.filter(t => t.id !== id),
        })),
      clearToasts: () => set({ toasts: [] }),

      // Loading states
      isLoading: false,
      loadingMessage: undefined,
      setLoading: (loading, message) => set({ isLoading: loading, loadingMessage: message }),

      // Modal states
      activeModal: null,
      openModal: modalId => set({ activeModal: modalId }),
      closeModal: () => set({ activeModal: null }),

      // User preferences
      preferences: {
        // theme: 'system', // Removed, now managed by currentTheme
        musicEnabled: true,
        animationsEnabled: true,
        autoPlayVideos: false,
      },
      updatePreferences: prefs =>
        set(state => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      // Menu states
      isMobileMenuOpen: false,
      setMobileMenuOpen: open => set({ isMobileMenuOpen: open }),

      // Scroll states
      isScrolled: false,
      setScrolled: () => set({ isScrolled: true }),
      activeSection: '',
      setActiveSection: section => set({ activeSection: section }),
    }),
    {
      name: 'ui-store',
      partialize: state => ({
        currentTheme: state.currentTheme, // Persist current theme name
        preferences: state.preferences,
      }),
    }
  )
)
