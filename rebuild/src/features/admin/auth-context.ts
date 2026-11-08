/**
 * Admin auth context + hook (kept separate from the provider component so the
 * provider module only exports a component, keeping react-refresh clean).
 */
import { createContext, useContext } from 'react'
import type { AdminAuthSnapshot, AdminSignInResult } from './data'

export interface AdminAuthContextValue extends AdminAuthSnapshot {
  signIn: (email: string, password: string) => Promise<AdminSignInResult>
  signOut: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used inside <AdminAuthProvider>')
  }
  return context
}
