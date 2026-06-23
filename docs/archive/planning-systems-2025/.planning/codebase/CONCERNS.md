# Codebase Concerns

**Analysis Date:** 2026-04-23

## Tech Debt

### Duplicate Supabase Client Initialization

**Issue:** Two separate Supabase client instances are created with different configurations.

**Files:**
- `src/lib/supabase.ts` (main client with auth, realtime, custom headers)
- `src/lib/supabase.ts` (duplicate createClient call at line 23 with different config)

**Impact:** Session/auth state may be inconsistent between modules using different imports. The second client lacks realtime configuration and global headers that the first has.

**Fix approach:** Consolidate to a single client instance. Ensure `src/pages/admin/utils.ts` and other admin modules use the same exported client.

---

### In-Memory Rate Limiting Does Not Persist

**Issue:** `src/lib/supabase.ts` uses an in-memory `Map` for rate limiting. This resets on page reload and does not work across multiple tabs/workers.

**Files:**
- `src/lib/supabase.ts` (rate limiting via in-memory Map)

**Impact:** Rate limiting can be bypassed by opening multiple tabs or refreshing the page.

**Fix approach:** Move rate limiting to Supabase Edge Functions or use a persistent session-based approach.

---

### Console Logging in Production Code

**Issue:** Multiple files use `console.log`, `console.warn`, and `console.error` directly instead of a structured logging service.

**Files:**
- `src/stores/authStore.ts` (lines 58, 82, 106, 126, 156)
- `src/utils/logger.ts` (uses console methods internally)
- `src/hooks/useLocalStorage.ts` (lines 12, 23)
- `src/hooks/useInfiniteScroll.ts` (line 103)
- `src/components/error/ErrorBoundary.tsx` (line 108)
- Multiple other files across `src/`

**Impact:** Production builds may expose sensitive data in browser console. Harder to monitor in production environments.

**Fix approach:** Replace direct console calls with the `logger` utility. Ensure ErrorLoggingService is used consistently. Consider disabling console output in production builds via build config.

---

### Large Admin Components

**Issue:** `src/components/admin/MediaReviewPanel.tsx` is 900+ lines and `src/pages/admin/PhotoModeration.tsx` is similarly large. Both violate single-responsibility principle.

**Files:**
- `src/components/admin/MediaReviewPanel.tsx`
- `src/pages/admin/PhotoModeration.tsx`
- `src/pages/admin/FeaturedContentManager.tsx`

**Impact:** Hard to test, reason about, and modify safely. Changes in one area risk breaking unrelated functionality.

**Fix approach:** Extract logical sub-components: batch list management, face tagging panel, moderation actions, and photo promotion form into separate modules.

---

### authStore Admin Check Relies on Frontend Metadata Only

**Issue:** Admin status is determined solely by checking `user.user_metadata?.role === 'admin'` in the frontend store.

**Files:**
- `src/stores/authStore.ts` (lines 144-158, checkAdminStatus function)

**Impact:** A user could modify their session JWT claims to escalate privileges. Backend rules should enforce admin access.

**Fix approach:** Add server-side RLS policies on Supabase tables that verify admin role. The frontend check should only be for UI state (showing/hiding admin features), not access control.

---

### Error Handling in Worker Pool

**Issue:** Worker errors are logged and workers are restarted, but failed tasks are rejected without retry logic. No exponential backoff or dead letter queue.

**Files:**
- `src/utils/workerPool.ts` (lines 122-135, handleWorkerError)

**Impact:** Transient failures cause task failures that may leave the application in an inconsistent state.

**Fix approach:** Add retry logic with exponential backoff. Consider adding a dead letter queue for tasks that fail after max retries.

---

### Missing Error Boundaries on Admin Pages

**Issue:** Admin pages do not appear to wrap their content in `ComponentErrorBoundary`. If a component fails to load data, the entire admin page may crash without recovery.

**Files:**
- `src/pages/admin/PhotoModeration.tsx`
- `src/pages/admin/GuestbookModeration.tsx`
- `src/pages/admin/FeaturedContentManager.tsx`

**Impact:** Errors in data fetching or component rendering crash the entire page without graceful degradation.

**Fix approach:** Wrap main content areas with `ComponentErrorBoundary` and provide fallback UIs for error states.

---

## Known Bugs

### Session Manager Detects Auth in URL But May Not Handle All Cases

**Issue:** `src/lib/supabase.ts` has `detectSessionInUrl: true` but custom `sessionManager.extendSession()` does not handle token refresh failures gracefully.

**Files:**
- `src/lib/supabase.ts` (lines 116-127)

**Impact:** If token refresh fails, the session may be in a broken state without clear recovery path for the user.

**Workaround:** Sign out and sign back in.

---

### Face Name Aliases Not Used in PhotoModeration

**Issue:** `src/pages/Gallery.tsx` defines `FACE_NAME_ALIASES` to map first names to full names, but this mapping is not applied in `PhotoModeration` or face tagging admin pages.

**Files:**
- `src/pages/Gallery.tsx` (lines 29-41)
- `src/pages/admin/utils.ts`
- `src/components/admin/MediaReviewPanel.tsx`

**Impact:** Admin may see inconsistent face names between the public gallery and admin moderation UI.

---

## Security Considerations

### Admin UI Accessibility Without Backend Enforcement

**Issue:** Admin routes check `isAdmin` from frontend store. Without server-side enforcement, a determined user could access some admin features if they manipulate local state.

**Files:**
- `src/stores/authStore.ts`
- `src/App.tsx` (admin route protection)

**Current mitigation:** Supabase RLS policies should enforce access control at the database level.

**Recommendations:** Audit all Supabase RLS policies to ensure admin-only tables reject non-admin users. Add server-side admin verification for sensitive RPC calls.

---

### Audit Logging Failure is Silent

**Issue:** `auditLog` in `src/lib/supabase.ts` catches errors and logs to console, but does not notify users or retry.

**Files:**
- `src/lib/supabase.ts` (lines 96-113)

**Impact:** Security-relevant events may not be logged if the Supabase insert fails.

---

### Content Security Policy Allows unsafe-inline

**Issue:** `src/lib/supabase.ts` line 92 has `script-src 'self' 'unsafe-inline' 'unsafe-eval'` which weakens XSS protection.

**Impact:** Inline scripts can be executed if an attacker injects content into the page.

**Recommendations:** Remove `'unsafe-inline'` and `'unsafe-eval'` if possible. If required for styling, use nonce-based approach.

---

## Performance Bottlenecks

### MediaReviewPanel Fetches All Batches On Load

**Issue:** `MediaReviewPanel` calls `fetchMediaReviewBatches()` and `fetchGuestFaceTaggingBatches()` on mount with no pagination or filtering.

**Files:**
- `src/components/admin/MediaReviewPanel.tsx`

**Cause:** Full dataset fetched on every page load.

**Improvement path:** Add pagination, limit, or filters to batch queries.

---

### Gallery Page Makes Multiple Parallel Supabase Calls

**Issue:** `Gallery.tsx` makes parallel calls for photos, comments, likes, and faces without caching. Scrolling through many photos triggers additional requests.

**Files:**
- `src/pages/Gallery.tsx`
- `src/components/gallery/PhotoGrid.tsx`
- `src/hooks/useInfiniteScroll.ts`

**Cause:** No client-side caching layer. Each lightbox open triggers `fetchPhotoComments`.

**Improvement path:** Add React Query or Zustand persistence layer with TTL-based caching.

---

### fetchKnownPeopleNames Does Full Table Scan

**Issue:** `fetchKnownPeopleNames()` in `src/lib/supabase.ts` iterates through all photos in batches of 500 with no index optimization.

**Files:**
- `src/lib/supabase.ts` (lines 460-511)

**Cause:** Sequential range queries on photos table. No covering index on faces column.

**Improvement path:** Add a separate indexed table for known person names, or create a Postgres function that efficiently extracts distinct names.

---

## Fragile Areas

### Admin Authentication Flow Has Race Conditions

**Issue:** `initializeAuth()` and `refreshSession()` in `authStore.ts` may conflict. If `refreshSession()` is called while `initializeAuth()` is still pending, state may become inconsistent.

**Files:**
- `src/stores/authStore.ts` (lines 93-129)

**Why fragile:** Multiple async operations on auth state without mutex or queue.

**Safe modification:** Use a state machine or queue auth operations to prevent race conditions.

---

### useEffect Dependencies Missing in Gallery

**Issue:** `Gallery.tsx` has several useEffect hooks that may have incomplete dependency arrays based on the code structure visible.

**Files:**
- `src/pages/Gallery.tsx`

**Safe modification:** Audit all useEffect hooks for correct dependencies before making any changes to this file.

---

### Photo Type Duplication

**Issue:** `Gallery.tsx` defines its own `Photo` interface (lines 44-79) while `src/lib/supabase.ts` exports a different `Photo` interface. The gallery page uses local types instead of imported Supabase types.

**Files:**
- `src/pages/Gallery.tsx` (lines 44-79, local Photo interface)
- `src/lib/supabase.ts` (lines 50-67, exported Photo interface)

**Why fragile:** Type drift between public gallery and admin interfaces. Changes to one may not reflect in the other.

**Safe modification:** Import and extend the Supabase Photo type rather than duplicating it.

---

### HalloweenContext and Seasonal Components

**Issue:** `HalloweenContext` adds conditional rendering and state for seasonal features. If these components fail, error boundary may not catch them properly since they render early in the tree.

**Files:**
- `src/context/HalloweenContext.tsx`
- `src/components/sections/engagement/HalloweenAudio.tsx`
- `src/components/sections/engagement/LightningEffect.tsx`
- `src/components/timeline/HalloweenEngagement.tsx`

**Why fragile:** Seasonal code paths rarely tested until the season arrives.

**Safe modification:** Ensure all seasonal components are wrapped in error boundaries and have explicit feature flag fallbacks.

---

## Scaling Limits

### Gallery State Held in Component State

**Issue:** Photo gallery state (filters, selected photos, lightbox state) is held in component-level useState in `Gallery.tsx`. No persistence or sharing between routes.

**Files:**
- `src/pages/Gallery.tsx`

**Current capacity:** Works for hundreds of photos but may degrade with thousands.

**Scaling path:** Move gallery state to Zustand store with pagination info cached. Implement virtual scrolling properly for large albums.

---

### IndexedDB Storage for Guest Tagging

**Issue:** Guest tagging uses IndexedDB via `sync.worker.ts` but there is no cleanup strategy for old sync records.

**Files:**
- `src/workers/sync.worker.ts`

**Current capacity:** Local storage grows unbounded.

**Scaling path:** Add TTL-based cleanup of sync records older than 30 days.

---

## Dependencies at Risk

### Sentry SDK Version 10.42.0

**Risk:** Older Sentry major version. Version 11+ may have breaking changes in error handling APIs and transport.

**Impact:** Migration will require updating error boundary code and possibly adjusting event schemas.

**Migration plan:** Plan migration to @sentry/react v11 or later. Test error capture and source maps in staging.

---

### TensorFlow.js for Face Recognition

**Risk:** `@tensorflow/tfjs` and `@tensorflow/tfjs-backend-wasm` are heavy dependencies (~30MB bundled). Face recognition is not currently used in the public site, only in admin review panel.

**Impact:** Bundle size and initial load time affected. If face recognition is not a priority, these could be lazy-loaded or removed.

**Migration plan:** Evaluate if TensorFlow.js is actually used. If only for admin face tagging, lazy-load the models only when admin reviews are accessed.

---

### Zod Version 4.3.6 (Pre-1.0)

**Risk:** Zod 4.x is still pre-1.0. API may change in minor versions.

**Impact:** Validator schemas in `src/validators/` may need updates when upgrading.

**Migration plan:** Pin to minor version. Test validators when upgrading.

---

## Missing Critical Features

### No Upload Progress Persistence

**Issue:** If user loses connection during upload, the upload progress is lost with no resume capability.

**Files:**
- `src/pages/Upload.tsx`

**Blocks:** Users on unstable connections cannot upload large media files reliably.

---

### No Offline Support for Admin Moderation

**Issue:** Admin moderation features require network connectivity. Moderators cannot work offline to review previously loaded batches.

**Files:**
- `src/pages/admin/PhotoModeration.tsx`
- `src/components/admin/MediaReviewPanel.tsx`

**Blocks:** Moderators with limited connectivity cannot be productive.

---

## Test Coverage Gaps

### No Unit Tests for AuthStore

**What's not tested:** `signIn`, `signUp`, `signOut`, `checkAdminStatus` functions are not covered by unit tests.

**Files:**
- `src/stores/authStore.ts`

**Risk:** Auth edge cases (network failures, token expiration) may fail silently in production.

**Priority:** High

---

### No Integration Tests for Supabase RPC Functions

**What's not tested:** `togglePhotoLike`, `addPhotoComment`, `saveAlbumOrganization` RPC calls have no integration tests.

**Files:**
- `src/lib/supabase.ts` (RPC wrapper functions)

**Risk:** Backend changes can break frontend without early detection.

**Priority:** Medium

---

### Worker Pool Has Minimal Tests

**What's not tested:** Worker message handling, error recovery, and pool resize scenarios are not tested.

**Files:**
- `src/utils/workerPool.ts`

**Risk:** Worker failures in production may not be handled gracefully.

**Priority:** Medium

---

### PhotoModeration Has No Tests

**What's not tested:** The main admin photo moderation page has no unit or integration tests.

**Files:**
- `src/pages/admin/PhotoModeration.tsx`

**Risk:** Moderation workflow regressions may not be caught.

**Priority:** High (admin workflow is critical)

---

*Concerns audit: 2026-04-23*