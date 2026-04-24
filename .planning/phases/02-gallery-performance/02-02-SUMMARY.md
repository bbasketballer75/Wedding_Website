---
phase: 02-gallery-performance
plan: 02
subsystem: gallery
tags:
  - types
  - refactor
  - supabase
  - GALLERY-02
dependency_graph:
  requires:
    - plan: 02-01
      phase: 02-gallery-performance
  provides:
    - Canonical Photo type import across gallery components
tech_stack:
  added: []
  patterns:
    - Canonical type imported from single source (@/lib/supabase)
    - Display-only properties handled via GalleryPhoto extension
key_files:
  created: []
  modified:
    - src/pages/Gallery.tsx
    - src/components/gallery/PhotoGrid.tsx
    - src/components/gallery/components/PhotoItem.tsx
    - src/components/photo-viewer/PhotoLightbox.tsx
decisions:
  - "Replaced duplicate local Photo interface in Gallery.tsx with GalleryPhoto extending canonical Photo"
  - "Removed local Photo interface from PhotoGrid.tsx, PhotoItem.tsx, PhotoLightbox.tsx"
  - "Kept local Comment interface in PhotoLightbox.tsx for UI-only display type"
  - "Removed [key: string]: any index signature from PhotoItem.tsx"
  - "GalleryPhoto extends canonical Photo to add display-only properties (aspectRatio, source, collection, comments, etc.)"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-24T22:05:00Z"
  tasks_completed: 4
  files_modified: 4
  commits: 4
---

# Phase 02 Plan 02: Consolidate Photo Type Definitions

## One-liner

Refactored Gallery.tsx, PhotoGrid.tsx, PhotoItem.tsx, and PhotoLightbox.tsx to import the canonical Photo type from `src/lib/supabase.ts` and removed all duplicate local Photo interface definitions.

## What Was Done

**Canonical Photo type** (from `src/lib/supabase.ts`, lines 50-67) is now the single source of truth for the Photo type across all gallery files.

### Task Summary

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | Refactor Gallery.tsx - replace local Photo interface with GalleryPhoto extending Photo | 477d9616 |
| 2 | Update PhotoGrid.tsx - import Photo from supabase.ts, remove local interface | 7791f0e8 |
| 3 | Update PhotoItem.tsx - import Photo from supabase.ts, remove [key: string]: any | ba8e8c16 |
| 4 | Update PhotoLightbox.tsx - import Photo from supabase.ts, remove local interfaces | ed3fa4ea |

### Key Changes

**Gallery.tsx** (`src/pages/Gallery.tsx`)
- Removed duplicate Photo interface (previously lines 44-79)
- Now imports `Photo` directly from `@/lib/supabase` instead of aliased `SupabasePhoto`
- Added `GalleryPhoto` interface extending `Photo` with display-only properties: `downloadUrl`, `albumSortOrder`, `aspectRatio`, `time`, `comments`, `commentCount`, `createdAt`, `liked`, `likeCount`, `source`, `collection`
- Updated `mapSupabasePhoto`, `normalizeGalleryPhoto`, `curatedPhotos` to use `GalleryPhoto`

**PhotoGrid.tsx** (`src/components/gallery/PhotoGrid.tsx`)
- Removed duplicate local Photo interface
- Added `import type { Photo } from '@/lib/supabase'`
- `PhotoGridProps.photos` now typed as `Photo[]`

**PhotoItem.tsx** (`src/components/gallery/components/PhotoItem.tsx`)
- Removed duplicate local photo interface with `[key: string]: any` index signature
- Added `import type { Photo } from '@/lib/supabase'`
- `PhotoItemProps.photo` now typed as `Photo`

**PhotoLightbox.tsx** (`src/components/photo-viewer/PhotoLightbox.tsx`)
- Removed duplicate local Photo interface
- Removed local FaceTag interface (equivalent to `PhotoFace` in supabase.ts)
- Added `import type { Photo } from '@/lib/supabase'`
- Kept local `Comment` interface (UI-only display type not in database schema)
- `PhotoLightboxProps.photos` now typed as `Photo[]`

## Verification

- `npm run build` passes with no errors
- No duplicate `interface Photo` definitions remain in the four modified files
- All four files import Photo from `@/lib/supabase`

## Commits

- `477d9616` feat(02-02): refactor Gallery.tsx to import canonical Photo from supabase.ts
- `7791f0e8` feat(02-02): PhotoGrid imports canonical Photo type from supabase.ts
- `ba8e8c16` feat(02-02): PhotoItem imports canonical Photo type from supabase.ts
- `ed3fa4ea` feat(02-02): PhotoLightbox imports canonical Photo type from supabase.ts

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Not applicable - plan type is `execute`, not `tdd`.

## Self-Check

- [x] All 4 tasks executed and committed
- [x] No duplicate Photo interfaces remain in target files
- [x] Canonical Photo imported from @/lib/supabase in all files
- [x] Build passes
- [x] GalleryPhoto extends Photo with display-only properties
- [x] SUMMARY.md created in plan directory
