/**
 * Admin data API context + hook (separate from the provider component so the
 * provider module only exports a component, keeping react-refresh clean).
 *
 * Pages consume the injected API through `useAdminApi`; they never import the
 * in-memory stub or `shared/data` directly.
 */
import { createContext, useContext } from 'react'
import type { AdminApi } from './data'

export const AdminApiContext = createContext<AdminApi | null>(null)

export function useAdminApi(): AdminApi {
  const context = useContext(AdminApiContext)
  if (!context) {
    throw new Error('useAdminApi must be used inside <AdminApiProvider>')
  }
  return context
}
