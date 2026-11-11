/**
 * Test-only React Query wrapper for data-layer hook tests.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/** Query client with retries/gc disabled so hook tests are deterministic. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export interface TestQueryWrapper {
  queryClient: QueryClient
  Wrapper: (props: { children: ReactNode }) => ReactNode
}

/** Create a wrapper component + its query client for `renderHook`. */
export function createTestQueryWrapper(): TestQueryWrapper {
  const queryClient = createTestQueryClient()

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { queryClient, Wrapper }
}
