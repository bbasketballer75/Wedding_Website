---
phase: 19-shared-links-print
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/shareUtils.ts
  - src/lib/shareUtils.test.ts
  - src/lib/guestShared.ts
  - src/lib/guestShared.test.ts
  - src/pages/GuestShared.tsx
  - src/pages/Upload.tsx
  - src/components/photo-viewer/PhotoLightbox.tsx
  - src/components/gallery/components/GalleryHeader.tsx
  - src/App.tsx
  - supabase/migrations/20260502000000_guest_share_tokens.sql
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 19 adds guest share tokens for a shared album feature (`/guest/:token`). The core logic is sound, but there are several issues: a type mismatch between `fetchGuestShareToken` return type and how the caller uses it, double-encoding of URLs in `buildPrintUrl`, incomplete test coverage for error paths, and a missing uniqueness check in the RLS insert policy that allows duplicate tokens per email.

---

## Critical Issues

### CR-01: Type mismatch between fetchGuestShareToken and its caller

**File:** `src/lib/guestShared.ts:23-31`
**Issue:** `fetchGuestShareToken` returns `{ email: string; share_token: string }` (using `GuestShareTokenData` interface defined locally in guestShared.ts), but `GuestShared.tsx:88-89` treats the result as having `guest_email` and `token` properties:

```typescript
// guestShared.ts - returns this shape:
return { email: data.guest_email, share_token: data.token }

// GuestShared.tsx - accesses this shape:
const { token } = data  // token is { email: string; share_token: string }
const shareUrl = `${window.location.origin}/guest/${token.token}`  // .token is undefined!
```

The destructured `token` from `SharedData` would be typed as `GuestShareToken`, which is the Supabase row type (with `guest_email`, `token` fields). But `fetchGuestShareToken` returns `{ email, share_token }` — different field names.

At runtime, `token.token` is `undefined` on the returned object, so `shareUrl` becomes `http://origin/guest/undefined`. The "Copy share link" button copies an invalid URL.

**Fix:**
Align the return type of `fetchGuestShareToken` with what the Supabase `GuestShareToken` type uses, or update the caller. The cleanest fix is to rename fields in `GuestShareTokenData` to match:

```typescript
// src/lib/guestShared.ts
export interface GuestShareTokenData {
  guest_email: string  // was: email
  token: string        // was: share_token
}

// return statement should use guest_email and token directly from data
return { guest_email: data.guest_email, token: data.token }
```

Then update `GuestShared.tsx` to destructure `token.guest_email` instead of `token.guest_email` (already correct there) and `token.token` (already used), but verify the type alignment.

---

## Warnings

### WR-01: Double URL encoding in buildPrintUrl

**File:** `src/lib/shareUtils.ts:11-12`
**Issue:** `encodeURIComponent` is applied to `photoUrl`, but R2/storage URLs already contain encoded characters (e.g., `%20` for spaces). This double-encodes them, breaking URLs like `https://.../photo%20.jpg` into `https://.../photo%2520.jpg`.

This affects the print link generation for any photo whose storage URL contains encoded characters.

**Fix:**
Remove `encodeURIComponent` from the print URL builders, or only encode the path component:

```typescript
const PRINT_URLS: Record<PrintProvider, (photoUrl: string) => string> = {
  shutterfly: (url) => `https://www.shutterfly.com/photos/print?photo=${url}`,
  artifact_uprising: (url) => `https://www.artifactuprising.com/print?photo=${url}`,
}
```

The photo URLs from Supabase storage are already properly encoded.

---

### WR-02: Race condition / missing uniqueness guarantee in ensureGuestShareToken

**File:** `src/lib/shareUtils.ts:43-58`
**Issue:** `ensureGuestShareToken` has a check-then-insert race condition. Two concurrent requests for the same email could both see no existing token, then both try to insert. The insert would succeed for one (due to `gen_random_uuid()` uniqueness) but the second would fail with a unique constraint violation. The error message would be `"Failed to create share token: duplicate key value"` — not informative, and the token creation would appear to fail for the user even though one succeeded.

Additionally, nothing prevents creating multiple tokens for the same email in the current RLS setup — the insert policy has no uniqueness check on `guest_email`.

**Fix:**
Either catch the unique constraint error and retry with a new token, or use a database function with `ON CONFLICT` to upsert:

```typescript
// Use upsert to handle race condition
const { error } = await supabase
  .from('guest_share_tokens')
  .upsert(
    { guest_email: email, token },
    { onConflict: 'guest_email', ignoreDuplicates: true }
  )
```

Or add a unique index on `(guest_email)` and rely on the error path:

```typescript
if (error && error.code !== '23505') throw new Error(...)
// If 23505 (unique violation), another request already inserted — fetch it
return (await getShareToken(email))!
```

---

### WR-03: Missing UPDATE and DELETE policies for guest_share_tokens

**File:** `supabase/migrations/20260502000000_guest_share_tokens.sql`
**Issue:** The migration only adds INSERT and SELECT policies for public access. There is no way to update or delete tokens. If a guest wants to invalidate their share link, or if the site needs to clean up expired tokens, those operations are blocked by RLS.

This is not currently needed by the feature, but the absence should be noted for future implementation.

**Fix:**
Add placeholder policies or database functions for token management when needed:

```sql
-- For cleanup of old tokens (admin only, not public)
create policy "Admin can delete old tokens"
  on public.guest_share_tokens
  for delete to authenticated
  using (auth.jwt() -> 'role' = 'service_role');
```

---

### WR-04: Upload.tsx silently swallows ensureGuestShareToken failure

**File:** `src/pages/Upload.tsx:462-463`
**Issue:** The `ensureGuestShareToken(email)` call is awaited but its error is caught by the outer `catch` block at line 467. However, if the Supabase insert for `guest_uploads` succeeds but the token creation fails, the error message shown is `"Something didn't quite work — give it another go"` which doesn't reflect that the upload itself was saved.

The guest share token is not critical for the upload to succeed (the upload is saved to `guest_uploads`), but the user would see a confusing error.

**Fix:**
Separate the token creation from the upload submission, or handle its failure independently:

```typescript
// Create share token independently — don't fail the whole submission if this fails
try {
  await ensureGuestShareToken(email)
} catch (tokenError) {
  // Log but don't block — upload already succeeded
  console.error('Failed to create share token:', tokenError)
}
```

---

## Info

### IN-01: Test does not verify insert payload in ensureGuestShareToken

**File:** `src/lib/shareUtils.test.ts:97-118`
**Issue:** The test for creating a new token mocks `maybeSingle` to return null and `insert` to return data, but never asserts that the `insert` was called with the correct `{ guest_email, token }` payload. A future regression could insert the wrong data without this test catching it.

**Fix:**
Add assertion on the insert mock:

```typescript
expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
  guest_email: 'newguest@example.com',
  token: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
```

---

### IN-02: getShareToken error path not tested

**File:** `src/lib/shareUtils.test.ts:58-74`
**Issue:** The test for "returns null when no share token exists" only covers the happy path (`maybeSingle` returns `{ data: null, error: null }`). There is no test for when `maybeSingle` returns an error object — the function would throw instead of returning null.

**Fix:**
Add a test case for the error path:

```typescript
it('throws when database returns an error', async () => {
  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnValue({
      data: null,
      error: { message: 'Connection failed' },
    }),
  }
  vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabaseClient as any)
  await expect(getShareToken('guest@example.com')).rejects.toThrow()
})
```

---

### IN-03: guestShared.test.ts mocks Promise.all incorrectly

**File:** `src/lib/guestShared.test.ts:69`
**Issue:** The test spies on `Promise.all` and replaces it with a resolved value, but this mock is global and not cleaned up in `afterEach`. It could affect subsequent tests if the test file grows. Also, the mock setup for `supabaseClient.from().select().eq()` returns a thenable object rather than a proper mock that `fetchGuestSharedData` can consume with `await`.

**Fix:**
Use `vi.mock()` for the Supabase client instead of manually chaining `.then()`, or use a proper mock that matches the actual Supabase client chain behavior.

---

## Notes

- The `/guest/:token` route is correctly wired in `App.tsx:225-233`.
- The RLS policies use `do $$ ... $$` blocks to avoid recreating policies that already exist — correct approach for idempotent migrations.
- `GalleryHeader.tsx` has no changes related to this phase — reviewed as part of the changed files list but no issues found.
- `PhotoLightbox.tsx` uses `buildPrintUrl` for the Print button — same double-encoding issue applies at line 431.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_