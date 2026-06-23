---
phase: 02-gallery-performance
plan: "03"
subsystem: gallery
tags: [lqip, blurhash, progressive-image-loading, gallery]
dependency_graph:
  requires:
    - "02"
  provides:
    - LQIP blur placeholder for gallery images
  affects:
    - src/components/gallery/components/PhotoItem.tsx
    - src/hooks/useBlurHash.ts
    - src/lib/supabase.ts
tech_stack:
  added:
    - blurhash ^2.0.5
  patterns:
    - LQIP (Low-Quality Image Placeholders)
    - Progressive image loading with blur-to-sharp transition
    - 20px blur, scale(1.1), 300ms opacity fade
key_files:
  created:
    - src/hooks/useBlurHash.ts
  modified:
    - src/components/gallery/components/PhotoItem.tsx
    - src/lib/supabase.ts
    - package.json
decisions:
  - id: blurhash-library
    rationale: "Official blurhash package provides efficient blur hash string decoding to RGBA pixels for canvas rendering"
  - id: OptimizedImage-pattern
    rationale: "Existing OptimizedImage component already implements the UI-SPEC LQIP contract (20px blur, scale(1.1), 300ms opacity) so we reuse it rather than reimplement"
  - id: color-fallback
    rationale: "Images without blurHash fall back to bg-charcoal-200 via OptimizedImage placeholder='color' mode"
metrics:
  duration: "~2 min"
  completed: "2026-04-24"
  tasks_completed: 3
  files_created: 1
  files_modified: 4
---

# Phase 2 Plan 3: LQIP Blur Placeholders

Implemented Low-Quality Image Placeholders (LQIP) with blur hash decoding for progressive image loading in the gallery.

## One-liner

Blur hash LQIP system using the `blurhash` package, `useBlurHash` hook, and existing `OptimizedImage` component for progressive image loading with 20px blur, scale(1.1), and 300ms opacity fade.

## What Was Built

### Task 1: Install blurhash package
Added `blurhash ^2.0.5` as a production dependency. Provides `decode()` function to convert blur hash strings into RGBA pixel data for canvas rendering.

**Commit:** `76c32335`

### Task 2: Create useBlurHash hook
New hook at `src/hooks/useBlurHash.ts` that:
- Takes a blur hash string and decodes it to RGBA pixels via the `blurhash` library
- Renders pixels onto a 32x32 canvas and converts to base64 data URL
- Returns `null` for invalid/null hashes, allowing graceful fallback
- Stored as state to avoid re-decoding on every render

**Commit:** `72babb2f`

### Task 3: PhotoItem uses OptimizedImage with blur placeholder
Updated `PhotoItem.tsx` to:
- Import `OptimizedImage` and `useBlurHash`
- Call `useBlurHash(photo.blurHash)` to get decoded data URL
- Replace raw `<img>` tags with `<OptimizedImage placeholder="blur" blurDataURL={blurDataURL}>` in both carousel and masonry/grid views
- Fall back to `placeholder="color"` (bg-charcoal-200) when `blurDataURL` is null
- Added `blurHash?: string | null` to the `Photo` interface in `supabase.ts`

**Commit:** `633548dd`

## Success Criteria

- [x] blurhash package installed
- [x] useBlurHash hook decodes blur hash string to data URL
- [x] PhotoItem uses OptimizedImage with blur placeholder (20px blur, scale(1.1), 300ms opacity transition via existing OptimizedImage implementation)
- [x] Images without blurHash fall back to bg-charcoal-200 placeholder

## Deviations from Plan

**Rule 2 - Auto-add critical field:** Added `blurHash?: string | null` to the `Photo` interface in `supabase.ts` since the plan referenced `photo.blurHash` but the field did not exist in the type definition.

## Verification

Build passed with no errors:
```
npm run build → ✓ built in 9.50s
```

All grep verification checks passed:
- `grep -n "import.*OptimizedImage.*from.*@/components/ui/OptimizedImage" PhotoItem.tsx` ✓
- `grep -n "import.*useBlurHash.*from.*@/hooks/useBlurHash" PhotoItem.tsx` ✓
- `grep -n "OptimizedImage" PhotoItem.tsx` shows two instances (carousel + masonry/grid) ✓

## TDD Gate Compliance

Not a TDD plan — standard implementation flow.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `76c32335` | feat(02-03): install blurhash package for LQIP placeholders |
| 2 | `72babb2f` | feat(02-03): add useBlurHash hook for LQIP blur placeholder decoding |
| 3 | `633548dd` | feat(02-03): use OptimizedImage with blur placeholder in PhotoItem |

## Self-Check

- [x] `src/hooks/useBlurHash.ts` exists and exports `useBlurHash`
- [x] `src/components/gallery/components/PhotoItem.tsx` imports OptimizedImage and useBlurHash
- [x] `src/lib/supabase.ts` has `blurHash?: string | null` on Photo interface
- [x] All three commits present in git log
- [x] Build succeeds without errors
