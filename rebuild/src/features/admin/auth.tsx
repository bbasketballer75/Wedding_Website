/**
 * Admin auth binding.
 *
 * FROZEN SEMANTICS (src/stores/authStore.ts:158-183 + src/pages/Admin.tsx:22-25):
 * - admin access is `user.app_metadata.role === 'admin'` only — user_metadata is
 *   user-writable and must never grant admin (A4 §2 auth invariant);
 * - this client check is a UI affordance; RLS / public.is_admin() stays
 *   authoritative server-side;
 * - unauthenticated `/admin*` redirects to `/admin/login` keeping the target.
 *
 * This module exports a component only; the context/hook live in
 * `auth-context.ts` (react-refresh rule).
 */
import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { AdminAuthContext, type AdminAuthContextValue } from './auth-context'
import type { AdminAuthClient } from './data'

export interface AdminAuthProviderProps {
  auth: AdminAuthClient
  children: ReactNode
}

export function AdminAuthProvider({ auth, children }: AdminAuthProviderProps) {
  const snapshot = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot)

  const value = useMemo<AdminAuthContextValue>(
    () => ({ ...snapshot, signIn: auth.signIn, signOut: auth.signOut }),
    [auth.signIn, auth.signOut, snapshot]
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
