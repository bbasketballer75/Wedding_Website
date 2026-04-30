---
phase: "17-download-management"
plan: "01"
subsystem: ui
tags: [zustand, session-storage, jszip, edge-functions, supabase]

# Dependency graph
requires:
  - phase: "16-lightbox-enhancement"
    provides: PhotoGrid component, Photo type, lightbox modal architecture
provides:
  - downloadStore with sessionStorage persistence (50 soft/100 hard limit)
  - useLongPress hook for mobile long-press detection
  - DownloadQueueFAB bottom-right floating action button
  - GalleryCheckbox reusable checkbox component
  - QueuePanel slide-up download queue panel
  - downloadBatch utility with JSZip <=20 photos, Edge Function >20
  - batch-download Edge Function for large batch signed URLs
  - PhotoGrid long-press selection support
  - GalleryHeader select mode controls (checkbox column, selected count)
affects: [gallery, download-features, mobile-photo-selection]

# Tech tracking
tech-stack:
  added: [jszip, zustand/persist, framer-motion]
  patterns: [hybrid-download (client/edge), sessionStorage persistence, long-press-debounce]

key-files:
  created:
    - src/stores/downloadStore.ts
    - src/hooks/useLongPress.ts
    - src/components/gallery/DownloadQueueFAB.tsx
    - src/components/gallery/QueuePanel.tsx
    - src/components/gallery/GalleryCheckbox.tsx
    - supabase/functions/batch-download/index.ts
  modified:
    - src/components/gallery/PhotoGrid.tsx
    - src/components/gallery/components/GalleryHeader.tsx
    - src/utils/download.ts

key-decisions:
  - "Hybrid download approach: JSZip client-side for <=20 photos, Edge Function for >20"
  - "SessionStorage persistence only for queue state (not ephemeral download state)"
  - "Long-press debounce: longPressFired ref prevents click after long-press activates select"

patterns-established:
  - "safeSessionStorage wrapper pattern for sessionStorage with error handling"
  - "Long-press enters select mode immediately on mobile"
  - "GalleryHeader conditionally renders select mode vs normal controls"

requirements-completed: [DL-01, DL-02, DL-03]

# Metrics
duration: 25min
completed: 2026-04-30
---

# Phase 17: Download Management Summary

**Multi-select photo download with queue persistence: long-press (mobile) or checkbox (desktop) selection, gold-themed FAB, QueuePanel with batch download via JSZip (<=20) or Edge Function (>20)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-30T19:00:00Z
- **Completed:** 2026-04-30T19:25:00Z
- **Tasks:** 9
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- Zustand downloadStore with sessionStorage persistence and 50 soft/100 hard queue limits
- useLongPress hook with 500ms threshold supporting both mouse and touch events
- DownloadQueueFAB (fixed bottom-right, gold background, count badge, rotating chevron)
- GalleryCheckbox component with gold-500 checked/indeterminate states and ring effect
- QueuePanel showing thumbnails, remove buttons, Clear all, Download All with progress
- downloadBatch utility with hybrid approach: JSZip for <=20 photos, Edge Function >20
- batch-download Edge Function returning signed URLs for large batch downloads
- PhotoGrid with long-press-to-select on mobile, 500ms threshold, click debounce after long-press
- GalleryHeader with select mode controls: checkbox column, selected count, Select All, Clear

## Task Commits

Each task was committed atomically:

1. **Task 1: Create downloadStore.ts with sessionStorage persistence** - `85fd4a96` (feat)
2. **Task 2: Create useLongPress.ts hook** - `4805bd6b` (feat)
3. **Task 3: Create DownloadQueueFAB component** - `7f07b9b2` (feat)
4. **Task 4: Create GalleryCheckbox component** - `24615738` (feat)
5. **Task 5: Create QueuePanel component** - `98c6af67` (feat)
6. **Task 6: Extend download.ts with batchDownload function** - `c35fb6c6` (feat)
7. **Task 7: Extend PhotoGrid with long-press selection support** - `010eddff` (feat)
8. **Task 8: Extend GalleryHeader with select mode controls** - `45de6758` (feat)
9. **Task 9: Create Edge Function for batch download** - `dc03ca0b` (feat)

## Files Created/Modified

- `src/stores/downloadStore.ts` - Zustand store with QueuedPhoto interface, 50/100 limits, sessionStorage persistence
- `src/hooks/useLongPress.ts` - React hook with 500ms default threshold, mouse/touch support
- `src/components/gallery/DownloadQueueFAB.tsx` - Gold FAB with count badge and rotating chevron
- `src/components/gallery/QueuePanel.tsx` - Slide-up panel with thumbnails, remove, clear, download all
- `src/components/gallery/GalleryCheckbox.tsx` - Reusable checkbox with gold-500 checked state
- `src/utils/download.ts` - Added downloadBatch, refreshSignedUrls, sanitizeFilename, getExtensionFromUrl
- `src/components/gallery/PhotoGrid.tsx` - Added longPressHandlers, handlePhotoClick with debounce
- `src/components/gallery/components/GalleryHeader.tsx` - Added selectMode props and conditional rendering
- `supabase/functions/batch-download/index.ts` - Edge Function returning signed URLs for large batches

## Decisions Made

- Used JSZip client-side for small batches (<=20) to avoid Edge Function memory issues
- Edge Function returns signed URLs (not pre-generated zip) to avoid memory issues per D-11
- sessionStorage persistence only for queuedPhotos and isPanelOpen (not isDownloading/downloadProgress)
- Removed unused `_get` parameter from downloadStore to satisfy ESLint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- ESLint error `_get is defined but never used` in downloadStore.ts - Fixed by changing `(set, _get)` to `(set)`

## Next Phase Readiness

- Download queue infrastructure complete
- UI components in place (FAB, QueuePanel, GalleryCheckbox)
- Ready for integration with gallery page and queue management UI wiring
- Edge Function deployed when Supabase CLI runs next

---
*Phase: 17-download-management*
*Completed: 2026-04-30*