/**
 * Injects the admin data API (`data.ts` seam) into the feature tree. Component-
 * only module; the context/hook live in `api-context.ts`.
 */
import type { ReactNode } from 'react'
import { AdminApiContext } from './api-context'
import type { AdminApi } from './data'

export function AdminApiProvider({ api, children }: { api: AdminApi; children: ReactNode }) {
  return <AdminApiContext.Provider value={api}>{children}</AdminApiContext.Provider>
}
