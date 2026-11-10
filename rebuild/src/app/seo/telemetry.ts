/**
 * Analytics + Sentry bootstrap (Wave 8 W8-1).
 *
 * Deliberately dependency-free (no new packages) and conservative:
 * - env-guarded: without `VITE_GA_ID` / `VITE_SENTRY_DSN` nothing loads and no
 *   network request is made;
 * - consent-aware stub: nothing is sent until consent is explicitly granted
 *   (`localStorage['wedding-telemetry-consent'] === 'granted'`); the consent UI
 *   itself is an owner/product decision, this module only honours the flag;
 * - no PII and no session replay: only a sanitised exception message is sent;
 * → never throws; every failure is swallowed so app boot cannot be affected.
 */

export const TELEMETRY_CONSENT_KEY = 'wedding-telemetry-consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    __E2E__?: boolean
  }
}

export type TelemetryConsent = 'granted' | 'denied' | 'unset'
export type TelemetryStatus = 'disabled-no-env' | 'disabled-no-consent' | 'disabled-e2e' | 'enabled'

export interface TelemetryConfig {
  gaId?: string
  sentryDsn?: string
}

/** Minimal structural seams so the module is testable without a browser. */
export interface ConsentStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface TelemetryDocument {
  createElement: (tagName: string) => HTMLElement
  head: { appendChild: (node: Node) => Node }
  querySelector: (selectors: string) => Element | null
}

export interface TelemetryWindow {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __E2E__?: boolean
  addEventListener: (type: string, listener: (event: unknown) => void) => void
  removeEventListener: (type: string, listener: (event: unknown) => void) => void
  location?: { href?: string }
}

export interface TelemetryHandle {
  status: TelemetryStatus
  /** Manually report an exception (deduped by the caller when needed). */
  captureException: (error: unknown) => void
  /** Remove Sentry listeners; used by tests and privacy revoke flows. */
  dispose: () => void
}

export const NOOP_TELEMETRY: TelemetryHandle = {
  status: 'disabled-no-env',
  captureException: () => undefined,
  dispose: () => undefined,
}

function trimToUndefined(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Read the two supported public env values from any env-shaped record. */
export function resolveTelemetryConfig(
  env: Record<string, string | boolean | undefined> | undefined
): TelemetryConfig {
  const config: TelemetryConfig = {}
  const gaId = trimToUndefined(typeof env?.VITE_GA_ID === 'string' ? env.VITE_GA_ID : undefined)
  const sentryDsn = trimToUndefined(
    typeof env?.VITE_SENTRY_DSN === 'string' ? env.VITE_SENTRY_DSN : undefined
  )
  if (gaId) config.gaId = gaId
  if (sentryDsn) config.sentryDsn = sentryDsn
  return config
}

export function readTelemetryConsent(storage: ConsentStorage): TelemetryConsent {
  try {
    const value = storage.getItem(TELEMETRY_CONSENT_KEY)
    if (value === 'granted') return 'granted'
    if (value === 'denied') return 'denied'
    return 'unset'
  } catch {
    return 'unset'
  }
}

export function setTelemetryConsent(storage: ConsentStorage, granted: boolean): void {
  try {
    storage.setItem(TELEMETRY_CONSENT_KEY, granted ? 'granted' : 'denied')
  } catch {
    /* storage blocked (private mode) -- consent stays unset, nothing is sent */
  }
}

/** Browser storage seam; falls back to an in-memory no-op when unavailable. */
export function browserConsentStorage(): ConsentStorage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {
    /* fall through */
  }
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
}

export interface ParsedSentryDsn {
  envelopeUrl: string
}

/** Parse a Sentry DSN into the envelope endpoint (no SDK, no extra deps). */
export function parseSentryDsn(dsn: string | undefined): ParsedSentryDsn | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    const publicKey = url.username
    const projectId = url.pathname.replace(/^\//, '')
    if (!publicKey || !projectId || !url.hostname) return null
    return {
      envelopeUrl: `${url.protocol}//${url.hostname}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7`,
    }
  } catch {
    return null
  }
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const LONG_ID_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g

/**
 * Strip obvious PII from a thrown value before it leaves the browser:
 * emails and long ids/tokens are redacted, URLs keep only origin+pathname, and
 * the result is capped. No stack traces, no user id, no query strings.
 */
export function sanitizeTelemetryText(value: unknown, maxLength = 300): string {
  const raw =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === 'string'
        ? value
        : 'Unknown error'
  let text = raw.replace(/\s+/g, ' ').trim()
  text = text.replace(EMAIL_PATTERN, '[redacted-email]')
  text = text.replace(/\bhttps?:\/\/[^\s]+/g, match => {
    try {
      const url = new URL(match)
      return `${url.origin}${url.pathname}`
    } catch {
      return '[redacted-url]'
    }
  })
  text = text.replace(LONG_ID_PATTERN, '[redacted-id]')
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

/** Build one Sentry envelope document: header line + event item. */
export function buildSentryEnvelope({
  dsn,
  message,
  timestamp = Date.now(),
}: {
  dsn: string
  message: unknown
  timestamp?: number
}): string | null {
  const parsed = parseSentryDsn(dsn)
  if (!parsed) return null
  const event = {
    event_id: createEventId(timestamp),
    timestamp: timestamp / 1000,
    platform: 'javascript',
    level: 'error',
    release: 'wedding-archive-rebuild',
    exception: {
      values: [{ type: 'Error', value: sanitizeTelemetryText(message) }],
    },
    // No user, no request data, no breadcrumbs, no replay.
  }
  return [
    JSON.stringify({ sent_at: new Date(timestamp).toISOString(), dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')
}

function createEventId(timestamp: number): string {
  const seed = `${timestamp}-${Math.random().toString(16).slice(2)}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return `${hash.toString(16).padStart(8, '0')}${hash.toString(16).padStart(8, '0')}`
}

/** Inject the GA script exactly once, with privacy-preserving defaults. */
export function loadGoogleAnalytics({
  gaId,
  documentRef,
  windowRef,
}: {
  gaId: string
  documentRef?: TelemetryDocument
  windowRef?: TelemetryWindow
}): boolean {
  try {
    const doc = documentRef ?? (typeof document === 'undefined' ? undefined : document)
    const win = windowRef ?? (typeof window === 'undefined' ? undefined : window)
    if (!doc || !win) return false
    if (doc.querySelector('script[data-ga-id]')) return true

    const dataLayer: unknown[] = win.dataLayer ?? []
    win.dataLayer = dataLayer
    win.gtag =
      win.gtag ??
      ((...args: unknown[]) => {
        // gtag.js replaces this stub once loaded.
        dataLayer.push(args)
      })
    win.gtag('js', new Date())
    win.gtag('config', gaId, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })

    const script = doc.createElement('script') as HTMLScriptElement
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`
    script.setAttribute('data-ga-id', gaId)
    doc.head.appendChild(script)
    return true
  } catch {
    return false
  }
}

export interface InitTelemetryOptions {
  env?: Record<string, string | boolean | undefined>
  storage?: ConsentStorage
  documentRef?: TelemetryDocument
  windowRef?: TelemetryWindow
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>
  isE2E?: boolean
}

interface SentryReporter {
  capture: (error: unknown) => void
  dispose: () => void
}

function createSentryReporter({
  dsn,
  fetchImpl,
  windowRef,
}: {
  dsn: string
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>
  windowRef: TelemetryWindow
}): SentryReporter {
  const send = (error: unknown) => {
    const envelope = buildSentryEnvelope({ dsn, message: error })
    if (!envelope) return
    try {
      void Promise.resolve(
        fetchImpl(parseSentryDsn(dsn)?.envelopeUrl ?? '', {
          method: 'POST',
          body: envelope,
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          keepalive: true,
        })
      ).catch(() => undefined)
    } catch {
      /* reporting must never throw */
    }
  }

  const onError = (event: unknown) => {
    const candidate =
      typeof event === 'object' && event !== null && 'error' in event
        ? (event as { error?: unknown }).error
        : undefined
    send(candidate ?? 'window error')
  }
  const onRejection = (event: unknown) => {
    const candidate =
      typeof event === 'object' && event !== null && 'reason' in event
        ? (event as { reason?: unknown }).reason
        : undefined
    send(candidate ?? 'unhandled rejection')
  }

  windowRef.addEventListener('error', onError)
  windowRef.addEventListener('unhandledrejection', onRejection)

  return {
    capture: send,
    dispose: () => {
      windowRef.removeEventListener('error', onError)
      windowRef.removeEventListener('unhandledrejection', onRejection)
    },
  }
}

/**
 * Boot telemetry. Returns a handle whose `status` explains the decision, so
 * tests/ops can assert that an unset or unconsented environment sends nothing.
 */
export function initTelemetry(options: InitTelemetryOptions = {}): TelemetryHandle {
  try {
    const env =
      options.env ?? (typeof import.meta.env === 'undefined' ? undefined : import.meta.env)
    const config = resolveTelemetryConfig(env)
    if (!config.gaId && !config.sentryDsn) return NOOP_TELEMETRY

    const windowRef = options.windowRef ?? (typeof window === 'undefined' ? undefined : window)
    if (!windowRef) return NOOP_TELEMETRY

    const isE2E = options.isE2E ?? Boolean(windowRef.__E2E__)
    if (isE2E) {
      return { status: 'disabled-e2e', captureException: () => undefined, dispose: () => undefined }
    }

    const storage = options.storage ?? browserConsentStorage()
    if (readTelemetryConsent(storage) !== 'granted') {
      return {
        status: 'disabled-no-consent',
        captureException: () => undefined,
        dispose: () => undefined,
      }
    }

    if (config.gaId) {
      loadGoogleAnalytics({
        gaId: config.gaId,
        ...(options.documentRef ? { documentRef: options.documentRef } : {}),
        windowRef,
      })
    }

    const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
    if (!config.sentryDsn || !fetchImpl) {
      return { status: 'enabled', captureException: () => undefined, dispose: () => undefined }
    }

    const reporter = createSentryReporter({ dsn: config.sentryDsn, fetchImpl, windowRef })
    return {
      status: 'enabled',
      captureException: reporter.capture,
      dispose: reporter.dispose,
    }
  } catch {
    return NOOP_TELEMETRY
  }
}
