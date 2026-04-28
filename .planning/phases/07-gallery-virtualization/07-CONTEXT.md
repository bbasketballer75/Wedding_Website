# Phase 7: Gallery Virtualization - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Gallery renders 200+ photos smoothly with only visible items in DOM using @tanstack/react-virtual. Masonry layout preserved via row-based approach. Lightbox opens for any virtualized photo with adjacent photo prefetching.

</domain>

<decisions>
## Implementation Decisions

### Virtualization approach (GAL-01)
- **D-01:** Row-container approach — Group photos into visual rows where each row fills the viewport width. Calculate row composition based on aspect ratios and target row height (~280px). Each row is one virtualized item. Photos within a row use flex layout with consistent row height (cropping may occur for varied aspect ratios within a row).

### Row height measurement
- **D-02:** ResizeObserver + dynamic measurement — hasFixedSize=false on useVirtualizer. Use ResizeObserver on each row container to measure actual rendered height. Store measured heights in a Map for virtualization. On new photo load or resize, re-measure affected rows.

### Lightbox behavior
- **D-03:** Portal to body — Lightbox renders via React Portal to document.body, completely outside the virtualized scroll container. Gallery scroll position is preserved behind the overlay. Use AnimatePresence for smooth open/close transitions.

### Prefetch scope
- **D-04:** Prefetch ±5 photos around current lightbox index (11 total). Load high-res versions for these photos in background. Preloaded photos stored in a Map. When lightbox navigates to a photo already in Map, use cached instead of fetching.

### Masonry column breakpoints
- **D-05:** Preserve current column breakpoints: base: 1, sm: 2, md: 3, lg: 4. When calculating rows, use the current breakpoint's column count to determine how many photos per row. Photos per row may vary at smaller viewports (1-2 columns) vs larger (3-4 columns).

### React-virtual integration
- **D-06:** Use @tanstack/react-virtual. count = estimated total rows (photos.length / photosPerRow approximation). getScrollElement = gallery scroll container ref. estimateSize = use average photo height + gap as starting estimate, override with measured heights from ResizeObserver.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website goals, tech stack (React 19, Supabase, Zustand)
- `.planning/REQUIREMENTS.md` — GAL-01 requirement (virtualization with @tanstack/react-virtual)
- `.planning/ROADMAP.md` — Phase 7 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions
- `.planning/phases/02-gallery-performance/02-CONTEXT.md` — Phase 2 decisions (Zustand, sessionStorage, LQIP)
- `.planning/phases/03-upload-experience/03-CONTEXT.md` — Phase 3 decisions (XHR progress, error handling)
- `.planning/phases/04-navigation-design/04-CONTEXT.md` — Phase 4 decisions (gold theme, animations)
- `.planning/phases/05-social-sharing/05-CONTEXT.md` — Phase 5 decisions
- `.planning/phases/06-guest-reactions-upload-status/06-CONTEXT.md` — Phase 6 decisions

### Codebase
- `src/components/gallery/components/MasonryGrid.tsx` — Current column-fill masonry implementation (to be replaced)
- `src/components/gallery/PhotoGrid.tsx` — PhotoGrid component using MasonryGrid, with MasonryPhotoGrid and StandardGrid variants
- `src/components/photo-viewer/PhotoLightbox.tsx` — Existing lightbox component (needs portal integration)
- `src/pages/Gallery.tsx` — Gallery page with albums and filtering (1391 lines, main gallery container)
- `src/stores/galleryStore.ts` — Zustand store with sessionStorage caching
- `src/hooks/useInfiniteScroll.ts` — Existing infinite scroll hook (reference for scroll patterns)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- PhotoGrid.tsx: PhotoGrid component with MasonryPhotoGrid and StandardGrid variants, PhotoLikeButton, SelectOverlay — needs refactor for virtualization
- PhotoLightbox.tsx: Existing lightbox with shareModalOpen state, prev/next navigation, needs Portal integration
- MasonryGrid.tsx: Current column-fill masonry (column 0 gets items 0,N,2N...) — will be replaced by row-based approach
- galleryStore.ts: Zustand store managing gallery state with sessionStorage — photo array available for virtualization
- Framer Motion: AnimatePresence used for transitions — can reuse for lightbox open/close

### Established Patterns
- Zustand for gallery state management (galleryStore.ts)
- Framer Motion for animations (motion components, AnimatePresence)
- Gold theme accents (#d4af37)
- SessionStorage for caching photo metadata
- Responsive breakpoints via Tailwind (base, sm, md, lg, xl)
- useRef for scroll element tracking

### Integration Points
- Gallery.tsx → PhotoGrid: photos prop, onPhotoClick handler for lightbox open
- PhotoLightbox.tsx → Portal: render to document.body, receives photo index and allPhotos array
- galleryStore: provides photos array and lightbox state (lightboxPhotoIndex, setLightboxPhotoIndex)
- PrefetchMap: new Map<> stored in galleryStore or component state for prefetched photo URLs

</code_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches for implementation.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---
*Phase: 07-gallery-virtualization*
*Context gathered: 2026-04-25*