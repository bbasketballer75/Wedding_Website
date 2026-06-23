---
phase: 17-download-management
plan: "01"
subsystem: gallery
tags: [react, zustand, jszip, touch-gestures, batch-download, select-mode]

# Dependency graph
requires:
  - phase: 16-lightbox-enhancement
    provides: Custom touch interaction hook patterns
provides:
  - Long-press touch selection for photos
  - derived useMemo selection state from Zustand downloadStore
  - sessionStorage persisted queue capped at 50 items
  - inline control bar triggers "Select All Visible" and "Clear Selection"
  - share URL bindings for pre-populating queues
  - hybrid client/server zip compiler downloadBatch
affects: [18-photo-claiming]

# Tech tracking
tech-stack:
  added: [jszip]
  patterns: [useLongPress gesture hook, persistent Zustand queue store, derived useMemo sets, hybrid zip engine]

key-files:
  created:
    - src/hooks/useLongPress.ts
    - src/hooks/useLongPress.test.ts
    - src/stores/downloadStore.ts
    - src/stores/downloadStore.test.ts
    - src/components/gallery/ProgressModal.tsx
    - src/components/gallery/DownloadQueuePanel.tsx
  modified:
    - src/utils/download.ts
    - src/utils/download.test.ts
    - src/pages/Gallery.tsx
    - src/components/gallery/PhotoGrid.tsx
    - src/components/gallery/VirtualizedPhotoGrid.tsx

key-decisions:
  - "Extract grid cards into standalone sub-components (PhotoGridItem/VirtualizedPhotoItem) to avoid React hook-in-loop violations"
  - "Set a strict queue limit of 50 photos to prevent browser tab or function memory crashes"
  - "Sync the selection state to a session storage wrapper that auto-wipes when browser closes"
  - "Leverage client-side JSZip for small batches (<=20 photos) and server Netlify post stream for large ones (>20)"

requirements-completed: [DL-01, DL-02, DL-03]

# Metrics
duration: 15min
completed: 2026-05-21
---

# Phase 17 Plan 01: Download Management Summary

**Premium select-mode gestures, persistent Zustand queue storage, hybrid client-server JSZip zipping engine, and gorgeous gold HSL accented widgets**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-05-21T17:12:50-04:00
- **Tasks:** 6
- **Files created:** 6
- **Files modified:** 5

## Accomplishments

- **Avoided React Hook Violations**: Created `PhotoGridItem` (in `PhotoGrid.tsx`) and `VirtualizedPhotoItem` (in `VirtualizedPhotoGrid.tsx`) encapsulating card layouts and binding the `useLongPress` handlers safely.
- **Robust Touch Interactions**: Integrated the custom `useLongPress` gesture hook into these items with full touch coordinates checking, scroll cancellation, and right-click exclusion.
- **Derived Global State**: Refactored `src/pages/Gallery.tsx`'s local state to high-performance derived useMemo selectors sourced directly from the Zustand `downloadStore`'s `queue` persisting safely to sessionStorage.
- **Control Bar Extension**: Extended the inline controls row in `Gallery.tsx` with a beautifully styled gold-accented actions sub-panel containing "Select All Visible" and "Clear Selection" buttons, visible when `selectMode` is active.
- **Unified Batch Zipping Engine**: Refactored `handleDownloadPack` in `Gallery.tsx` to utilize the new hybrid client/server zip generator utility (`downloadBatch`) so that desktop and queue downloads share the same glassmorphic loading modal and stream progress.
- **Seamless Mount Integration**: Mounted `DownloadQueuePanel` and `ProgressModal` right at the bottom of the `Gallery.tsx` page layout.
- **Automated Verification**: Achieved **100% test success rate (55/55 passed tests)**.

## Files Created/Modified

### Created
- `src/hooks/useLongPress.ts`
- `src/hooks/useLongPress.test.ts`
- `src/stores/downloadStore.ts`
- `src/stores/downloadStore.test.ts`
- `src/components/gallery/ProgressModal.tsx`
- `src/components/gallery/DownloadQueuePanel.tsx`

### Modified
- `src/utils/download.ts`
- `src/utils/download.test.ts`
- `src/pages/Gallery.tsx`
- `src/components/gallery/PhotoGrid.tsx`
- `src/components/gallery/VirtualizedPhotoGrid.tsx`

## Decisions Made

- Standardized HSL tailored gold highlights (`#d4af37`), cream backgrounds, rounded-xl corner shapes, and 300ms Framer Motion timings.
- Enforced standard accessibility properties (aria-label, aria-pressed, gold focus rings) on all newly added selection UI overlays and buttons.
- Leveraged client-side JSZip compiling for $\le 20$ files to save Netlify function usage, while server-side streamed POST for $>20$ files avoids tab memory crashes on larger sets.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Declaring custom hooks directly inside element rendering callbacks inside Masonry grids or Virtualized rows violates React Hook rules. Encapsulating each card inside standalone components (`PhotoGridItem` and `VirtualizedPhotoItem`) successfully resolves this constraint.

## Next Phase Readiness

- Phase 18 (Photo Claiming) is fully ready to proceed.

---
*Phase: 17-download-management*
*Completed: 2026-05-21*
