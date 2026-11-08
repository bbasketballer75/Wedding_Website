/**
 * The single typed Supabase client for the greenfield app.
 *
 * - Typed with the generated `Database` type (`createClient<Database>`).
 * - Environment is read through the app's pure boundary `readEnv` from
 *   `@/app/env` — the schema is NOT duplicated here.
 * - Auth/realtime options mirror the frozen client exactly
 *   (`src/lib/supabase/client.ts`): auto-refresh + persisted session + URL
 *   session detection, and realtime capped at 10 events/second.
 * - Only public (anon-key) values are used. The service-role key must never
 *   appear in client code (QUALITY_BAR / docs/archival/SECURITY.md).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readAppEnv, type AppEnv } from '@/app/env'
import type { Database } from './database.types'

/** The app-wide client type: one place to change if the schema grows. */
export type TypedSupabaseClient = SupabaseClient<Database>

/** Frozen auth options (parity with legacy `src/lib/supabase/client.ts`). */
export const CLIENT_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
} as const

/** Frozen realtime options: at most 10 events/second. */
export const CLIENT_REALTIME_OPTIONS = {
  params: { eventsPerSecond: 10 },
} as const

/** Build a typed client from an already-parsed environment. Pure and testable. */
export function createDataClient(env: AppEnv): TypedSupabaseClient {
  return createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { ...CLIENT_AUTH_OPTIONS },
    realtime: { params: { eventsPerSecond: CLIENT_REALTIME_OPTIONS.params.eventsPerSecond } },
  })
}

let cachedClient: TypedSupabaseClient | null = null

/**
 * Lazily create (and memoise) the app client from `import.meta.env`.
 *
 * Lazy on purpose: importing data modules must not validate the environment;
 * only the first request does. `readEnv` throws a readable error when the
 * required public values are missing (QUALITY_BAR: fail fast at the boundary).
 */
export function getSupabaseClient(): TypedSupabaseClient {
  if (!cachedClient) {
    // `readAppEnv` accesses each VITE_* key statically so production builds get
    // the literal values (spreading `import.meta.env` does not survive a build).
    cachedClient = createDataClient(readAppEnv())
  }
  return cachedClient
}

/**
 * Drop the memoised client. Used by tests and by HMR when public env values
 * change; not part of the runtime data API.
 */
export function resetSupabaseClient(): void {
  cachedClient = null
}
