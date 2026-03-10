import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface AuthState {
  // User state
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  // Admin state
  isAdmin: boolean

  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>

  // Session management
  initializeAuth: () => Promise<void>
  refreshSession: () => Promise<void>
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void

  // Admin actions
  checkAdminStatus: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isLoading: true,
        isAuthenticated: false,
        isAdmin: false,

        // Authentication actions
        signIn: async (email, password) => {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            })

            if (error) throw error

            set({ user: data.user, isAuthenticated: true })
            await get().checkAdminStatus()

            return { success: true }
          } catch (error) {
            console.error('Sign in error:', error)
            return { success: false, error: 'Invalid email or password' }
          }
        },

        signUp: async (email, password, name) => {
          try {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  name,
                  role: 'user',
                },
              },
            })

            if (error) throw error

            set({ user: data.user, isAuthenticated: true })

            return { success: true }
          } catch (error) {
            console.error('Sign up error:', error)
            return { success: false, error: 'Failed to create account' }
          }
        },

        signOut: async () => {
          await supabase.auth.signOut()
          set({ user: null, isAuthenticated: false, isAdmin: false })
        },

        // Session management
        initializeAuth: async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession()

            if (session?.user) {
              set({ user: session.user, isAuthenticated: true })
              await get().checkAdminStatus()
            }
          } catch (error) {
            console.error('Auth initialization error:', error)
          } finally {
            set({ isLoading: false })
          }
        },

        refreshSession: async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.refreshSession()

            if (session?.user) {
              set({ user: session.user, isAuthenticated: true })
            } else {
              set({ user: null, isAuthenticated: false, isAdmin: false })
            }
          } catch (error) {
            console.error('Session refresh error:', error)
            set({ user: null, isAuthenticated: false, isAdmin: false })
          }
        },

        setUser: (user) => {
          set({ user, isAuthenticated: !!user })
        },

        setLoading: (loading) => {
          set({ isLoading: loading })
        },

        // Admin check
        checkAdminStatus: async () => {
          const { user } = get()
          if (!user) return

          try {
            // Check if user has admin role in user metadata
            const isAdmin = user.user_metadata?.role === 'admin'
            set({ isAdmin })
          } catch (error) {
            console.error('Admin check error:', error)
            set({ isAdmin: false })
          }
        },
      }),
      {
        name: 'auth-store',
        partialize: state => ({
          isAuthenticated: state.isAuthenticated,
          isAdmin: state.isAdmin,
        }),
      }
    ),
    { name: 'auth-store' }
  )
)

// Note: Auth state initialization and subscription management
// is handled by AuthProvider in src/providers/AuthProvider.tsx
// This prevents memory leaks from module-level side effects
