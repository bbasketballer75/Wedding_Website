/**
 * Deterministic fixture loader for the parity harness.
 *
 * Source of truth is `contracts/fixtures/*.json` (stack-neutral JSON, owned by
 * contracts-eng). Until a given fixture lands, the loader falls back to the
 * legacy e2e mock modules under `tests/e2e/support/` (read-only) so the
 * harness can still render real content, and finally to small built-in
 * defaults. Every fallback is recorded in `sources`/`warnings` and surfaces in
 * summary.json — evidence runs should say `contracts/fixtures`.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { HarnessError, ROOT, pathExists, readJsonFile } from '../util.mjs'

export const FIXTURE_FILES = [
  'photos.json',
  'guestbook.json',
  'guestUploads.json',
  'activity.json',
  'editorial.json',
  'claims.json',
  'guestTokens.json',
  'adminSession.json',
]

export const DEFAULT_SUPABASE_PROJECT_REF = 'zaczcyzvavetgfuucljf'

const BUILTIN_GUEST_TOKENS = {
  valid: { guest_email: 'jane@example.com', token: 'valid-showcase-token' },
  invalidToken: 'invalid-token',
  invalidResponse: null,
  identity: { display_name: 'Jane Miller' },
  identityWithClaims: { id: 'identity-jane', photo_claims: [] },
}

const BUILTIN_ADMIN = {
  storageKey: `sb-${DEFAULT_SUPABASE_PROJECT_REF}-auth-token`,
  session: null,
  user: null,
  dashboardCounts: { photos: [], pendingUploads: [], guestbookMessages: [], approvedUploads: [] },
  auditLog: [],
}

export function emptyFixtureSet() {
  return {
    photos: [],
    guestbook: {
      messages: [],
      submitResponse: { success: true, message_id: 'message-new', error_message: '' },
    },
    guestUploads: {
      approved: [],
      pending: [],
      insertResponse: [{ id: 'upload-1', status: 'pending', photo_urls: [], video_urls: [] }],
    },
    activity: [],
    editorial: [],
    claims: { pending: [], approved: [], rejected: [] },
    guestTokens: { ...BUILTIN_GUEST_TOKENS },
    admin: { ...BUILTIN_ADMIN },
  }
}

const asArray = value => (Array.isArray(value) ? value : [])
const asObject = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

/** Normalise any fixture source into the one shape the mocks consume. */
function normalizeFixtureSet({ contracts, e2e }) {
  const data = emptyFixtureSet()
  const fromContracts = contracts ?? {}
  const fromE2e = e2e ?? {}

  data.photos = asArray(fromContracts.photos ?? fromE2e.galleryPhotos)

  const contractGuestbook = asObject(fromContracts.guestbook)
  data.guestbook = {
    messages: asArray(contractGuestbook.messages ?? fromE2e.guestbookMessagesWithComments),
    adminMessages: asArray(
      contractGuestbook.adminMessages ??
        fromE2e.adminGuestbookMessages ??
        contractGuestbook.messages
    ),
    submitResponse: contractGuestbook.submitResponse ??
      fromE2e.guestbookSubmitResponse ?? {
        success: true,
        message_id: 'message-new',
        error_message: '',
      },
  }

  const contractUploads = asObject(fromContracts.guestUploads)
  data.guestUploads = {
    approved: asArray(contractUploads.approved ?? fromE2e.approvedGuestUploads),
    pending: asArray(contractUploads.pending ?? fromE2e.pendingUploads),
    insertResponse: asArray(contractUploads.insertResponse ?? fromE2e.guestUploadInsertResponse),
  }

  data.activity = asArray(fromContracts.activity ?? fromE2e.mockActivityLog)
  data.editorial = asArray(fromContracts.editorial ?? fromE2e.featuredSlots)

  const contractClaims = asObject(fromContracts.claims)
  data.claims = {
    pending: asArray(contractClaims.pending ?? fromE2e.mockPendingClaims),
    approved: asArray(contractClaims.approved ?? fromE2e.mockApprovedClaims),
    rejected: asArray(contractClaims.rejected ?? fromE2e.mockRejectedClaims),
  }

  const contractTokens = asObject(fromContracts.guestTokens)
  data.guestTokens = {
    valid:
      asObject(contractTokens.valid ?? fromE2e.guestTokens?.valid) || BUILTIN_GUEST_TOKENS.valid,
    invalidToken:
      contractTokens.invalidToken ??
      fromE2e.guestTokens?.invalidToken ??
      BUILTIN_GUEST_TOKENS.invalidToken,
    invalidResponse:
      contractTokens.invalidResponse ??
      fromE2e.guestTokens?.invalidResponse ??
      BUILTIN_GUEST_TOKENS.invalidResponse,
    identity: asObject(contractTokens.identity ?? fromE2e.guestTokens?.identity) || {},
    identityWithClaims:
      asObject(contractTokens.identityWithClaims ?? fromE2e.guestTokens?.identityWithClaims) || {},
  }

  const contractAdmin = asObject(fromContracts.adminSession)
  data.admin = {
    storageKey: contractAdmin.storageKey ?? BUILTIN_ADMIN.storageKey,
    session: contractAdmin.session ?? fromE2e.adminSession ?? null,
    user: contractAdmin.user ?? fromE2e.adminUser ?? null,
    dashboardCounts: {
      ...BUILTIN_ADMIN.dashboardCounts,
      ...asObject(contractAdmin.dashboardCounts),
      ...(fromE2e.dashboardCounts ?? {}),
    },
    auditLog: asArray(contractAdmin.auditLog ?? fromE2e.auditLogEntries),
  }
  if (!data.admin.user && data.admin.session?.user) data.admin.user = data.admin.session.user
  return data
}

async function importE2eSupport(root) {
  const sources = {}
  try {
    const mockData = await import(
      pathToFileURL(path.join(root, 'tests/e2e/support/mockData.ts')).href
    )
    sources.mockData = mockData
  } catch (error) {
    sources.mockDataError = error.message
  }
  try {
    const adminMockData = await import(
      pathToFileURL(path.join(root, 'tests/e2e/support/adminMockData.ts')).href
    )
    sources.adminMockData = adminMockData
  } catch (error) {
    sources.adminMockDataError = error.message
  }
  return sources
}

function e2eFixtureMap(support) {
  const mockData = support.mockData ?? {}
  const admin = support.adminMockData ?? {}
  return {
    galleryPhotos: mockData.galleryPhotos,
    guestbookMessagesWithComments: mockData.guestbookMessagesWithComments,
    guestbookSubmitResponse: mockData.guestbookSubmitResponse,
    approvedGuestUploads: mockData.approvedGuestUploads,
    pendingUploads: admin.pendingUploads,
    guestUploadInsertResponse: mockData.guestUploadInsertResponse,
    mockActivityLog: mockData.mockActivityLog,
    featuredSlots: admin.featuredSlots,
    mockPendingClaims: admin.mockPendingClaims,
    mockApprovedClaims: admin.mockApprovedClaims,
    mockRejectedClaims: admin.mockRejectedClaims,
    adminSession: admin.adminSession,
    adminUser: admin.adminUser,
    auditLogEntries: admin.auditLogEntries,
    dashboardCounts: {
      photos: admin.dashboardPhotosCount,
      pendingUploads: admin.dashboardPendingCount,
      guestbookMessages: admin.dashboardMessagesCount,
      approvedUploads: admin.dashboardApprovedUploadsCount,
    },
    guestTokens: {
      valid: { guest_email: 'jane@example.com', token: 'valid-showcase-token' },
      invalidToken: 'invalid-token',
      invalidResponse: null,
      identity: { display_name: 'Jane Miller' },
      identityWithClaims: {
        id: 'identity-jane',
        photo_claims: [
          {
            id: 'claim-1',
            status: 'approved',
            photos: mockData.galleryPhotos?.[0] ?? null,
          },
        ],
      },
    },
  }
}

/**
 * Load the fixture set. Returns { data, sources, warnings, source }.
 * `source` is 'contracts/fixtures' when every required file loaded from JSON.
 */
export async function loadFixtures({ root = ROOT, warn = () => {} } = {}) {
  const fixturesDir = path.join(root, 'contracts', 'fixtures')
  const contracts = {}
  const sources = {}
  const warnings = []

  if (await pathExists(fixturesDir)) {
    for (const name of FIXTURE_FILES) {
      const file = path.join(fixturesDir, name)
      if (!(await pathExists(file))) continue
      const key = name.replace(/\.json$/, '')
      try {
        contracts[key] = await readJsonFile(file)
        sources[key] = `contracts/fixtures/${name}`
      } catch (error) {
        warnings.push(`contracts/fixtures/${name} could not be loaded: ${error.message}`)
      }
    }
  } else {
    warnings.push('contracts/fixtures/ is missing — falling back to tests/e2e/support fixtures.')
  }

  const missing = FIXTURE_FILES.filter(name => !sources[name.replace(/\.json$/, '')])
  let support = {}
  if (missing.length > 0) {
    support = await importE2eSupport(root)
    if (support.mockDataError && support.adminMockDataError) {
      warnings.push(
        `Legacy e2e fixtures unavailable (${support.mockDataError}); using built-in defaults for: ${missing.join(', ')}`
      )
    } else {
      for (const name of missing) {
        sources[name.replace(/\.json$/, '')] =
          `tests/e2e/support (${support.mockDataError ? 'adminMockData.ts' : 'mockData.ts'})`
      }
    }
  }

  const data = normalizeFixtureSet({
    contracts,
    e2e: missing.length > 0 ? e2eFixtureMap(support) : {},
  })

  const allFromContracts = FIXTURE_FILES.every(name =>
    sources[name.replace(/\.json$/, '')]?.startsWith('contracts/fixtures/')
  )
  for (const warning of warnings) warn(warning)
  return {
    data,
    sources,
    warnings,
    source: allFromContracts ? 'contracts/fixtures' : 'mixed',
  }
}

/** Derive the Supabase project ref from the admin session storage key. */
export function supabaseProjectRef({ root = ROOT } = {}) {
  const fromEnv = process.env.PARITY_SUPABASE_PROJECT_REF
  if (fromEnv) return fromEnv
  try {
    const file = path.join(root, 'contracts', 'fixtures', 'adminSession.json')
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const match = /^sb-(.+)-auth-token$/.exec(raw?.storageKey ?? '')
    if (match) return match[1]
  } catch {
    // No contract fixture yet — fall through to the public default.
  }
  return DEFAULT_SUPABASE_PROJECT_REF
}

/** Guest share token used for dynamic routes such as /guest/:token. */
export function guestShareToken(fixtureSet) {
  const token = fixtureSet?.guestTokens?.valid?.token
  if (!token) throw new HarnessError('contracts/fixtures/guestTokens.json has no valid token')
  return token
}
