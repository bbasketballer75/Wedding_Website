/**
 * Regression tests for the Sentry Content-Security-Policy allowlist.
 *
 * Background: production telemetry was silently dropped for weeks because
 * `connect-src` allowlisted an ingest host from a different Sentry org than the
 * DSN configured for this project. The browser blocked every envelope POST with
 * a `securitypolicyviolation` on `connect-src`, so Sentry never received a
 * single event even though the SDK initialised correctly.
 *
 * These tests fail when:
 *  - the deployed ingest host is missing from the enforced OR report-only CSP,
 *  - a stale `o<org>.ingest.*.sentry.io` host lingers in the allowlist,
 *  - a `VITE_SENTRY_DSN` in the environment points at a host the CSP blocks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const HEADERS_FILE = path.resolve(process.cwd(), 'public/_headers')

/** Sentry org id for `friendly-city-t9`, which owns the theporadas-com project. */
const EXPECTED_INGEST_HOST = 'o4511356027011072.ingest.us.sentry.io'

interface CspEntry {
  header: string
  policy: string
  connectSrc: string[]
}

function parseCspHeaders(): CspEntry[] {
  const raw = fs.readFileSync(HEADERS_FILE, 'utf8')
  const entries: CspEntry[] = []

  // The file uses CRLF; split on both so `$` anchors do not silently fail and
  // leave the suite asserting against an empty list.
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*(Content-Security-Policy(?:-Report-Only)?):\s*(.+)$/i)
    if (!match) continue

    const [, header, policy] = match
    const connect = policy
      .split(';')
      .map(part => part.trim())
      .find(part => /^connect-src\s/i.test(part))

    const connectSrc = connect
      ? connect
          .replace(/^connect-src\s+/i, '')
          .split(/\s+/)
          .filter(Boolean)
      : []

    entries.push({ header: header.trim(), policy: policy.trim(), connectSrc })
  }

  return entries
}

function ingestHosts(sources: string[]): string[] {
  return sources.filter(source => /\.ingest\.[a-z0-9-]+\.sentry\.io$/i.test(source))
}

describe('Sentry CSP allowlist (public/_headers)', () => {
  const cspEntries = parseCspHeaders()

  it('declares both an enforced and a report-only policy', () => {
    const headers = cspEntries.map(entry => entry.header.toLowerCase())
    expect(headers).toContain('content-security-policy')
    expect(headers).toContain('content-security-policy-report-only')
  })

  it.each(cspEntries)('$header allows the project ingest host', entry => {
    expect(entry.connectSrc).toContain(`https://${EXPECTED_INGEST_HOST}`)
  })

  it.each(cspEntries)('$header allowlists no stale Sentry ingest org', entry => {
    expect(ingestHosts(entry.connectSrc)).toEqual([`https://${EXPECTED_INGEST_HOST}`])
  })

  it('covers the host of a configured VITE_SENTRY_DSN', () => {
    const dsn = process.env.VITE_SENTRY_DSN
    if (!dsn) {
      // No DSN in this environment (CI, local dev) — the static assertion above
      // is the guard. Nothing to cross-check against.
      return
    }

    const host = new URL(dsn).hostname
    for (const entry of cspEntries) {
      expect(entry.connectSrc).toContain(`https://${host}`)
    }
  })
})
