import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type Route, test as base } from '@playwright/test'
import {
  adminSession,
  adminUser,
  adminGuestbookMessages,
  auditLogEntries,
  dashboardMessagesCount,
  dashboardPhotosCount,
  featuredSlots,
  pendingUploads,
  mockPendingClaims,
  mockApprovedClaims,
  mockRejectedClaims,
} from './adminMockData'
import { galleryPhotos } from './mockData'

// ─── Types ────────────────────────────────────────────────────────────────────

type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { [key: string]: JsonValue }

// ─── Constants ────────────────────────────────────────────────────────────────

const JSON_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json',
}

// The Supabase project ref is derived from the env var.
// Key format: sb-{projectRef}-auth-token
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://rxzbbtghnrvzubqrbhhx.supabase.co'
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
export const SUPABASE_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

export const viewports = {
  desktop: { width: 1440, height: 1200 },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fulfillJson(route: Route, body: JsonValue, status = 200) {
  await route.fulfill({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

/**
 * Inject a mock admin session into localStorage *before* any scripts run.
 * This ensures AuthProvider reads an authenticated session on first mount.
 */
export async function injectAdminSession(page: Page) {
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session))
    },
    { key: SUPABASE_STORAGE_KEY, session: adminSession }
  )
}

/**
 * Install Supabase route mocks for all admin page data requirements.
 */
export async function installAdminMocks(page: Page) {
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())

    if (!url.hostname.includes('supabase')) {
      await route.continue()
      return
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: JSON_HEADERS })
      return
    }

    const path = url.pathname

    // ── Auth endpoints ──────────────────────────────────────────────────────
    if (path.includes('/auth/v1/user')) {
      await fulfillJson(route, adminUser)
      return
    }
    if (path.includes('/auth/v1/token')) {
      await fulfillJson(route, adminSession)
      return
    }
    if (path.includes('/auth/v1/logout')) {
      await fulfillJson(route, {})
      return
    }

    // ── guest_uploads ───────────────────────────────────────────────────────
    if (path.includes('/rest/v1/guest_uploads')) {
      if (request.method() === 'GET') {
        await fulfillJson(route, pendingUploads)
        return
      }
      // PATCH/DELETE — approve, reject, move-to-pending
      await fulfillJson(route, [])
      return
    }

    // ── guestbook_messages ──────────────────────────────────────────────────
    if (path.includes('/rest/v1/guestbook_messages')) {
      if (request.method() === 'GET') {
        await fulfillJson(route, adminGuestbookMessages as unknown as JsonValue)
        return
      }
      await fulfillJson(route, [])
      return
    }

    // ── photos ──────────────────────────────────────────────────────────────
    if (path.includes('/rest/v1/photos')) {
      if (request.method() === 'GET') {
        // Dashboard count queries use ?select=count
        if (url.search.includes('count')) {
          await fulfillJson(route, dashboardPhotosCount)
          return
        }
        await fulfillJson(route, galleryPhotos)
        return
      }
      await fulfillJson(route, [])
      return
    }

    // ── photo_claims ────────────────────────────────────────────────────────
    if (path.includes('/rest/v1/photo_claims')) {
      if (request.method() === 'GET') {
        const idParam = url.searchParams.get('id')
        if (idParam === 'eq.claim-pending-1') {
          await fulfillJson(route, mockPendingClaims[0])
          return
        }
        const statusParam = url.searchParams.get('status')
        if (statusParam === 'eq.approved') {
          await fulfillJson(route, mockApprovedClaims)
        } else if (statusParam === 'eq.rejected') {
          await fulfillJson(route, mockRejectedClaims)
        } else {
          await fulfillJson(route, mockPendingClaims)
        }
        return
      }
      // PATCH/POST/DELETE — approve, reject, log audit
      await fulfillJson(route, [])
      return
    }

    // ── site_editorial_features ─────────────────────────────────────────────
    if (path.includes('/rest/v1/site_editorial_features')) {
      if (request.method() === 'GET') {
        await fulfillJson(route, featuredSlots.slice(0, 1))
        return
      }
      await fulfillJson(route, featuredSlots[0])
      return
    }

    // ── site_editorial_feature_history ──────────────────────────────────────
    if (path.includes('/rest/v1/site_editorial_feature_history')) {
      await fulfillJson(route, [])
      return
    }

    // ── moderation_audit_log ────────────────────────────────────────────────
    if (
      path.includes('/rest/v1/moderation_audit_log') ||
      path.includes('/rpc/fetch_moderation_audit')
    ) {
      await fulfillJson(route, auditLogEntries as unknown as JsonValue)
      return
    }

    // ── Dashboard count queries (guest_uploads with count) ──────────────────
    if (path.includes('/rest/v1/guestbook_messages') && url.search.includes('count')) {
      await fulfillJson(route, dashboardMessagesCount)
      return
    }

    // ── RPC calls ───────────────────────────────────────────────────────────
    if (path.includes('/rpc/')) {
      // Media review batches, face tagging batches, audit RPCs
      await fulfillJson(route, [])
      return
    }

    // ── Storage ─────────────────────────────────────────────────────────────
    if (path.includes('/storage/v1/')) {
      await fulfillJson(route, { Key: 'mock-key' })
      return
    }

    // Default fallback
    await fulfillJson(route, [], 200)
  })
}

/**
 * Navigate to an admin page as an authenticated admin.
 * Injects session + installs mocks before navigating.
 */
export async function gotoAdminPage(page: Page, route: string) {
  await page.setViewportSize(viewports.desktop)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await injectAdminSession(page)
  await installAdminMocks(page)
  await page.goto(route)
  await waitForPageReady(page)
}

export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page
    .evaluate(async () => {
      if ('fonts' in document) await document.fonts.ready
    })
    .catch(() => {}) // page may navigate (auth redirect) — swallow context-destroyed errors
  await page.waitForTimeout(200)
}

// ─── Accessibility helper ─────────────────────────────────────────────────────

export async function expectNoCriticalViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const critical = results.violations.filter(v => v.impact === 'critical')
  expect(critical, `Critical a11y violations: ${critical.map(v => v.id).join(', ')}`).toHaveLength(
    0
  )
}

// ─── Screenshot helper ────────────────────────────────────────────────────────

export async function expectAdminScreenshot(page: Page, snapshotName: string) {
  // Stabilise layout before screenshot
  await page.evaluate(() => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.scrollbarGutter = 'stable'
  })
  await page.waitForTimeout(100)

  await expect(page.getByTestId('admin-content')).toHaveScreenshot(snapshotName, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.015,
    scale: 'css',
  })

  await page.evaluate(() => {
    document.documentElement.style.scrollbarGutter = ''
    document.documentElement.style.overflow = ''
  })
}

// ─── Test fixture ─────────────────────────────────────────────────────────────

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await page.addInitScript(() => {
      ;(window as any).__E2E__ = true
    })
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
    await runPage(page)
  },
})

export { expect }
