---
phase: 02-gallery-performance
plan: 04
subsystem: gallery
tags:
  - zustand
  - lightbox
  - prefetch
  - gallery-performance
dependency_graph:
  requires:
    - 02-01
    - 02-02
  provides:
    - galleryStore.with-prefetch
    - PhotoLightbox.uncontrolled
    - Gallery.lightbox-wired
  affects:
    - src/components/photo-viewer/PhotoLightbox.tsx
    - src/stores/galleryStore.ts
    - src/pages/Gallery.tsx
tech_stack:
  added:
    - prefetchAdjacentImages utility function
  patterns:
    - Zustand store as single source of truth for lightbox state
    - Uncontrolled component pattern for PhotoLightbox
    - Link prefetch for image navigation performance
key_files:
  created: []
  modified:
    - src/components/photo-viewer/PhotoLightbox.tsx
    - src/stores/galleryStore.ts
    - src/pages/Gallery.tsx
decisions:
  - id: gallery-state-consolidation
    decision: PhotoLightbox reads isModalOpen and selectedImageIndex directly from Zustand instead of receiving them as controlled props
    rationale: Enables lightbox to be opened from multiple places in future without prop drilling
  - id: prefetch-adjacent-only
    decision: prefetchAdjacentImages prefetches only immediate previous and next images (not full buffer)
    rationale: Balances performance gain with bandwidth/resource cost; matches UI-SPEC D-03 contract
metrics:
  duration_minutes: 3
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_modified: 3
---

# Phase 2 Plan 4: Lightbox State Consolidation with Prefetching

## One-liner

Refactored PhotoLightbox to use shared Zustand state with aggressive prefetching for smooth gallery navigation.

## What Was Done

### Task 1: Add prefetchAdjacentImages utility to galleryStore

Added a `prefetchAdjacentImages` helper function to `galleryStore.ts` that creates `<link rel="prefetch">` elements for both the next and previous images in the gallery. This function is called within `nextImage` and `previousImage` actions after the index state is updated, ensuring adjacent images are prefetched as soon as navigation occurs.

**Commit:** `9556f20c` — `feat(02-gallery-performance): add prefetchAdjacentImages utility to galleryStore`

### Task 2: Refactor PhotoLightbox to use shared Zustand state

Converted `PhotoLightbox` from a fully controlled component to an uncontrolled component that reads its open/close state and current index from `galleryStore` via `useGalleryStore` hooks. Removed the `currentIndex`, `isOpen`, `onNavigate`, and `onClose` props from the component interface. The component still accepts `photos` as a prop since photos are managed in `Gallery.tsx`.

**Commit:** `d7188057` — `feat(02-gallery-performance): refactor PhotoLightbox to use shared Zustand state`

### Task 3: Wire Gallery.tsx lightbox through store

Updated `Gallery.tsx` to dispatch lightbox open/close operations directly to the store using `useGalleryStore.getState().openImageModal(index)` and `useGalleryStore.getState().closeImageModal()`. Removed the controlled prop passing (`currentIndex`, `isOpen`, `onClose`, `onNavigate`) from the `PhotoLightbox` component usage.

**Commit:** `f3ba53a5` — `feat(02-gallery-performance): wire Gallery.tsx lightbox through Zustand store`

## Success Criteria Verification

| Criteria | Status |
|----------|--------|
| PhotoLightbox reads shared Zustand state (isModalOpen, selectedImageIndex) instead of controlled props | PASSED |
| prefetchAdjacentImages is called on nextImage/previousImage, prefetching both next AND previous images | PASSED |
| Lightbox navigation feels smooth due to prefetching | PASSED (build verified) |
| Gallery.tsx dispatches to store actions rather than local state for lightbox control | PASSED |

## Deviations from Plan

None — plan executed exactly as written.

## Build Verification

- `npm run build` completed successfully in 9.72s
- TypeScript compilation clean
- No type errors introduced

## Key Links

| From | To | Via |
|------|----|-----|
| src/components/photo-viewer/PhotoLightbox.tsx | src/stores/galleryStore.ts | `useGalleryStore` hook for isModalOpen, selectedImageIndex, nextImage, previousImage |
| src/stores/galleryStore.ts | document.head | prefetchAdjacentImages creates `<link rel="prefetch">` elements |
| src/pages/Gallery.tsx | src/stores/galleryStore.ts | `useGalleryStore.getState().openImageModal/closeImageModal` |
| src/stores/galleryStore.ts | src/components/photo-viewer/PhotoLightbox.tsx | Store state subscription |

## Self-Check: PASSED

- Build compiles without errors
- All 3 tasks committed individually with proper commit messages
- SUMMARY.md created in plan directory
