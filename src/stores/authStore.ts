import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Auth operation queue - ensures only one auth operation runs at a time
const authOperationQueue: Promise<void> = Promise.resolve()

const queueAuthOperation = async <T>(fn: () => Promise<T>): Promise<T> => {
  return authOperationQueue.then(fn).catch(error => {
    // Log but don't propagate - auth state stays consistent
    console.error('Auth operation failed:', error)
    return undefined as T
  })
}

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
        return queueAuthOperation(async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession()

            if (session?.user) {
              set({ user: session.user, isAuthenticated: true })
              await get().checkAdminStatus()
            } else {
              set({ user: null, isAuthenticated: false, isAdmin: false })
            }
          } catch (error) {
            console.error('Auth initialization error:', error)
            set({ user: null, isAuthenticated: false, isAdmin: false })
          } finally {
            set({ isLoading: false })
          }
        })
      },

      refreshSession: async () => {
        return queueAuthOperation(async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.refreshSession()

            if (session?.user) {
              set({ user: session.user, isAuthenticated: true })
              await get().checkAdminStatus()
            } else {
              set({ user: null, isAuthenticated: false, isAdmin: false })
            }
          } catch (error) {
            console.error('Session refresh error:', error)
            set({ user: null, isAuthenticated: false, isAdmin: false })
          }
        })
      },

      setUser: user => {
        set(state => ({
          user,
          isAuthenticated: !!user,
          isAdmin: user ? state.isAdmin : false,
        }))
      },

      setLoading: loading => {
        set({ isLoading: loading })
      },

      // Admin check
      //
      // SECURITY NOTE: This isAdmin state is for UI purposes ONLY (showing/hiding admin menu items).
      // It is NOT security. Actual admin authorization must be enforced server-side via:
      //   1. Supabase RLS policies on tables (only admin role can access certain rows)
      //   2. Server-side Edge Functions that validate admin status before privileged operations
      // Client-side role checks can be bypassed by modifying user metadata.
      checkAdminStatus: async () => {
        const { user } = get()
        if (!user) {
          set({ isAdmin: false })
          return
        }

        try {
          // This isAdmin state is used ONLY for UI convenience (hiding/showing admin nav items).
          // Security-critical authorization MUST be enforced server-side via RLS policies
          // and Edge Function authorization checks, never by relying on this client state.
          const isAdmin = user.user_metadata?.role === 'admin'
          set({ isAdmin })
        } catch (error) {
          console.error('Admin check error:', error)
          set({ isAdmin: false })
        }
      },
    }),
    { name: 'auth-store' }
  )
)

// Note: Auth state initialization and subscription management
// is handled by AuthProvider in src/providers/AuthProvider.tsx
// This prevents memory leaks from module-level side effects
