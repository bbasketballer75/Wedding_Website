import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * AuthProvider manages authentication state and subscriptions.
 * 
 * Responsibilities:
 * - Initialize auth state on mount
 * - Subscribe to auth state changes with proper cleanup
 * - Handle session refresh
 * 
 * This component prevents memory leaks by unsubscribing from
 * auth state changes when the app unmounts (e.g., during hot reloads).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore(state => state.initializeAuth)
  const setUser = useAuthStore(state => state.setUser)
  const setLoading = useAuthStore(state => state.setLoading)
  const checkAdminStatus = useAuthStore(state => state.checkAdminStatus)

  useEffect(() => {
    // Initialize auth state
    initializeAuth()

    // Subscribe to auth state changes with cleanup
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          await checkAdminStatus()
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth, setUser, setLoading, checkAdminStatus])

  return <>{children}</>
}
