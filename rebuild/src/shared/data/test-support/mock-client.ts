/**
 * Test-only Supabase client double.
 *
 * Unit tests must never hit the network (QUALITY_BAR: deterministic tests), so
 * they inject this structural double where the app injects `TypedSupabaseClient`.
 * It records every chained call so tests can assert the query shape and resolves
 * configured fixture-shaped responses.
 */
import { vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import type { TypedSupabaseClient } from '../client'

export interface MockQueryResponse {
  data?: unknown
  error?: unknown
  count?: number | null
}

export type MockResponseProvider =
  | MockQueryResponse
  | readonly MockQueryResponse[]
  | ((input: { calls: MockCall[]; attempt: number }) => MockQueryResponse)

export interface MockCall {
  readonly surface: 'from' | 'rpc' | 'storage'
  readonly target: string
  readonly method: string
  readonly args: readonly unknown[]
}

interface ResolvedResponse {
  data: unknown
  error: unknown
  count: number | null
}

function isResponseArray(value: MockResponseProvider): value is readonly MockQueryResponse[] {
  return Array.isArray(value)
}

function resolveResponse(
  provider: MockResponseProvider | undefined,
  attempt: number,
  calls: MockCall[]
): ResolvedResponse {
  if (provider === undefined) return { data: null, error: null, count: null }

  let raw: MockQueryResponse
  if (typeof provider === 'function') {
    raw = provider({ calls, attempt })
  } else if (isResponseArray(provider)) {
    const index = Math.min(attempt, provider.length - 1)
    raw = provider[index] ?? {}
  } else {
    raw = provider
  }

  return {
    data: raw.data ?? null,
    error: raw.error ?? null,
    count: raw.count ?? null,
  }
}

function makeQueryBuilder(
  getResponse: () => ResolvedResponse,
  calls: MockCall[],
  surface: MockCall['surface'],
  target: string
): unknown {
  let mode: 'list' | 'single' | 'maybeSingle' = 'list'

  const builder: Record<PropertyKey, unknown> = {}
  const proxy = new Proxy(builder, {
    get(_target, property) {
      if (property === 'then') {
        return (onFulfilled: (value: ResolvedResponse) => unknown): Promise<unknown> => {
          const resolved = getResponse()
          let value = resolved
          if ((mode === 'single' || mode === 'maybeSingle') && !resolved.error) {
            value = {
              ...resolved,
              data: Array.isArray(resolved.data) ? (resolved.data[0] ?? null) : resolved.data,
            }
          }
          return Promise.resolve(value).then(onFulfilled)
        }
      }

      if (typeof property === 'symbol') return undefined

      return (...args: readonly unknown[]) => {
        calls.push({ surface, target, method: String(property), args })
        if (property === 'single') mode = 'single'
        if (property === 'maybeSingle') mode = 'maybeSingle'
        return proxy
      }
    },
  })

  return proxy
}

export interface MockAuthConfig {
  session?: Session | null
  user?: User | null
  getSessionError?: unknown
  signInError?: unknown
  signOutError?: unknown
  refreshError?: unknown
}

export interface MockStorageConfig {
  signedUrl?: string
  createSignedUrlError?: unknown
  download?: Blob
  downloadError?: unknown
}

export interface MockClientConfig {
  tables?: Record<string, MockResponseProvider>
  rpcs?: Record<string, MockResponseProvider>
  auth?: MockAuthConfig
  storage?: MockStorageConfig
}

export interface MockAuthControls {
  /** Fire the captured `onAuthStateChange` listener. */
  emit: (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED', session: Session | null) => void
  readonly unsubscribe: ReturnType<typeof vi.fn>
}

export interface MockRealtimeControls {
  /** Deliver a realtime INSERT payload to the captured channel handler. */
  emitInsert: (table: string, row: unknown) => void
}

export interface MockClientHandle {
  client: TypedSupabaseClient
  calls: MockCall[]
  auth: MockAuthControls
  realtime: MockRealtimeControls
  storage: ReturnType<typeof vi.fn>
  channelMock: ReturnType<typeof vi.fn>
  removeChannelMock: ReturnType<typeof vi.fn>
}

/**
 * Create a structural Supabase client double.
 *
 * @example
 * const { client, calls } = createMockClient({ tables: { photos: { data: rows } } })
 * const photos = await fetchAllPhotos(client)
 * expect(calls).toContainEqual({ surface: 'from', target: 'photos', method: 'order', args: [...] })
 */
export function createMockClient(config: MockClientConfig = {}): MockClientHandle {
  const calls: MockCall[] = []
  const attempts = new Map<string, number>()

  const nextResponse =
    (key: string, provider: MockResponseProvider | undefined) => (): ResolvedResponse => {
      const attempt = attempts.get(key) ?? 0
      attempts.set(key, attempt + 1)
      return resolveResponse(provider, attempt, calls)
    }

  const from = vi.fn((table: string) => {
    calls.push({ surface: 'from', target: table, method: 'from', args: [table] })
    return makeQueryBuilder(
      nextResponse(`table:${table}`, config.tables?.[table]),
      calls,
      'from',
      table
    )
  })

  const rpc = vi.fn((name: string, args?: Record<string, unknown>) => {
    calls.push({ surface: 'rpc', target: name, method: 'rpc', args: [args ?? {}] })
    return makeQueryBuilder(nextResponse(`rpc:${name}`, config.rpcs?.[name]), calls, 'rpc', name)
  })

  const authConfig = config.auth ?? {}
  let authListener: ((event: string, session: Session | null) => void) | null = null
  const unsubscribe = vi.fn()

  const auth = {
    getSession: vi.fn(() => ({
      data: { session: authConfig.session ?? null },
      error: authConfig.getSessionError ?? null,
    })),
    signInWithPassword: vi.fn(() => ({
      data: { user: authConfig.user ?? null, session: authConfig.session ?? null },
      error: authConfig.signInError ?? null,
    })),
    signOut: vi.fn(() => ({ error: authConfig.signOutError ?? null })),
    refreshSession: vi.fn(() => ({
      data: { user: authConfig.user ?? null, session: authConfig.session ?? null },
      error: authConfig.refreshError ?? null,
    })),
    onAuthStateChange: vi.fn((listener: (event: string, session: Session | null) => void) => {
      authListener = listener
      return { data: { subscription: { unsubscribe } } }
    }),
  }

  const storageConfig = config.storage ?? {}
  const storageFrom = vi.fn((bucket: string) => ({
    createSignedUrl: vi.fn((path: string, expiresIn: number) => {
      calls.push({
        surface: 'storage',
        target: bucket,
        method: 'createSignedUrl',
        args: [path, expiresIn],
      })
      return {
        data: storageConfig.createSignedUrlError
          ? null
          : { signedUrl: storageConfig.signedUrl ?? `https://example.test/${bucket}/${path}` },
        error: storageConfig.createSignedUrlError ?? null,
      }
    }),
    download: vi.fn((path: string) => {
      calls.push({ surface: 'storage', target: bucket, method: 'download', args: [path] })
      return {
        data: storageConfig.downloadError ? null : (storageConfig.download ?? new Blob()),
        error: storageConfig.downloadError ?? null,
      }
    }),
  }))

  const channelHandlers: Array<(payload: { new: unknown }) => void> = []
  const channel = vi.fn(() => {
    const channelBuilder = {
      on: vi.fn(
        (_event: string, _filter: unknown, handler: (payload: { new: unknown }) => void) => {
          channelHandlers.push(handler)
          return channelBuilder
        }
      ),
      subscribe: vi.fn(() => channelBuilder),
    }
    return channelBuilder
  })
  const removeChannel = vi.fn(() => undefined)

  const client = {
    from,
    rpc,
    auth,
    storage: { from: storageFrom },
    channel,
    removeChannel,
  } as unknown as TypedSupabaseClient

  return {
    client,
    calls,
    auth: {
      emit: (event, session) => {
        authListener?.(event, session)
      },
      unsubscribe,
    },
    realtime: {
      emitInsert: (table, row) => {
        for (const handler of channelHandlers) handler({ new: row })
        void table
      },
    },
    storage: storageFrom,
    channelMock: channel,
    removeChannelMock: removeChannel,
  }
}
