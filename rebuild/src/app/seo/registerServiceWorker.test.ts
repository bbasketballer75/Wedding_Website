import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker, SERVICE_WORKER_URL } from './registerServiceWorker'

function fakeNavigator(options: {
  register?: (url: string, config?: RegistrationOptions) => Promise<unknown>
  getRegistrations?: () => Promise<ReadonlyArray<{ unregister: () => Promise<unknown> }>>
}): Navigator {
  return {
    serviceWorker: {
      register: options.register ?? vi.fn(() => Promise.resolve({})),
      getRegistrations: options.getRegistrations ?? vi.fn(() => Promise.resolve([])),
    },
  } as unknown as Navigator
}

describe('registerServiceWorker', () => {
  it('is a no-op when disabled (parity/preview builds)', async () => {
    const register = vi.fn(() => Promise.resolve({}))
    const navigatorRef = fakeNavigator({ register })
    await expect(
      registerServiceWorker({ enabled: false, navigatorRef, isDev: false, isE2E: false })
    ).resolves.toBe('disabled')
    expect(register).not.toHaveBeenCalled()
  })

  it('reports unsupported when the browser has no service worker API', async () => {
    await expect(
      registerServiceWorker({ navigatorRef: {} as Navigator, isDev: false, isE2E: false })
    ).resolves.toBe('unsupported')
  })

  it('registers /sw.js at the root scope in production', async () => {
    const register = vi.fn(() => Promise.resolve({}))
    const navigatorRef = fakeNavigator({ register })
    await expect(registerServiceWorker({ navigatorRef, isDev: false, isE2E: false })).resolves.toBe(
      'registered'
    )
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: '/' })
  })

  it('unregisters in dev so stale preview caches cannot serve old assets', async () => {
    const unregister = vi.fn(() => Promise.resolve(true))
    const register = vi.fn(() => Promise.resolve({}))
    const navigatorRef = fakeNavigator({
      register,
      getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])),
    })
    await expect(registerServiceWorker({ navigatorRef, isDev: true })).resolves.toBe('unregistered')
    expect(unregister).toHaveBeenCalledOnce()
    expect(register).not.toHaveBeenCalled()
  })

  it('unregisters in E2E runs (window.__E2E__)', async () => {
    const unregister = vi.fn(() => Promise.resolve(true))
    const register = vi.fn(() => Promise.resolve({}))
    const navigatorRef = fakeNavigator({
      register,
      getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])),
    })
    await expect(registerServiceWorker({ navigatorRef, isDev: false, isE2E: true })).resolves.toBe(
      'unregistered'
    )
    expect(unregister).toHaveBeenCalledOnce()
    expect(register).not.toHaveBeenCalled()
  })

  it('swallows registration failures', async () => {
    const navigatorRef = fakeNavigator({
      register: vi.fn(() => Promise.reject(new Error('blocked'))),
    })
    await expect(registerServiceWorker({ navigatorRef, isDev: false, isE2E: false })).resolves.toBe(
      'failed'
    )
  })

  it('swallows unregistration failures', async () => {
    const navigatorRef = fakeNavigator({
      getRegistrations: vi.fn(() => Promise.reject(new Error('blocked'))),
    })
    await expect(registerServiceWorker({ navigatorRef, isDev: true })).resolves.toBe('failed')
  })

  it('reads the E2E marker from window by default', async () => {
    const unregister = vi.fn(() => Promise.resolve(true))
    const navigatorRef = fakeNavigator({
      getRegistrations: vi.fn(() => Promise.resolve([{ unregister }])),
    })
    const windowRef = window as unknown as { __E2E__?: boolean }
    windowRef.__E2E__ = true
    try {
      await expect(registerServiceWorker({ navigatorRef, isDev: false })).resolves.toBe(
        'unregistered'
      )
    } finally {
      delete windowRef.__E2E__
    }
  })
})
