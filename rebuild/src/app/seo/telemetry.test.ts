import { describe, expect, it, vi } from 'vitest'
import {
  buildSentryEnvelope,
  browserConsentStorage,
  initTelemetry,
  loadGoogleAnalytics,
  parseSentryDsn,
  readTelemetryConsent,
  resolveTelemetryConfig,
  sanitizeTelemetryText,
  setTelemetryConsent,
  TELEMETRY_CONSENT_KEY,
  type ConsentStorage,
  type TelemetryDocument,
  type TelemetryWindow,
} from './telemetry'

function memoryStorage(initial: Record<string, string> = {}): ConsentStorage {
  const store = new Map(Object.entries(initial))
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: key => {
      store.delete(key)
    },
  }
}

const DSN = 'https://abc123@o4511356027011072.ingest.us.sentry.io/4509700000000000'

interface FakeWindow extends TelemetryWindow {
  listeners: Map<string, (event: unknown) => void>
  dispatch: (type: string, event: unknown) => void
}

function fakeWindow(): FakeWindow {
  const listeners = new Map<string, (event: unknown) => void>()
  return {
    listeners,
    dataLayer: undefined,
    addEventListener: (type, listener) => {
      listeners.set(type, listener)
    },
    removeEventListener: type => {
      listeners.delete(type)
    },
    dispatch: (type, event) => {
      listeners.get(type)?.(event)
    },
  }
}

function fakeDocument(): TelemetryDocument & {
  head: { appendChild: (node: Node) => Node }
  appended: unknown[]
} {
  const appended: unknown[] = []
  return {
    appended,
    createElement: tagName => {
      const element = {
        tagName,
        attributes: new Map<string, string>(),
        setAttribute: (name: string, value: string) => {
          element.attributes.set(name, value)
        },
      }
      return element as unknown as HTMLScriptElement
    },
    head: {
      appendChild: node => {
        appended.push(node)
        return node
      },
    },
    querySelector: () => null,
  }
}

describe('resolveTelemetryConfig', () => {
  it('is fully disabled without env values', () => {
    expect(resolveTelemetryConfig(undefined)).toEqual({})
    expect(resolveTelemetryConfig({})).toEqual({})
    expect(resolveTelemetryConfig({ VITE_GA_ID: '  ', VITE_SENTRY_DSN: '' })).toEqual({})
  })

  it('reads and trims both optional ids', () => {
    expect(
      resolveTelemetryConfig({ VITE_GA_ID: ' G-TEST123 ', VITE_SENTRY_DSN: ` ${DSN} ` })
    ).toEqual({ gaId: 'G-TEST123', sentryDsn: DSN })
  })
})

describe('consent', () => {
  it('defaults to unset and round-trips granted/denied', () => {
    const storage = memoryStorage()
    expect(readTelemetryConsent(storage)).toBe('unset')
    setTelemetryConsent(storage, true)
    expect(storage.getItem(TELEMETRY_CONSENT_KEY)).toBe('granted')
    expect(readTelemetryConsent(storage)).toBe('granted')
    setTelemetryConsent(storage, false)
    expect(readTelemetryConsent(storage)).toBe('denied')
  })

  it('treats a throwing storage as unset', () => {
    const storage: ConsentStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => undefined,
    }
    expect(readTelemetryConsent(storage)).toBe('unset')
    expect(() => setTelemetryConsent(storage, true)).not.toThrow()
  })

  it('browserConsentStorage never throws without a window', () => {
    expect(() => browserConsentStorage().getItem(TELEMETRY_CONSENT_KEY)).not.toThrow()
    expect(browserConsentStorage().getItem(TELEMETRY_CONSENT_KEY)).toBeNull()
  })
})

describe('parseSentryDsn', () => {
  it('builds the envelope endpoint from a valid DSN', () => {
    const parsed = parseSentryDsn(DSN)
    expect(parsed?.envelopeUrl).toBe(
      'https://o4511356027011072.ingest.us.sentry.io/api/4509700000000000/envelope/?sentry_key=abc123&sentry_version=7'
    )
  })

  it('returns null for missing or malformed DSNs', () => {
    expect(parseSentryDsn(undefined)).toBeNull()
    expect(parseSentryDsn('not-a-url')).toBeNull()
    expect(parseSentryDsn('https://no-key.example.com')).toBeNull()
  })
})

describe('sanitizeTelemetryText', () => {
  it('removes emails, URL query strings and long ids', () => {
    const sanitized = sanitizeTelemetryText(
      'Failed for guest@example.com at https://www.theporadas.com/gallery?token=SECRET#x and id abcdefghijklmnopqrstuvwxyz012345'
    )
    expect(sanitized).not.toContain('guest@example.com')
    expect(sanitized).toContain('[redacted-email]')
    expect(sanitized).not.toContain('token=SECRET')
    expect(sanitized).toContain('https://www.theporadas.com/gallery')
    expect(sanitized).not.toContain('abcdefghijklmnopqrstuvwxyz012345')
    expect(sanitized).toContain('[redacted-id]')
  })

  it('caps the message and handles non-Error values', () => {
    const error = new Error('x'.repeat(400))
    expect(sanitizeTelemetryText(error).length).toBeLessThanOrEqual(301)
    expect(sanitizeTelemetryText(undefined)).toBe('Unknown error')
    expect(sanitizeTelemetryText('plain   text')).toBe('plain text')
  })
})

describe('buildSentryEnvelope', () => {
  it('builds a 3-line envelope with a sanitized event and no PII fields', () => {
    const envelope = buildSentryEnvelope({
      dsn: DSN,
      message: new Error('boom guest@example.com'),
      timestamp: 1_700_000_000_000,
    })
    expect(envelope).not.toBeNull()
    const lines = (envelope ?? '').split('\n')
    expect(lines).toHaveLength(3)
    const event = JSON.parse(lines[2] ?? '{}') as {
      event_id: string
      user?: unknown
      breadcrumbs?: unknown
      exception: { values: Array<{ value: string }> }
    }
    expect(event.event_id).toMatch(/^[0-9a-f]{16}$/)
    expect(event.user).toBeUndefined()
    expect(event.breadcrumbs).toBeUndefined()
    expect(event.exception.values[0]?.value).toContain('[redacted-email]')
    expect(lines[0]).toContain('"sent_at"')
    expect(lines[1]).toBe('{"type":"event"}')
  })

  it('returns null for an invalid DSN', () => {
    expect(buildSentryEnvelope({ dsn: 'bad', message: 'x' })).toBeNull()
  })
})

describe('loadGoogleAnalytics', () => {
  it('injects the gtag script once with privacy defaults', () => {
    const doc = fakeDocument()
    const win = fakeWindow()
    expect(loadGoogleAnalytics({ gaId: 'G-TEST123', documentRef: doc, windowRef: win })).toBe(true)
    expect(doc.appended).toHaveLength(1)
    const script = doc.appended[0] as {
      src: string
      async: boolean
      attributes: Map<string, string>
    }
    expect(script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123')
    expect(script.async).toBe(true)
    expect(script.attributes.get('data-ga-id')).toBe('G-TEST123')
    expect(win.dataLayer).toBeDefined()
    expect(win.dataLayer).toHaveLength(2) // gtag('js') + gtag('config') on the stub
  })

  it('returns a boolean without explicit seams (never throws)', () => {
    expect(typeof loadGoogleAnalytics({ gaId: 'G-TEST123' })).toBe('boolean')
  })
})

describe('initTelemetry', () => {
  it('sends nothing when the env is unset', () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null)))
    const handle = initTelemetry({ env: {}, fetchImpl, windowRef: fakeWindow() })
    expect(handle.status).toBe('disabled-no-env')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(() => handle.captureException(new Error('x'))).not.toThrow()
  })

  it('sends nothing without consent even when the env is configured', () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null)))
    const handle = initTelemetry({
      env: { VITE_GA_ID: 'G-TEST123', VITE_SENTRY_DSN: DSN },
      storage: memoryStorage(),
      fetchImpl,
      windowRef: fakeWindow(),
    })
    expect(handle.status).toBe('disabled-no-consent')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends nothing in E2E mode', () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null)))
    const handle = initTelemetry({
      env: { VITE_SENTRY_DSN: DSN },
      storage: memoryStorage({ [TELEMETRY_CONSENT_KEY]: 'granted' }),
      fetchImpl,
      windowRef: { ...fakeWindow(), __E2E__: true },
    })
    expect(handle.status).toBe('disabled-e2e')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('captures a sanitized exception envelope when enabled and consented', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null)))
    const doc = fakeDocument()
    const win = fakeWindow()
    const handle = initTelemetry({
      env: { VITE_SENTRY_DSN: DSN },
      storage: memoryStorage({ [TELEMETRY_CONSENT_KEY]: 'granted' }),
      fetchImpl,
      windowRef: win,
      documentRef: doc,
    })
    expect(handle.status).toBe('enabled')

    handle.captureException(new Error('crashed for guest@example.com'))
    await Promise.resolve()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = init.body as unknown as string
    expect(url).toContain('/api/4509700000000000/envelope/')
    expect(body).toContain('[redacted-email]')
    expect(body).not.toContain('guest@example.com')
    expect(init.keepalive).toBe(true)

    // Window error/rejection listeners are real and removed on dispose.
    win.dispatch('error', { error: new Error('window failure') })
    win.dispatch('unhandledrejection', { reason: new Error('rejection') })
    await Promise.resolve()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    handle.dispose()
    expect(win.listeners.size).toBe(0)
  })

  it('captures window errors through listeners', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null)))
    const win = fakeWindow()
    const handle = initTelemetry({
      env: { VITE_SENTRY_DSN: DSN },
      storage: memoryStorage({ [TELEMETRY_CONSENT_KEY]: 'granted' }),
      fetchImpl,
      windowRef: win,
    })
    win.dispatch('error', {})
    await Promise.resolve()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    handle.dispose()
  })

  it('never throws and reports enabled when GA-only config is present', () => {
    const doc = fakeDocument()
    const handle = initTelemetry({
      env: { VITE_GA_ID: 'G-TEST123' },
      storage: memoryStorage({ [TELEMETRY_CONSENT_KEY]: 'granted' }),
      documentRef: doc,
      windowRef: fakeWindow(),
    })
    expect(handle.status).toBe('enabled')
    expect(doc.appended).toHaveLength(1)
    expect(() => handle.captureException(new Error('x'))).not.toThrow()
  })
})
