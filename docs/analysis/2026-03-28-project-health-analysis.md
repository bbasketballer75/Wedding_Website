# Project Health Analysis — 2026-03-28

## Executive Summary

The codebase is in strong shape. Both active implementation plans (guestbook/share cinematic overhaul and feature/card logic cleanup) are 100% complete across 24 commits that were pushed to `origin/main` this session. TypeScript and ESLint are clean. Five dead code files were deleted, one dependency was reclassified, and one ESLint configuration gap was fixed. Several lower-priority items are documented below for future cleanup.

---

## Actions Taken This Session

| # | Item | Action |
|---|------|--------|
| 1 | 24 local commits | Pushed to `origin/main` |
| 2 | `src/compliance/gdpr.ts` | Deleted — `GDPRManager` (372 lines) imported nowhere in `src/` |
| 3 | `src/components/guestbook/ReactionPicker.tsx` | Deleted — never imported after guestbook simplification |
| 4 | `src/components/guestbook/VideoRecorder.tsx` | Deleted — never imported |
| 5 | `src/components/guestbook/VoiceRecorder.tsx` | Deleted — never imported |
| 6 | `cloudflare/` directory | Deleted — empty placeholder |
| 7 | `eslint.config.js` | Added `supabase/**` to ignores — was causing a false-positive parser error on the edge function |
| 8 | `package.json` | Moved `dotenv` from `dependencies` → `devDependencies` — Vite handles `.env` natively; `dotenv` is only used in Node.js scripts |
| 9 | 8 stale remote branches | Deleted via `git push origin --delete` |
| 10 | GitHub issue #2 | Closed — transient uptime alert from 2026-03-16, site is healthy |
| 11 | Repo metadata | Added description and topics |

---

## Remaining Items (Not Auto-Fixed)

### P2 — Worth Addressing Soon

**Guestbook still using `get_guestbook_messages_with_comments` RPC**
- Location: `src/pages/Guestbook.tsx:120`
- The guestbook was simplified to text-only, removing reactions/comments from the UI. However the fetch still calls `get_guestbook_messages_with_comments` (a heavier RPC that joins comments/reactions) and the insert still writes `reactions: {}`. Functionally correct, but the RPC could be replaced with a simpler `from('guestbook_messages').select('*')` fallback that's already in the file.
- Fix: Remove the RPC call and just use the existing `.select('*')` fallback directly.

**`src/stores/memoriesStore.ts` + `src/hooks/useMemories.js` — potentially vestigial**
- The `memoriesStore` writes to the `shared_memories` table and the `useMemories` hook wraps it. Neither is imported by any page component. The current Upload page uses its own direct Supabase logic. The store has a test file (`memoriesStore.test.ts`).
- Assessment: This appears to be from an older "Memories" feature that pre-dates the current Upload → `guest_uploads` approval workflow.
- Fix: Confirm the `shared_memories` / `all_memories` tables are no longer needed, then delete `memoriesStore.ts`, `useMemories.js`, and their test file.

**No `ErrorBoundary` wrapping routes in `App.tsx`**
- The `src/components/error/ErrorBoundary.tsx` component exists and is well-implemented, but it is not wrapped around any routes in `App.tsx`. If a page throws during render, the entire app will unmount.
- Fix: Wrap each `LazyPage` or the root `AppContent` in an `ErrorBoundary`.

### P3 — Low Priority / Nice-to-Have

**`src/lib/supabase.ts` has lingering reaction/comment type definitions**
- Lines 94 (`reactions: Record<string, number>`) and 358–359 (`comments_count`, `hidden_comments_count`) reflect the old guestbook schema. These are part of the `SupabaseMemory`-type mapping layer and don't cause errors, but could be pruned.

**`src/types/index.ts` — `GuestBookEntry` interface is unused**
- The `GuestBookEntry` interface (lines 38–44) is defined but not referenced anywhere in the codebase. Low-risk cleanup.

---

## Code Quality Metrics

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint | ✅ 0 errors, 0 warnings |
| Dead code files deleted | 5 |
| Dep reclassified | 1 (`dotenv` → devDeps) |

---

## Bundle Assessment

| Package | Location | Browser bundle? | Notes |
|---------|----------|-----------------|-------|
| `@tensorflow/tfjs` | devDeps | No | Only used in Node batch scripts |
| `@vladmandic/human` | devDeps | No | Same — face detection is offline/server-side |
| `exifr` | devDeps | No | EXIF extraction in scripts only |
| `tus-js-client` | devDeps | No | Resumable uploads for scripts only |
| `jszip` | deps | Yes | Used in `src/utils/guestTagging.ts` |
| `leaflet` + `react-leaflet` | deps | Yes | Gallery MapView + GuestMap on Home |
| `framer-motion` | deps | Yes | Page transitions throughout |
| `@dnd-kit/*` | deps | Yes | Admin album organizer drag-and-drop |

TensorFlow.js (~30 MB) stays out of the browser bundle entirely — the `FaceRecognition` component is a pure UI widget that receives pre-computed `detectedFaces` as props from the database.

---

## Architecture Assessment

**Strengths:**
- All pages lazy-loaded via `React.lazy()` + `Suspense` in `App.tsx` — good initial load performance
- Clean separation: `repositories/` for data access, `services/` for analytics/errors, `stores/` for UI state, `hooks/` for reusable logic
- Accessibility-first: `AccessibilityProvider`, `SkipLink`, `KeyboardShortcutsModal`, Axe E2E tests
- PWA configured, offline indicator in place
- Comprehensive E2E test suite (9 Playwright specs)

**Gaps:**
- No `ErrorBoundary` at the route level (see P2 above)
- `memoriesStore` (vestigial) exported from `stores/index.ts` — creates noise in the public store API
- Guestbook page has two fetch paths (RPC + direct) with the simpler one being the correct post-refactor path — should collapse to one
