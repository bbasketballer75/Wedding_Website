import { renderHook, waitFor } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  EMPTY_AUTH_SNAPSHOT,
  authKeys,
  fetchAuthSnapshot,
  isAdminUser,
  refreshAuthSession,
  signInWithPassword,
  signOut,
  snapshotFromSession,
  subscribeToAuthChanges,
  useAuth,
} from './auth'
import { DataError, isDataError } from './errors'
import { createMockClient } from './test-support/mock-client'
import { loadFixtures } from './test-support/fixtures'
import { createTestQueryWrapper } from './test-support/query-wrapper'

const fixtures = loadFixtures()
const adminUser = fixtures.adminSession.user as User
const adminSession = fixtures.adminSession.session as Session

describe('isAdminUser (app_metadata.role — never user_metadata)', () => {
  it('reads the seeded admin fixture as admin', () => {
    expect(isAdminUser(adminUser)).toBe(true)
  })

  it('rejects null, missing and non-admin roles', () => {
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
    expect(isAdminUser({} as User)).toBe(false)
    expect(isAdminUser({ app_metadata: { role: 'user' } } as unknown as User)).toBe(false)
    expect(isAdminUser({ app_metadata: { role: 'admin' } } as unknown as User)).toBe(true)
  })

  it('ignores a spoofable user_metadata.role value', () => {
    const spoofed = { app_metadata: {}, user_metadata: { role: 'admin' } } as unknown as User
    expect(isAdminUser(spoofed)).toBe(false)
  })

  it('tolerates malformed app_metadata', () => {
    expect(isAdminUser({ app_metadata: null } as unknown as User)).toBe(false)
    expect(isAdminUser({ app_metadata: 'admin' } as unknown as User)).toBe(false)
  })
})

describe('session snapshots', () => {
  it('derives user/isAdmin/isAuthenticated from a session', () => {
    const snapshot = snapshotFromSession(adminSession)

    expect(snapshot.user).toBe(adminSession.user)
    expect(snapshot.session).toBe(adminSession)
    expect(snapshot.isAdmin).toBe(true)
    expect(snapshot.isAuthenticated).toBe(true)
  })

  it('returns the empty snapshot for a null session', () => {
    const snapshot = snapshotFromSession(null)

    expect(snapshot.user).toBeNull()
    expect(snapshot.session).toBeNull()
    expect(snapshot.isAdmin).toBe(false)
    expect(snapshot.isAuthenticated).toBe(false)
    expect(snapshot).toEqual(EMPTY_AUTH_SNAPSHOT)
    expect(authKeys.session).toEqual(['auth', 'session'])
  })
})

describe('auth API', () => {
  it('fetchAuthSnapshot boots from the persisted session', async () => {
    const { client } = createMockClient({ auth: { session: adminSession } })

    const snapshot = await fetchAuthSnapshot(client)

    expect(snapshot.isAdmin).toBe(true)
    expect(snapshot.user?.email).toBe('admin@test.wedding')
  })

  it('fetchAuthSnapshot wraps a session read error in DataError', async () => {
    const { client } = createMockClient({
      auth: { getSessionError: { message: 'JWT expired', code: 'PGRST301' } },
    })

    await expect(fetchAuthSnapshot(client)).rejects.toBeInstanceOf(DataError)
  })

  it('signInWithPassword returns success for valid credentials', async () => {
    const { client } = createMockClient({ auth: { session: adminSession, user: adminUser } })
    const result = await signInWithPassword('admin@test.wedding', 'secret', client)
    expect(result.success).toBe(true)
  })

  it('signInWithPassword returns a friendly safe failure (raw message not leaked)', async () => {
    const { client } = createMockClient({
      auth: { signInError: { message: 'Invalid login credentials', status: 400 } },
    })

    const result = await signInWithPassword('admin@test.wedding', 'wrong', client)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(isDataError(result.error)).toBe(true)
      expect(result.error.message).toBe('Invalid email or password.')
      expect(result.error.message).not.toContain('Invalid login credentials')
    }
  })

  it('signOut resolves and wraps failures', async () => {
    const ok = createMockClient({})
    await expect(signOut(ok.client)).resolves.toBeUndefined()

    const failing = createMockClient({
      auth: { signOutError: new Error('network down') },
    })
    await expect(signOut(failing.client)).rejects.toBeInstanceOf(DataError)
  })

  it('refreshAuthSession returns the refreshed snapshot', async () => {
    const { client } = createMockClient({ auth: { session: adminSession, user: adminUser } })
    const snapshot = await refreshAuthSession(client)
    expect(snapshot.isAdmin).toBe(true)
  })

  it('subscribeToAuthChanges forwards derived snapshots and can unsubscribe', () => {
    const { client, auth } = createMockClient({ auth: { session: adminSession } })
    const listener = vi.fn()

    const subscription = subscribeToAuthChanges(listener, client)
    auth.emit('SIGNED_IN', adminSession)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      'SIGNED_IN',
      expect.objectContaining({ isAdmin: true, isAuthenticated: true })
    )

    subscription.unsubscribe()
    expect(auth.unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('useAuth', () => {
  function renderAuth(client: ReturnType<typeof createMockClient>['client']) {
    const wrapper = createTestQueryWrapper()
    const view = renderHook(() => useAuth(client), { wrapper: wrapper.Wrapper })
    return { ...view, queryClient: wrapper.queryClient }
  }

  it('bootstraps the session and exposes isAdmin', async () => {
    const { client } = createMockClient({ auth: { session: adminSession, user: adminUser } })
    const { result } = renderAuth(client)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('admin@test.wedding')
  })

  it('updates from auth state changes', async () => {
    const { client, auth } = createMockClient({ auth: { session: adminSession, user: adminUser } })
    const { result } = renderAuth(client)

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    auth.emit('SIGNED_OUT', null)
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
    expect(result.current.isAdmin).toBe(false)
  })

  it('signIn returns the result and refreshes the cached snapshot', async () => {
    const { client } = createMockClient({ auth: { session: adminSession, user: adminUser } })
    const { result } = renderAuth(client)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const signInResult = await result.current.signIn('admin@test.wedding', 'secret')

    expect(signInResult.success).toBe(true)
    await waitFor(() => expect(result.current.isAdmin).toBe(true))
  })

  it('signOut clears the snapshot; refresh re-reads it', async () => {
    const { client } = createMockClient({ auth: { session: adminSession, user: adminUser } })
    const { result } = renderAuth(client)

    await waitFor(() => expect(result.current.isAdmin).toBe(true))
    await result.current.signOut()
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))

    await result.current.refresh()
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
  })
})
