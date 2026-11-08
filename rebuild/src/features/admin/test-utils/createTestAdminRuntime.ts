/**
 * Admin test runtime factory.
 *
 * Builds the in-memory auth client + admin API with a chosen starting session,
 * and keeps a handle on the API + audit spy for assertions.
 */
import { vi } from 'vitest'
import {
  createInMemoryAdminApi,
  createInMemoryAuthClient,
  type AdminApi,
  type AdminRuntime,
  type AdminUser,
  type InMemoryAdminApiOptions,
  type LogAuditInput,
} from '../data'
import { FIXTURE_ADMIN_USER, FIXTURE_NON_ADMIN_USER } from '../fixtures'

export type FixtureSession = 'admin' | 'member' | 'anonymous'

export interface TestAdminRuntime {
  runtime: AdminRuntime
  api: AdminApi
  auditSpy: ReturnType<typeof vi.fn>
}

function initialUserFor(session: FixtureSession): AdminUser | null {
  if (session === 'admin') return FIXTURE_ADMIN_USER
  if (session === 'member') return FIXTURE_NON_ADMIN_USER
  return null
}

export function getLastAuditInput(spy: ReturnType<typeof vi.fn>): LogAuditInput | undefined {
  const calls = spy.mock.calls as unknown as ReadonlyArray<readonly [LogAuditInput]>
  return calls.at(-1)?.[0]
}

export function createTestAdminRuntime(
  options: {
    session?: FixtureSession
    apiOptions?: InMemoryAdminApiOptions
  } = {}
): TestAdminRuntime {
  const auditSpy = vi.fn((entry: LogAuditInput) => entry)
  const api = createInMemoryAdminApi({ ...options.apiOptions, onAudit: auditSpy })
  const auth = createInMemoryAuthClient({ initialUser: initialUserFor(options.session ?? 'admin') })

  return { runtime: { auth, api }, api, auditSpy }
}
