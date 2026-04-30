---
phase: 19
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - src/lib/shareUtils.test.ts
  - tests/guestShared.test.ts
autonomous: true
requirements:
  - SC-03
  - PR-01
user_setup: []

must_haves:
  truths:
    - "Share button generates unique link per guest"
    - "/guest/:token route renders public view of guest's uploads and guestbook entries"
    - "Invalid or expired token shows friendly error message"
    - "Order Prints button visible in lightbox"
    - "Clicking Order Prints opens external print provider in new tab"
  artifacts:
    - path: "src/lib/shareUtils.test.ts"
      provides: "Unit tests for token generation, print URL construction"
      contains: "describe.*shareUtils"
    - path: "tests/guestShared.test.ts"
      provides: "Unit tests for GuestShared page data fetching"
      contains: "describe.*GuestShared"
---

<objective>
Wave 0: Create test infrastructure before main implementation. These tests define the expected behavior for share token generation, print URL construction, and GuestShared page data fetching.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<tasks>

<task type="auto">
  <name>Task 0: Create test files for shareUtils and GuestShared</name>
  <files>src/lib/shareUtils.test.ts, tests/guestShared.test.ts</files>
  <action>
Create `src/lib/shareUtils.test.ts` with unit tests for:

1. Token generation utilities (getShareToken, ensureGuestShareToken)
2. Print URL construction (buildPrintUrl with both providers)
3. Default provider fallback behavior

Example structure:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildPrintUrl, getShareToken, ensureGuestShareToken } from '@/lib/shareUtils'

// Mock import.meta.env
vi.stubEnv('VITE_PRINT_PROVIDER', 'shutterfly')

describe('shareUtils', () => {
  describe('buildPrintUrl', () => {
    it('builds Shutterfly URL with photo param', () => {
      const url = buildPrintUrl('https://example.com/photo.jpg')
      expect(url).toContain('shutterfly.com')
      expect(url).toContain('photo=')
    })

    it('builds Artifact Uprising URL when env is artifact_uprising', () => {
      vi.stubEnv('VITE_PRINT_PROVIDER', 'artifact_uprising')
      const url = buildPrintUrl('https://example.com/photo.jpg')
      expect(url).toContain('artifactuprising.com')
    })

    it('defaults to Shutterfly for unknown provider', () => {
      vi.stubEnv('VITE_PRINT_PROVIDER', 'unknown_provider')
      const url = buildPrintUrl('https://example.com/photo.jpg')
      expect(url).toContain('shutterfly.com')
    })
  })

  describe('ensureGuestShareToken', () => {
    it('returns existing token if email already has one', async () => {
      // Mock supabase to return existing token
      // Test that it doesn't create duplicate
    })

    it('creates new token if none exists', async () => {
      // Mock supabase insert
      // Verify token is generated via crypto.randomUUID
    })
  })
})
```

Create `tests/guestShared.test.ts` with unit tests for:

1. Token lookup returns email when token valid
2. Token lookup returns null when token not found
3. GuestShared data fetching composes uploads and guestbook by email
4. Invalid token shows appropriate error

Example structure:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { fetchGuestShareToken } from '@/lib/supabase'

describe('GuestShared data fetching', () => {
  it('returns email when token exists', async () => {
    // Mock supabase to return token data
  })

  it('returns null when token not found', async () => {
    // Mock supabase to return null
  })
})
```

Note: These are test scaffolds that will fail until the actual implementations (shareUtils.ts, GuestShared.tsx) are built in Wave 1. This follows TDD principles.
  </action>
  <verify>
    <automated>test -f src/lib/shareUtils.test.ts && test -f tests/guestShared.test.ts && npm run test -- src/lib/shareUtils.test.ts tests/guestShared.test.ts 2>&1 | head -20</automated>
  </verify>
  <done>
    Test files exist with describe blocks for shareUtils and GuestShared. Tests fail as expected until implementations are added in Wave 1.
  </done>
</task>

</tasks>

<success_criteria>
Wave 0 test scaffold files exist and can be run with `npm run test`.
</success_criteria>

<output>
After Wave 0 completion, execution continues with Wave 1 tasks in this plan.
</output>
