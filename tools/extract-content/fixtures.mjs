#!/usr/bin/env node
/**
 * Ports the frozen end-to-end mock data into stack-neutral JSON fixtures.
 *
 * The parity harness and the rebuild's tests must not depend on Playwright or
 * on TypeScript. They consume `contracts/fixtures/*.json`, which this script
 * generates from the frozen e2e mocks so the values stay IDENTICAL to what the
 * legacy suite asserts against:
 *
 *   tests/e2e/support/mockData.ts        public REST/RPC fixtures
 *   tests/e2e/support/adminMockData.ts   admin session, moderation queues, editorial slots
 *   tests/e2e/support/adminSite.ts       Supabase auth storage key shape
 *   tests/e2e/support/publicSite.ts      guest share-token / identity responses
 *
 * Determinism:
 *   The one volatile value in the mocks is `adminSession.expires_at`, which the
 *   Playwright helper computes as `Math.floor(Date.now() / 1000) + 3600`. Wall
 *   clock time is not allowed in a committed artifact, so it is pinned to one
 *   hour after `contracts/ui.json.fixedNow` (the single shared capture clock).
 *   Everything else is copied verbatim.
 *
 * Usage:
 *   node tools/extract-content/fixtures.mjs
 *   node tools/extract-content/fixtures.mjs --check   # exit 1 on drift vs disk
 */
import { readFile } from 'node:fs/promises'
import { importBundledModule } from './bundle.mjs'
import { readJsonIfExists } from '../lib/fs.mjs'
import { writeContractJson } from './write-contract-json.mjs'
import { repoPath } from '../lib/paths.mjs'
import { die, info, ok, step } from '../lib/log.mjs'

const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check')

const MOCK_DATA_ENTRY = `
import * as mockData from './mockData'
import * as adminMockData from './adminMockData'
export { mockData, adminMockData }
`

async function readLegacy(relativePath) {
  return readFile(repoPath(relativePath), 'utf8')
}

function extractLiteral(source, pattern, label) {
  const match = source.match(pattern)
  if (!match) {
    die(`fixtures: could not find ${label} in the frozen e2e mocks — refusing to invent it`)
  }
  return match[1]
}

async function loadFixedNow() {
  const ui = await readJsonIfExists(repoPath('contracts', 'ui.json'))
  if (!ui?.fixedNow) {
    die('fixtures: contracts/ui.json.fixedNow is missing — it is the shared capture clock')
  }
  return ui.fixedNow
}

async function loadMocks() {
  const module = await importBundledModule(MOCK_DATA_ENTRY, {
    resolveDir: repoPath('tests', 'e2e', 'support'),
    sourcefile: 'fixtures-entry.ts',
  })
  return { mockData: module.mockData, adminMockData: module.adminMockData }
}

async function buildFixtures(fixedNow) {
  const [{ mockData, adminMockData }, adminSiteSource, publicSiteSource] = await Promise.all([
    loadMocks(),
    readLegacy('tests/e2e/support/adminSite.ts'),
    readLegacy('tests/e2e/support/publicSite.ts'),
  ])

  // adminSite.ts derives the auth storage key from the Supabase project URL:
  //   const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
  //   export const SUPABASE_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`
  // The playwright config default URL is the public project URL that the frozen
  // build was made against (also visible in dist/index.html's dns-prefetch).
  const supabaseUrl = extractLiteral(
    adminSiteSource,
    /process\.env\.VITE_SUPABASE_URL \?\? '([^']+)'/,
    'default Supabase URL'
  )
  const storageKeyTemplate = extractLiteral(
    adminSiteSource,
    /SUPABASE_STORAGE_KEY = `([^`]+)`/,
    'Supabase auth storage key template'
  )
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = storageKeyTemplate.replace('${PROJECT_REF}', projectRef)

  // Guest showcase token fixtures are inline responses in publicSite.ts.
  const validGuestEmail = extractLiteral(
    publicSiteSource,
    /guest_email: '([^']+)', token: 'valid-showcase-token'/,
    'valid guest token email'
  )
  const invalidGuestToken = extractLiteral(
    publicSiteSource,
    /tokenParam === 'eq\.([^']+)'\) \{\n\s+await fulfillJson\(route, null\)/,
    'invalid guest token value'
  )
  const identityDisplayName = extractLiteral(
    publicSiteSource,
    /fulfillJson\(route, \{ display_name: '([^']+)' \}\)/,
    'guest identity display name'
  )

  const pinnedExpiresAt = Math.floor(Date.parse(fixedNow) / 1000) + 3600

  return {
    'photos.json': mockData.galleryPhotos,
    'guestbook.json': {
      messages: mockData.guestbookMessagesWithComments,
      adminMessages: adminMockData.adminGuestbookMessages,
      submitResponse: mockData.guestbookSubmitResponse,
    },
    'guestUploads.json': {
      approved: mockData.approvedGuestUploads,
      pending: adminMockData.pendingUploads,
      insertResponse: mockData.guestUploadInsertResponse,
    },
    'activity.json': mockData.mockActivityLog,
    'editorial.json': adminMockData.featuredSlots,
    'claims.json': {
      pending: adminMockData.mockPendingClaims,
      approved: adminMockData.mockApprovedClaims,
      rejected: adminMockData.mockRejectedClaims,
    },
    'guestTokens.json': {
      valid: { guest_email: validGuestEmail, token: 'valid-showcase-token' },
      invalidToken: invalidGuestToken,
      invalidResponse: null,
      identity: { display_name: identityDisplayName },
      identityWithClaims: {
        id: 'identity-jane',
        photo_claims: [
          {
            id: 'claim-1',
            status: 'approved',
            photos: mockData.galleryPhotos[0],
          },
        ],
      },
    },
    'adminSession.json': {
      storageKey,
      session: {
        ...adminMockData.adminSession,
        expires_at: pinnedExpiresAt,
      },
      user: adminMockData.adminUser,
      dashboardCounts: {
        photos: adminMockData.dashboardPhotosCount,
        pendingUploads: adminMockData.dashboardPendingCount,
        guestbookMessages: adminMockData.dashboardMessagesCount,
        approvedUploads: adminMockData.dashboardApprovedUploadsCount,
      },
      auditLog: adminMockData.auditLogEntries,
    },
  }
}

step('Port e2e fixtures')
const fixedNow = await loadFixedNow()
info(`pinning admin session expiry from contracts/ui.json.fixedNow (${fixedNow})`)

const fixtures = await buildFixtures(fixedNow)
let drift = 0

for (const [fileName, payload] of Object.entries(fixtures)) {
  const target = repoPath('contracts', 'fixtures', fileName)
  if (CHECK_ONLY) {
    const existing = await readJsonIfExists(target)
    const same = existing !== null && JSON.stringify(existing) === JSON.stringify(payload)
    if (!same) {
      drift += 1
      info(`drift: contracts/fixtures/${fileName}`)
    }
    continue
  }
  await writeContractJson(target, payload)
  ok(`contracts/fixtures/${fileName}`)
}

if (CHECK_ONLY) {
  if (drift > 0) die(`fixtures: ${drift} fixture(s) differ from the committed contracts`)
  ok('contracts/fixtures is up to date')
} else {
  info(`${Object.keys(fixtures).length} fixtures ported from tests/e2e/support`)
  ok('fixture port complete')
}
