/**
 * Auth data API — session bootstrap, admin detection, sign-in/out.
 *
 * Mirrors the frozen app's semantics (`src/stores/authStore.ts` +
 * `src/providers/AuthProvider.tsx`) without the Zustand store:
 * - boot: read the persisted session (`getSession`) and derive admin state;
 * - admin = `user.app_metadata.role === 'admin'` (server-set, not user-spoofable);
 * - subscribe to `onAuthStateChange` while mounted, unsubscribe on cleanup;
 * - `isAdmin` here is a UI affordance only — Postgres RLS / `public.is_admin()`
 *   is the authoritative check.
 */
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient, type TypedSupabaseClient } from './client'
import { toDataError, type DataError } from './errors'

/** Query keys owned by this module. */
export const authKeys = {
  all: ['auth'] as const,
  session: ['auth', 'session'] as const,
}

/** Serialisable view of the auth state the UI needs. */
export interface AuthSnapshot {
  readonly user: User | null
  readonly session: Session | null
  readonly isAdmin: boolean
  readonly isAuthenticated: boolean
}

/** Auth snapshot before the first session read resolves. */
export const EMPTY_AUTH_SNAPSHOT: AuthSnapshot = {
  user: null,
  session: null,
  isAdmin: false,
  isAuthenticated: false,
}

/**
 * Pure admin check used by the app and directly unit-tested against the
 * `contracts/fixtures/adminSession.json` user shape.
 *
 * `app_metadata` is server-only (service role / admin API). NEVER read
 * `user_metadata.role`: any signed-in user can write it.
 */
export function isAdminUser(user: User | null | undefined): boolean {
  const metadata: unknown = user?.app_metadata
  if (typeof metadata !== 'object' || metadata === null) return false
  const role = (metadata as Record<string, unknown>).role
  return role === 'admin'
}

/** Derive the snapshot from a session (pure; used by boot and by realtime events). */
export function snapshotFromSession(session: Session | null): AuthSnapshot {
  const user = session?.user ?? null
  return {
    user,
    session,
    isAdmin: isAdminUser(user),
    isAuthenticated: session !== null && user !== null,
  }
}

/** Read the persisted session on boot. */
export async function fetchAuthSnapshot(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<AuthSnapshot> {
  const { data, error } = await client.auth.getSession()
  if (error) throw toDataError(error, 'Unable to restore your session. Please sign in again.')
  return snapshotFromSession(data.session)
}

/** Result of an email/password sign-in, mirroring the frozen store's contract. */
export type SignInResult = { success: true } | { success: false; error: DataError }

/** Email/password sign-in. Invalid credentials return a friendly, safe failure. */
export async function signInWithPassword(
  email: string,
  password: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<SignInResult> {
  try {
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: toDataError(error, 'Invalid email or password.'),
    }
  }
}

/** Sign out and clear the persisted session. */
export async function signOut(client: TypedSupabaseClient = getSupabaseClient()): Promise<void> {
  const { error } = await client.auth.signOut()
  if (error) throw toDataError(error, 'Could not sign out. Please try again.')
}

/** Force a session refresh (expired token / tab was asleep). */
export async function refreshAuthSession(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<AuthSnapshot> {
  const { data, error } = await client.auth.refreshSession()
  if (error) throw toDataError(error, 'Your session expired. Please sign in again.')
  return snapshotFromSession(data.session)
}

/** Subscription to auth changes with an explicit dispose handle. */
export interface AuthSubscription {
  unsubscribe: () => void
}

/**
 * Subscribe to Supabase auth state changes (SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED…).
 * The listener receives the derived snapshot, never the raw event payload.
 */
export function subscribeToAuthChanges(
  listener: (event: AuthChangeEvent, snapshot: AuthSnapshot) => void,
  client: TypedSupabaseClient = getSupabaseClient()
): AuthSubscription {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, session) => {
    listener(event, snapshotFromSession(session))
  })

  return { unsubscribe: () => subscription.unsubscribe() }
}

/** State + actions returned by `useAuth`. */
export interface UseAuthResult extends AuthSnapshot {
  readonly isLoading: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Session bootstrap + subscription hook.
 *
 * Uses TanStack Query as the single cache for the session snapshot; auth events
 * write into that cache so every consumer re-renders consistently. No UI is
 * rendered here — Wave 6 decides what to do with `isAdmin` / `isLoading`.
 */
export function useAuth(client?: TypedSupabaseClient): UseAuthResult {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery({
    queryKey: authKeys.session,
    queryFn: () => fetchAuthSnapshot(client),
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    const subscription = subscribeToAuthChanges((_event, snapshot) => {
      queryClient.setQueryData(authKeys.session, snapshot)
    }, client)
    return () => subscription.unsubscribe()
  }, [client, queryClient])

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const result = await signInWithPassword(email, password, client)
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: authKeys.all })
      }
      return result
    },
    [client, queryClient]
  )

  const signOutAndReset = useCallback(async (): Promise<void> => {
    await signOut(client)
    queryClient.setQueryData(authKeys.session, EMPTY_AUTH_SNAPSHOT)
  }, [client, queryClient])

  const refresh = useCallback(async (): Promise<void> => {
    const snapshot = await refreshAuthSession(client)
    queryClient.setQueryData(authKeys.session, snapshot)
  }, [client, queryClient])

  const snapshot = sessionQuery.data ?? EMPTY_AUTH_SNAPSHOT

  return {
    ...snapshot,
    isLoading: sessionQuery.isLoading,
    signIn,
    signOut: signOutAndReset,
    refresh,
  }
}
