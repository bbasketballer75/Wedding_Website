# Phase 2: Gallery Performance & UX - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Gallery feels fast and responsive with proper state management and progressive loading. Phase delivers: centralized Zustand store with sessionStorage cache, unified photo type from supabase.ts, blur hash LQIP placeholders, and lightbox with aggressive prefetch and shared Zustand state.
</domain>

<decisions>
## Implementation Decisions

### Caching Strategy (GALLERY-01)
- **D-01:** Gallery cache uses sessionStorage persistence — survives page refresh, requires state hydration on mount

### LQIP Approach (GALLERY-03)
- **D-02:** Blur hash placeholders — server generates blur placeholder, best visual quality, highest implementation effort

### Lightbox Prefetching (GALLERY-04)
- **D-03:** Aggressive prefetching — prefetch both next AND previous images while viewing for smooth navigation

### Type Consolidation (GALLERY-02)
- **D-04:** supabase.ts Photo type is canonical — types/index.ts GalleryImage wraps it at display boundary. Planner should resolve which approach aligns with existing patterns.

### Claude's Discretion
- Exact blur hash implementation strategy (client-side fallback if server doesn't provide)
- sessionStorage hydration timing and error handling
- Specific LRU cache size limits if sessionStorage proves insufficient
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website overhaul goals
- `.planning/REQUIREMENTS.md` — GALLERY-01 to 04 requirements
- `.planning/ROADMAP.md` — Phase 2 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions (auth queue, error boundaries, lightbox polish)

### Codebase
- `src/stores/galleryStore.ts` — Existing gallery store to enhance with caching
- `src/lib/supabase.ts` — Photo type definition (canonical DB type)
- `src/types/index.ts` — GalleryImage type definition (display wrapper)
- `src/components/photo-viewer/PhotoLightbox.tsx` — Lightbox component to enhance with prefetch
- `src/components/gallery/components/MasonryGrid.tsx` — Gallery grid using images
- `src/components/gallery/components/PhotoItem.tsx` — Individual photo rendering
- `src/pages/Gallery.tsx` — Gallery page using galleryStore

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- galleryStore.ts: Already has Zustand store with images, filters, pagination, modal state
- PhotoLightbox.tsx: Existing lightbox with keyboard nav (from Phase 1)
- MasonryGrid.tsx: Photo grid layout component
- PhotoItem.tsx: Individual photo rendering with src/alt/caption

### Established Patterns
- Zustand stores with devtools + subscribeWithSelector middleware
- sessionStorage for state persistence (uiStore theme preferences)
- Supabase typed queries returning database types

### Integration Points
- galleryStore → Gallery.tsx page (data flow)
- galleryStore → MasonryGrid/PhotoItem (render)
- galleryStore → PhotoLightbox (modal state via openImageModal/closeImageModal)
- supabase.ts → galleryStore (fetched data)
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
*Phase: 02-gallery-performance*
*Context gathered: 2026-04-24*
