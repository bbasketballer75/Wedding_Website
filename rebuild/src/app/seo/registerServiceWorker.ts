/**
 * Service-worker registration (Wave 8 W8-1).
 *
 * Production only, and only when the browser supports it:
 * - `import.meta.env.DEV` (and any non-production build) never registers;
 * - E2E runs set `window.__E2E__`, which also unregisters (the frozen public
 *   suite stubs SW registration for determinism, so a stray worker would race it);
 * - dev/preview leftovers are unregistered so stale preview caches cannot serve
 *   old assets;
 * - registration failures are swallowed (offline support is an enhancement, not
 *   a boot dependency).
 */

export type ServiceWorkerStatus =
  'disabled' | 'unsupported' | 'skipped-non-production' | 'unregistered' | 'registered' | 'failed'

export interface RegisterServiceWorkerOptions {
  /** Production-only opt-in (VITE_ENABLE_PWA). Defaults to enabled. */
  enabled?: boolean
  isDev?: boolean
  isE2E?: boolean
  navigatorRef?: Navigator
  /** Injected for tests; defaults to `navigator.serviceWorker.register`. */
  register?: (scriptUrl: string, options?: RegistrationOptions) => Promise<unknown>
  /** Injected for tests; defaults to `navigator.serviceWorker.getRegistrations`. */
  getRegistrations?: () => Promise<ReadonlyArray<{ unregister: () => Promise<unknown> }>>
  serviceWorkerUrl?: string
}

export const SERVICE_WORKER_URL = '/sw.js'

export async function registerServiceWorker(
  options: RegisterServiceWorkerOptions = {}
): Promise<ServiceWorkerStatus> {
  try {
    if (options.enabled === false) return 'disabled'

    const navigatorRef =
      options.navigatorRef ?? (typeof navigator === 'undefined' ? undefined : navigator)
    const container = navigatorRef?.serviceWorker
    if (!container) return 'unsupported'

    const isDev = options.isDev ?? Boolean(import.meta.env.DEV)
    const isE2E =
      options.isE2E ??
      (typeof window !== 'undefined' && Boolean((window as { __E2E__?: boolean }).__E2E__))

    const unregisterExisting = async (): Promise<ServiceWorkerStatus> => {
      try {
        const registrations =
          options.getRegistrations !== undefined
            ? await options.getRegistrations()
            : await container.getRegistrations()
        await Promise.all(registrations.map(registration => registration.unregister()))
        return 'unregistered'
      } catch {
        return 'failed'
      }
    }

    if (isDev || isE2E) return unregisterExisting()

    try {
      const register =
        options.register ??
        ((scriptUrl, registerOptions) => container.register(scriptUrl, registerOptions))
      await register(options.serviceWorkerUrl ?? SERVICE_WORKER_URL, { scope: '/' })
      return 'registered'
    } catch {
      return 'failed'
    }
  } catch {
    return 'failed'
  }
}
