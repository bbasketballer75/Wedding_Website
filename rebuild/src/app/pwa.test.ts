import { describe, expect, it, vi } from 'vitest'
import { applyInstallMeta, initPwa, isPwaEnabled, PWA_ENV_FLAG, type PwaDocument } from './pwa'

function fakeDocument(): PwaDocument & {
  appended: Array<{ tagName: string; rel?: string; href?: string; name?: string; content?: string }>
} {
  const appended: Array<{
    tagName: string
    rel?: string
    href?: string
    name?: string
    content?: string
  }> = []
  const selectors = new Map<string, unknown>()

  const documentRef: PwaDocument = {
    createElement: tagName => {
      const element = {
        tagName,
        rel: '',
        href: '',
        name: '',
        content: '',
      }
      return element as unknown as HTMLLinkElement
    },
    head: {
      appendChild: node => {
        const element = node as unknown as (typeof appended)[number]
        appended.push(element)
        if (element.rel === 'manifest') selectors.set('link[rel="manifest"]', element)
        if (element.name) selectors.set(`meta[name="${element.name}"]`, element)
        return node
      },
    },
    querySelector: selector => (selectors.get(selector) as Element | undefined) ?? null,
  }
  return { ...documentRef, appended }
}

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

describe('isPwaEnabled', () => {
  it('only enables on the explicit production flag', () => {
    expect(PWA_ENV_FLAG).toBe('VITE_ENABLE_PWA')
    expect(isPwaEnabled({ VITE_ENABLE_PWA: '1' })).toBe(true)
    expect(isPwaEnabled({ VITE_ENABLE_PWA: '0' })).toBe(false)
    expect(isPwaEnabled({ VITE_ENABLE_PWA: '' })).toBe(false)
    expect(isPwaEnabled({})).toBe(false)
    expect(isPwaEnabled(undefined)).toBe(false)
  })
})

describe('applyInstallMeta', () => {
  it('is a no-op when disabled (frozen head preserved)', () => {
    const documentRef = fakeDocument()
    expect(applyInstallMeta({ enabled: false, documentRef })).toBe(false)
    expect(documentRef.appended).toHaveLength(0)
  })

  it('injects the manifest link and apple capability meta once', () => {
    const documentRef = fakeDocument()
    expect(applyInstallMeta({ enabled: true, documentRef })).toBe(true)
    expect(documentRef.appended).toHaveLength(1)
    expect(documentRef.appended[0]?.tagName).toBe('meta')
    expect(documentRef.appended[0]?.name).toBe('apple-mobile-web-app-capable')
    expect(documentRef.appended[0]?.content).toBe('yes')

    // Idempotent: second call adds nothing.
    expect(applyInstallMeta({ enabled: true, documentRef })).toBe(true)
    expect(documentRef.appended).toHaveLength(1)
  })

  it('never throws when the document is unavailable', () => {
    expect(() => applyInstallMeta({ enabled: true })).not.toThrow()
  })
})

describe('initPwa', () => {
  it('does nothing in a parity/preview build (no env flag)', async () => {
    const documentRef = fakeDocument()
    const register = vi.fn(() => Promise.resolve({}))
    const getRegistrations = vi.fn(() => Promise.resolve([]))
    const status = await initPwa({
      env: {},
      documentRef,
      navigatorRef: fakeNavigator({ register, getRegistrations }),
      isDev: false,
      isE2E: false,
    })
    expect(status).toBe('disabled')
    expect(documentRef.appended).toHaveLength(0)
    expect(register).not.toHaveBeenCalled()
    expect(getRegistrations).not.toHaveBeenCalled()
  })

  it('injects install metadata and registers the worker when the production flag is set', async () => {
    const documentRef = fakeDocument()
    const register = vi.fn(() => Promise.resolve({}))
    const status = await initPwa({
      env: { VITE_ENABLE_PWA: '1' },
      documentRef,
      navigatorRef: fakeNavigator({ register }),
      isDev: false,
      isE2E: false,
    })
    expect(status).toBe('registered')
    expect(documentRef.appended).toHaveLength(1)
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })

  it('unregisters instead of registering in E2E runs', async () => {
    const unregister = vi.fn(() => Promise.resolve(true))
    const getRegistrations = vi.fn(() => Promise.resolve([{ unregister }]))
    const register = vi.fn(() => Promise.resolve({}))
    const status = await initPwa({
      enabled: true,
      documentRef: fakeDocument(),
      navigatorRef: fakeNavigator({ register, getRegistrations }),
      isDev: false,
      isE2E: true,
    })
    expect(status).toBe('unregistered')
    expect(register).not.toHaveBeenCalled()
    expect(unregister).toHaveBeenCalledOnce()
  })

  it('swallows registration failures and reports the status', async () => {
    const status = await initPwa({
      enabled: true,
      documentRef: fakeDocument(),
      navigatorRef: fakeNavigator({ register: vi.fn(() => Promise.reject(new Error('blocked'))) }),
      isDev: false,
      isE2E: false,
    })
    expect(status).toBe('failed')
  })
})
