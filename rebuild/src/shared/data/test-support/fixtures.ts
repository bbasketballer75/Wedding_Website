/**
 * Test-only loaders for the committed API contracts fixtures.
 *
 * Uses `node:fs` rather than JSON imports so the fixtures stay outside the app
 * bundle and the exact committed bytes are what tests read. The directory is
 * resolved from the test process cwd (vitest runs from `rebuild/`), with a
 * fallback so the file also works when invoked from the repo root.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function resolveFixturesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', 'contracts', 'fixtures'),
    path.resolve(process.cwd(), 'contracts', 'fixtures'),
  ]
  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) {
    throw new Error(
      `contracts/fixtures not found from ${process.cwd()} (run the rebuild tests from rebuild/)`
    )
  }
  return found
}

const FIXTURES_DIR = resolveFixturesDir()

/** Read and parse one fixture file (e.g. `photos.json`). */
export function loadFixture<Shape = unknown>(fileName: string): Shape {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, fileName), 'utf8')) as Shape
}

/** Typed fixture bundles used across the data-layer tests. */
export interface FixtureBundle {
  photos: unknown[]
  guestbook: { messages: unknown[]; adminMessages: unknown[]; submitResponse: unknown }
  guestUploads: { approved: unknown[]; pending: unknown[]; insertResponse: unknown[] }
  editorial: unknown[]
  activity: unknown[]
  claims: { pending: unknown[]; approved: unknown[]; rejected: unknown[] }
  guestTokens: {
    valid: unknown
    invalidToken: string
    invalidResponse: unknown
    identity: unknown
    identityWithClaims: unknown
  }
  adminSession: {
    session: unknown
    user: unknown
    dashboardCounts: Record<string, Array<{ count: number }>>
    auditLog: unknown[]
  }
}

/** Load every fixture file the data layer tests need. */
export function loadFixtures(): FixtureBundle {
  return {
    photos: loadFixture<unknown[]>('photos.json'),
    guestbook: loadFixture<FixtureBundle['guestbook']>('guestbook.json'),
    guestUploads: loadFixture<FixtureBundle['guestUploads']>('guestUploads.json'),
    editorial: loadFixture<unknown[]>('editorial.json'),
    activity: loadFixture<unknown[]>('activity.json'),
    claims: loadFixture<FixtureBundle['claims']>('claims.json'),
    guestTokens: loadFixture<FixtureBundle['guestTokens']>('guestTokens.json'),
    adminSession: loadFixture<FixtureBundle['adminSession']>('adminSession.json'),
  }
}
