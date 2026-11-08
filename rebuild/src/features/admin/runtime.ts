/**
 * Default admin runtime (stub) + test-friendly factory.
 *
 * `getDefaultAdminRuntime()` is the Wave-7 wiring point: until the Lead binds
 * the real `shared/data` auth/API in the app router, the shell and login page
 * share one in-memory runtime so the stub sign-in flow is coherent. Tests and the
 * future app wiring pass an explicit `runtime` instead of touching the singleton.
 */
import {
  createInMemoryAdminApi,
  createInMemoryAuthClient,
  type AdminApi,
  type AdminAuthClient,
  type AdminRuntime,
} from './data'
import { ADMIN_FIXTURES } from './fixtures'

let defaultRuntime: AdminRuntime | null = null

export interface CreateAdminRuntimeOptions {
  auth?: AdminAuthClient
  api?: AdminApi
}

export function createAdminRuntime(options: CreateAdminRuntimeOptions = {}): AdminRuntime {
  return {
    auth: options.auth ?? createInMemoryAuthClient({ credentials: ADMIN_FIXTURES.credentials }),
    api: options.api ?? createInMemoryAdminApi(),
  }
}

export function getDefaultAdminRuntime(): AdminRuntime {
  defaultRuntime ??= createAdminRuntime()
  return defaultRuntime
}

/** Test helper: forget the singleton so each suite starts from fixtures. */
export function resetDefaultAdminRuntime(): void {
  defaultRuntime = null
}
