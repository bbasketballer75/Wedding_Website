---
phase: 19-shared-links-print
plan: "01"
subsystem: ui
tags: [shared-links, print-url, guest-share-tokens, react-router]

# Dependency graph
requires:
  - phase: 19-00-WAVE0
    provides: Test infrastructure for shareUtils and GuestShared
provides:
  - Database migration for guest_share_tokens table
  - Share token generation on guest upload
  - Public /guest/:token route with shared album view
  - Order Prints button in lightbox toolbar
affects: [photo-claiming, guest-experience]

# Tech tracking
tech-stack:
  added: []
  patterns: [UUID v4 token generation, public token-based access, external print provider redirect]

key-files:
  created:
    - supabase/migrations/20260502000000_guest_share_tokens.sql
    - src/pages/GuestShared.tsx
  modified:
    - src/lib/shareUtils.ts
    - src/lib/supabase.ts
    - src/pages/Upload.tsx
    - src/App.tsx
    - src/components/photo-viewer/PhotoLightbox.tsx

key-decisions:
  - "Using crypto.randomUUID() for token generation per dont_hand_roll rules"
  - "shareUtils.ts uses guest_share_tokens table (not guest_uploads.share_token)"
  - "Token stored in dedicated table rather than inline with uploads for cleaner separation"

patterns-established:
  - "Pattern: Token IS the credential - public page requires no login, token is UUID v4 (high entropy)"
  - "Pattern: Idempotent token generation - ensureGuestShareToken safe to call even if token exists"

requirements-completed: [SC-03, PR-01]

# Metrics
duration: 5min
completed: 2026-05-01
---

# Phase 19-01: Shared Links & Print Summary

**Guest shared album links with UUID tokens and print ordering redirect to Shutterfly/Artifact Uprising**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-01T00:08:34Z
- **Completed:** 2026-05-01T00:13:00Z
- **Tasks:** 5
- **Files modified:** 6

## Accomplishments
- Database migration creates guest_share_tokens table with UNIQUE token, RLS policies, and indexes
- shareUtils.ts provides buildPrintUrl (shutterfly/artifact_uprising), getShareToken, ensureGuestShareToken
- supabase.ts exports fetchGuestShareToken, fetchGuestUploadsByEmail, fetchGuestbookByEmail
- Upload page calls ensureGuestShareToken after successful guest upload
- GuestShared page at /guest/:token shows guest's approved uploads and guestbook messages
- Order Prints button in PhotoLightbox opens external print provider in new tab

## Task Commits

1. **Task 1: Create guest_share_tokens database migration** - `d546c25f` (feat)
2. **Task 2: Add share token utilities and query functions** - `fb596352` (feat)
3. **Task 3: Wire token generation into guest upload flow** - `c0baebae` (feat)
4. **Task 4: Create GuestShared public page component** - `529b08ff` (feat)
5. **Task 5: Add /guest/:token route and Order Prints button to lightbox** - `7a49084d` (feat)

## Files Created/Modified
- `supabase/migrations/20260502000000_guest_share_tokens.sql` - Creates guest_share_tokens table with RLS
- `src/lib/shareUtils.ts` - buildPrintUrl, getShareToken, ensureGuestShareToken
- `src/lib/supabase.ts` - fetchGuestShareToken, fetchGuestUploadsByEmail, fetchGuestbookByEmail
- `src/pages/Upload.tsx` - Calls ensureGuestShareToken after successful upload
- `src/pages/GuestShared.tsx` - Public shared album page at /guest/:token
- `src/App.tsx` - Added /guest/:token route
- `src/components/photo-viewer/PhotoLightbox.tsx` - Added Order Prints button

## Decisions Made
- Using crypto.randomUUID() for token generation per dont_hand_roll rules
- shareUtils.ts uses guest_share_tokens table (not guest_uploads.share_token)
- Token stored in dedicated table rather than inline with uploads for cleaner separation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without significant issues. Build passes, lint shows pre-existing issues unrelated to this plan.

## Next Phase Readiness
- Migration ready to apply with `npm run supabase:db:push`
- GuestShared page can be viewed at /guest/{valid-uuid-token}
- Print button opens Shutterfly URL by default (configurable via VITE_PRINT_PROVIDER)
- No blockers

---
*Phase: 19-shared-links-print-01*
*Completed: 2026-05-01*
