/**
 * Behavioural tests for the Sentry wiring in ErrorLoggingService.
 *
 * These lock in the contract that the deploy-verification runbook depends on:
 * init only happens with a DSN, the release is the build-provided identity,
 * PII stays off, and queued events are scrubbed before they leave the browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const initMock = vi.fn()
const captureExceptionMock = vi.fn()
const captureMessageMock = vi.fn()
const setUserMock = vi.fn()
const withScopeMock = vi.fn((callback: (scope: unknown) => void) => {
  callback({
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setLevel: vi.fn(),
    setUser: vi.fn(),
  })
})

vi.mock('@sentry/react', () => ({
  init: initMock,
  captureException: captureExceptionMock,
  captureMessage: captureMessageMock,
  setUser: setUserMock,
  withScope: withScopeMock,
}))

const DSN =
  'https://00000000000000000000000000000000@o4511356027011072.ingest.us.sentry.io/4512087393042432'

async function loadService() {
  vi.resetModules()
  const mod = await import('./ErrorLoggingService')
  return mod
}

function initOptions(): Record<string, unknown> {
  expect(initMock).toHaveBeenCalledTimes(1)
  return initMock.mock.calls[0][0] as Record<string, unknown>
}

describe('initErrorTracking', () => {
  beforeEach(() => {
    initMock.mockClear()
    captureExceptionMock.mockClear()
    vi.stubGlobal('__APP_VERSION__', 'ffc68009edc0772c42bb721df5d7a265b376d157')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('does not initialise the SDK when no DSN is configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    const { initErrorTracking } = await loadService()

    initErrorTracking()

    expect(initMock).not.toHaveBeenCalled()
  })

  it('initialises with the DSN, build release and PII disabled', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    vi.stubEnv('PROD', true)
    const { initErrorTracking } = await loadService()

    initErrorTracking()

    const options = initOptions()
    expect(options.dsn).toBe(DSN)
    expect(options.release).toBe('ffc68009edc0772c42bb721df5d7a265b376d157')
    expect(options.environment).toBe('production')
    expect(options.sendDefaultPii).toBe(false)
    expect(options.enabled).toBe(true)
    expect(options.tracesSampleRate).toBe(0.1)
  })

  it('prefers the build release over a stale VITE_APP_VERSION env value', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_APP_VERSION', '2026-04-14-launch')
    vi.stubGlobal('__APP_VERSION__', 'ffc68009edc0772c42bb721df5d7a265b376d157')
    const { initErrorTracking } = await loadService()

    initErrorTracking()

    // Regression: the static Netlify value used to win, so every deploy shared
    // one release and no source map artifact could be matched to it.
    expect(initOptions().release).toBe('ffc68009edc0772c42bb721df5d7a265b376d157')
    expect(initOptions().release).not.toBe('2026-04-14-launch')
  })
})

describe('beforeSend scrubbing', () => {
  beforeEach(() => {
    initMock.mockClear()
    vi.stubGlobal('__APP_VERSION__', 'test-release')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('redacts secrets carried in request URLs', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { initErrorTracking } = await loadService()
    initErrorTracking()

    const beforeSend = initOptions().beforeSend as (event: { request?: { url?: string } }) => {
      request?: { url?: string }
    }

    const scrubbed = beforeSend({
      request: { url: 'https://www.theporadas.com/gallery?token=abc123&password=hunter2&page=2' },
    })

    expect(scrubbed.request?.url).toBe(
      'https://www.theporadas.com/gallery?token=[FILTERED]&password=[FILTERED]&page=2'
    )
    expect(scrubbed.request?.url).not.toContain('abc123')
    expect(scrubbed.request?.url).not.toContain('hunter2')
  })

  it('leaves events without a request URL untouched', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    const { initErrorTracking } = await loadService()
    initErrorTracking()

    const beforeSend = initOptions().beforeSend as (
      event: Record<string, unknown>
    ) => Record<string, unknown>

    expect(beforeSend({ message: 'boom' })).toEqual({ message: 'boom' })
  })
})
