# Phase 17: Download Management - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can select multiple photos in the gallery and download them as a batch with queue persistence. Multi-select via long-press (mobile) or checkbox toggle (desktop), with a floating queue panel and hybrid client/server batch download.

**Specific scope (DL-01, DL-02, DL-03):**
- Long-press (500ms) on mobile triggers multi-select mode
- Checkbox column in gallery grid header for desktop multi-select toggle
- Selected count displayed in header during multi-select mode
- "Add to Download" button appears when photos are selected
- Floating action button (FAB) in bottom-right shows queue count
- Queue panel shows selected photos with remove option (whole pill tappable to expand)
- "Download All" generates zip file with progress indicator
- Queue persists across page reloads via sessionStorage

**Out of scope:** New capabilities — only download management as scoped in ROADMAP.md.

</domain>

<decisions>
## Implementation Decisions

### Multi-Select Activation (DL-01)
- **D-01:** Both activation methods — long-press on mobile, checkbox on desktop
- **D-02:** Long-press threshold: 500ms (reliable, not too fast)
- **D-03:** Checkbox column appears in gallery grid header (desktop only)
- **D-04:** Multi-select mode shows selected count in header

### Queue Panel UI (DL-01)
- **D-05:** Floating action button (FAB) positioned bottom-right
- **D-06:** FAB shows count badge when items are queued
- **D-07:** Whole pill is tappable to expand/collapse the queue panel
- **D-08:** Queue panel shows selected photos as thumbnails with remove option
- **D-09:** "Add to Download" button appears when photos are selected

### Batch Download (DL-02)
- **D-10:** Hybrid approach: JSZip for small batches (<=20 photos), Edge Function for large batches (>20)
- **D-11:** Edge Function avoids client memory issues for large batches
- **D-12:** Progress indicator: "Preparing... X of Y photos"
- **D-13:** Files named descriptively in zip

### Queue Persistence (DL-03)
- **D-14:** New `downloadStore` (Zustand) persists to sessionStorage
- **D-15:** On page reload, restore queue from sessionStorage
- **D-16:** Queue badge shows count of items

### Animation Standards (from prior phases)
- **D-17:** Transitions: 300ms ease-out (Phase 13/14 baseline)
- **D-18:** Micro-interactions: 150ms

### Design Tokens (from Phase 11)
- **D-19:** Gold accent: #d4af37
- **D-20:** Cream backgrounds: cream-50, cream-100
- **D-21:** Border radius: rounded-xl for cards, rounded-lg for buttons

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 17 goal, requirements (DL-01, DL-02, DL-03), success criteria
- `.planning/REQUIREMENTS.md` §DL — Download management requirements detail

### Prior Context
- `.planning/phases/16-lightbox-enhancement/16-CONTEXT.md` — Lightbox patterns, zoom behavior
- `.planning/phases/15-activity-feed/15-CONTEXT.md` — Zustand store patterns, sessionStorage approach
- `.planning/phases/14-accessibility-visual/14-CONTEXT.md` — Animation duration baseline (300ms)
- `.planning/phases/13-accessibility-motion/13-CONTEXT.md` — Animation standards
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color #d4af37, designTokens

### Existing Code
- `src/stores/galleryStore.ts` — Zustand store pattern with sessionStorage persistence (safeSessionStorage wrapper)
- `src/utils/download.ts` — Existing download utilities (downloadFile, downloadWithProgress)
- `src/components/gallery/PhotoGrid.tsx` — Gallery grid component to extend with selection
- `src/components/gallery/VirtualizedPhotoGrid.tsx` — Virtualized gallery for performance
- `src/tokens/designTokens.ts` — Color scale and CSS variables

### Library Reference
- `/stuk/jszip` — JSZip for client-side zip generation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `galleryStore.ts` — Zustand store with persist middleware and safeSessionStorage wrapper (D-01 pattern)
- `download.ts` — downloadFile and downloadWithProgress utilities already exist
- `PhotoGrid.tsx` — Gallery grid component that can be extended with checkboxes
- `VirtualizedPhotoGrid.tsx` — Virtualized grid for handling large galleries (200+ photos)

### Established Patterns
- Zustand stores for state management with sessionStorage persistence
- Framer Motion for animations
- Design tokens via CSS variables
- Gold accent color for interactive elements

### Integration Points
- New `downloadStore` (Zustand) — separate from galleryStore to keep concerns clean
- Gallery grid header — checkbox column for desktop selection toggle
- FAB positioning — bottom-right with z-index above gallery content
- sessionStorage for queue persistence (same pattern as galleryStore)

</code_context>

<specifics>
## Specific Ideas

- Use existing download.ts utilities for single-file downloads
- FAB should feel like a natural extension of the lightbox toolbar (from Phase 16)
- Queue panel animation: slide up from FAB position
- Progress indicator should be visible and reassuring — "Preparing your download..."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 17-download-management*
*Context gathered: 2026-04-30*