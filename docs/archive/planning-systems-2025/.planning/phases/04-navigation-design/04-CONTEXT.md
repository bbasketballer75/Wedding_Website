# Phase 4: Navigation & Design Consistency - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Navigation feels complete and intuitive with cohesive gold theme throughout. Phase delivers: gold-bordered active nav state, consistent gold-500 (#c9a05c) theme across all interactive elements, and page-level skeleton screens on all public pages (Gallery, Upload, Guestbook, Film, Home). Lenis smooth scroll is already wired.

</domain>

<decisions>
## Implementation Decisions

### Active Navigation State (NAV-01)
- **D-01:** Active nav state uses gold border + transparent background, text in gold-700 — replaces current dark gradient pill

### Gold Theme (NAV-02)
- **D-02:** Keep #c9a05c (gold-500) as primary gold. Spec's #d4af37 noted but #c9a05c is the working implementation. "Timeless, not trendy" aesthetic — muted bronze-gold stays.

### Skeleton Screens (NAV-03)
- **D-03:** Page-level skeletons on all public pages (Gallery, Upload, Guestbook, Film, Home). Each page shows skeleton outline while data loads. Reuses existing Skeleton components (PhotoSkeleton, GallerySkeleton, TextSkeleton, CardSkeleton, ListSkeleton).

### Smooth Scroll (NAV-03)
- **D-04:** Lenis already wired in Layout.tsx (duration: 1.4, easing, gestureOrientation: vertical, smoothWheel: true) — NAV-03 smooth scroll requirement already satisfied.

### Claude's Discretion
- Exact implementation of gold border active state (CSS class structure, whether to reuse existing HeaderLink component or create variant)
- Which skeleton variants to use per page (e.g., Gallery uses GallerySkeleton, Guestbook uses ListSkeleton)
- Whether Home page needs different skeleton pattern based on content structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website overhaul goals
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02, NAV-03 requirements
- `.planning/ROADMAP.md` — Phase 4 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions (Framer Motion animations, error boundaries)
- `.planning/phases/02-gallery-performance/02-CONTEXT.md` — Phase 2 decisions (Zustand stores, sessionStorage caching)
- `.planning/phases/03-upload-experience/03-CONTEXT.md` — Phase 3 decisions (XHR progress tracking, error enum pattern)

### Codebase
- `src/components/layout/Header.tsx` — Navigation to modify (active state styling)
- `src/components/layout/publicNav.ts` — Nav link definitions
- `src/components/layout/Layout.tsx` — Lenis smooth scroll (already complete)
- `src/components/ui/Skeleton.tsx` — Existing skeleton components to reuse
- `src/components/ui/PageLoader.tsx` — Current route-level loader (spinner, not skeleton)
- `src/pages/Gallery.tsx` — Page needing skeleton
- `src/pages/Upload.tsx` — Page needing skeleton
- `src/pages/Guestbook.tsx` — Page needing skeleton
- `src/pages/Film.tsx` — Page needing skeleton
- `src/pages/Home.tsx` — Page needing skeleton

</canonical_refs>

<codebase_context>
## Existing Code Insights

### Reusable Assets
- Skeleton.tsx: PhotoSkeleton, GallerySkeleton, TextSkeleton, CardSkeleton, ListSkeleton — all ready to use
- Layout.tsx: Lenis already initialized — no work needed for smooth scroll
- PageLoader.tsx: Route-level Suspense fallback, currently spinner-only — could be enhanced or replaced per-page

### Established Patterns
- Framer Motion for animations (PageTransition wrapper in App.tsx)
- Tailwind CSS with gold color tokens (gold-50 through gold-900)
- Transparent backgrounds with gold borders for hover states

### Integration Points
- Header → pages via React Router (isActive checks location.pathname)
- Skeleton components → pages as Suspense fallback or inline loading state
- Layout wraps all pages — skeleton addition per-page

</codebase_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches for implementation.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---
*Phase: 04-navigation-design*
*Context gathered: 2026-04-24*