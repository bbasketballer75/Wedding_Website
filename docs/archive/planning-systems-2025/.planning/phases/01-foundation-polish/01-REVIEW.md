# Phase 01: Code Review Report

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed 12 source files related to admin functionality, media review, authentication, and security utilities. Found 2 critical security issues, 4 warnings, and 3 info-level findings. The most serious issue is client-side admin role checking in the auth store, which could allow privilege escalation. Several state management patterns in the media review components risk stale closures and inconsistent UI state.

## Critical Issues

### CR-01: Client-Side Admin Authorization Bypass

**File:** `src/stores/authStore.ts:168`
**Issue:** The admin status check relies entirely on client-side user metadata that users can modify:

```typescript
const isAdmin = user.user_metadata?.role === 'admin'
```

This is a security vulnerability. An attacker can modify their user metadata (via browser DevTools or direct API calls if they know the format) to set `role: 'admin'` and gain admin access. The actual authorization must be enforced server-side via Supabase RLS policies on tables and Edge Functions.

**Fix:** Remove client-side admin checks entirely. Admin authorization should be enforced by:
1. Supabase RLS policies that only allow admin users to access certain tables/rows
2. Server-side Edge Function authorization that validates admin status before performing privileged operations
3. The client-side `isAdmin` state should only be used for UI purposes (showing/hiding admin menu items), never for security decisions

### CR-02: Weak XSS Prevention

**File:** `src/utils/security.ts:62-64`
**Issue:** The XSS prevention regex is easily bypassed:

```typescript
if (/<script|javascript:|on\w+=/i.test(message)) {
  throw new Error('Message contains invalid content')
}
```

This can be bypassed via:
- Mutation XSS (mXSS) using namespaces like `<svg><script>`
- Encoded characters: `&#x3C;script>` or `<script>`
- Data URLs: `javascript:` in data attributes
- Parser differential attacks

**Fix:** Use a well-tested sanitization library like DOMPurify instead of a custom regex:

```typescript
import DOMPurify from 'dompurify'

const message = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
```

## Warnings

### WR-01: Inconsistent Error Handling Leaves Orphaned Data

**File:** `src/pages/admin/PhotoModeration.tsx:219-249`
**Issue:** The `handleApprove` function performs multiple sequential database operations. If an error occurs after photos are inserted but before the guest_uploads status is updated, orphaned photo rows are left in the database:

```typescript
// Photos inserted successfully
const { error: insertError } = await supabase.from('photos').insert(rowsToInsert)

// But if this fails, photos remain in gallery without corresponding upload record
const { error: updateError } = await supabase
  .from('guest_uploads')
  .update({ status: 'approved', ... })
```

The error recovery at lines 240-245 attempts to delete the inserted photos, but if that delete also fails, orphaned data remains.

**Fix:** Use a database transaction or implement proper rollback logic that handles all failure cases:

```typescript
// Use a Supabase RPC function that performs both operations atomically
// Or implement a saga pattern with explicit compensation actions
```

### WR-02: Memory Leak in Rate Limiter

**File:** `src/utils/security.ts:4-23`
**Issue:** The `rateLimitMap` is an in-memory Map that is never cleared:

```typescript
const rateLimitMap = new Map()

export const rateLimit = async (key: string, limit: number, windowMs: number) => {
  // ...
  validRequests.push(now)
  rateLimitMap.set(key, validRequests)
  // Never removes old entries - memory grows indefinitely
}
```

In a serverless environment (Netlify), multiple instances run concurrently, each with their own map, making the rate limiting ineffective. Additionally, the map will grow indefinitely within each instance.

**Fix:** Use Redis or another external rate limiting service. For client-side rate limiting, add periodic cleanup:

```typescript
const cleanupInterval = setInterval(() => {
  const windowStart = Date.now() - windowMs
  for (const [key, times] of rateLimitMap.entries()) {
    const valid = times.filter(t => t > windowStart)
    if (valid.length === 0) rateLimitMap.delete(key)
    else rateLimitMap.set(key, valid)
  }
}, windowMs)
```

### WR-03: Stale Closure in useEffect Hooks

**File:** `src/components/admin/MediaReviewPanel.tsx:161-167`
**Issue:** Empty dependency array but direct store access:

```typescript
useEffect(() => {
  const filteredGroups = useMediaReviewStore.getState().getFilteredGroups(...)
  const selectedGroup = useMediaReviewStore.getState().getSelectedGroup()
  if (!selectedGroup && filteredGroups[0]) {
    useMediaReviewStore.getState().setSelectedGroupKey(filteredGroups[0].key)
  }
}, []) // Empty deps - runs once, but accesses current store state
```

This runs once on mount with stale closures. If store state changes before the effect runs, it operates on outdated values.

**Fix:** Either add proper dependencies or use `useShallow` for store subscriptions:

```typescript
useEffect(() => {
  const { filteredGroups, selectedGroup } = useMediaReviewStore.getState()
  if (!selectedGroup && filteredGroups[0]?.key) {
    setSelectedGroupKey(filteredGroups[0].key)
  }
}, [setSelectedGroupKey])
```

### WR-04: Potential Race Condition in Batch Status Update

**File:** `src/stores/mediaReviewStore.ts:634-644`
**Issue:** The `handleBatchStatusChange` function doesn't update local state optimistically and silently swallows errors:

```typescript
handleBatchStatusChange: (batch, status) => {
  updateMediaReviewBatchStatus(batch.id, status).then(({ data, error }) => {
    if (error || !data) {
      console.error('Could not update the batch status:', error)
      return  // Silently fails - UI doesn't reflect failure
    }
    // Only updates if successful
  })
}
```

If the network request fails, the user sees no feedback and the UI is out of sync.

**Fix:** Implement optimistic updates with rollback:

```typescript
handleBatchStatusChange: (batch, status) => {
  const previousBatches = get().batches
  // Optimistic update
  set(state => ({
    batches: state.batches.map(b => b.id === batch.id ? { ...b, status } : b)
  }))

  const { data, error } = await updateMediaReviewBatchStatus(batch.id, status)
  if (error || !data) {
    // Rollback
    set({ batches: previousBatches })
    console.error('Could not update the batch status:', error)
  }
}
```

## Info

### IN-01: Code Duplication

**File:** Multiple files
**Issue:** `slugifyPerson` function is defined in multiple places:
- `src/components/admin/FaceReviewGrid.tsx:69-75`
- `src/components/admin/ClusterMergeModal.tsx:81-87`
- `src/stores/mediaReviewStore.ts:78-84`

If this logic changes, it must be updated in three places, risking inconsistency.

**Fix:** Extract to a shared utility module like `src/utils/slugify.ts`.

### IN-02: Unused Dynamic Import Pattern

**File:** `src/stores/mediaReviewStore.ts:313-323`
**Issue:** Dynamic import inside async function:

```typescript
async function readJsonArtifact<T>(batch: MediaReviewBatch, artifactKey: string): Promise<T | null> {
  const { data, error } = await import('@/lib/supabase').then(m => m.downloadMediaReviewArtifact(...))
```

This defeats tree-shaking and makes the module boundary implicit. The import is at module level in practice since the store is a singleton.

**Fix:** Import directly at the top of the file.

### IN-03: Module-Level Side Effect

**File:** `src/stores/mediaReviewStore.ts:698-705`
**Issue:** Side effect runs when module loads:

```typescript
if (typeof window !== 'undefined') {
  fetchKnownPeopleNames().then(({ data, error }) => {
    if (!error && data) {
      useMediaReviewStore.setState({ knownPeople: data })
    }
  })
}
```

This runs during module initialization, before React's concurrent features can batch it properly. It could cause issues with SSR (though unlikely for this client-only app).

**Fix:** Move this initialization into a provider component or a useInit hook.

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
