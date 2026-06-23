# Phase 1: Foundation & Polish - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate white screens, stabilize auth, remove debug code, improve lightbox and transitions. Phase delivers: error boundaries on admin pages, decomposed MediaReviewPanel, fixed auth race conditions, console.* replaced with logger, polished lightbox with keyboard nav, consistent page transitions.
</domain>

<decisions>
## Implementation Decisions

### Error Handling (POLISH-01, POLISH-02, ADMIN-01)
- **D-01:** Admin error boundaries show friendly message + retry button — clear error UI, doesn't crash page, recoverable

### Console Replacement (POLISH-05)
- **D-02:** Replace all console.* in production build globally — esbuild drop console, not component-by-component

### Auth Race Conditions (ADMIN-03)
- **D-03:** Queue auth operations — only one auth operation runs at a time, prevents initializeAuth/refreshSession conflicts

### MediaReviewPanel Decomposition (ADMIN-02)
- **D-04:** Decompose into: BatchList, FaceReviewGrid, ClusterMergeModal, FaceTaggingConfirmation, ReviewImportManifest

### Lightbox Polish (POLISH-03)
- **D-05:** Arrow keys to navigate, ESC to close, visible close button — standard lightbox behavior

### Page Transitions (POLISH-06)
- **D-06:** Consistent Framer Motion animations across all routes — existing PageTransition wrapper maintained

### Hamburger Menu (POLISH-04)
- **D-07:** Mobile nav works on all pages with smooth transitions

### Supabase Client (ADMIN-04)
- **D-08:** Single Supabase client instance — consolidate duplicate instances in src/lib/supabase.ts

### Claude's Discretion
- Fine-grained component extraction strategy for MediaReviewPanel — planner decides exact split points
- Specific logger utility implementation — existing src/utils/logger.ts or new service
</decisions>

<canonical_refs>
## Canonical References

### Project
- `.planning/PROJECT.md` — Wedding website overhaul goals
- `.planning/REQUIREMENTS.md` — POLISH-01 to 06, ADMIN-01 to 04 requirements

### Codebase
- `src/components/error/ErrorBoundary.tsx` — Existing error boundary pattern
- `src/stores/authStore.ts` — Auth state to fix (race conditions)
- `src/lib/supabase.ts` — Duplicate client instances to consolidate
- `src/components/admin/MediaReviewPanel.tsx` — 900+ line component to decompose
- `src/utils/logger.ts` — Existing logger utility to use
- `src/App.tsx` — PageTransition wrapper for animations

### Research
- `.planning/research/PITFALLS.md` — Phase 1 mapped pitfalls (auth race, console errors, admin complexity)
- `.planning/research/ARCHITECTURE.md` — MediaReviewPanel decomposition patterns
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- ErrorBoundary.tsx: Wrap admin pages with same pattern as public routes
- PageTransition in App.tsx: Already wraps pages with Framer Motion
- logger.ts: Exists, use for console replacement

### Established Patterns
- Zustand stores with devtools middleware
- Route-level error boundaries via RouteErrorBoundary
- Framer Motion for animations (PageTransition already in use)

### Integration Points
- Admin routes in App.tsx — need error boundaries
- AuthStore actions — need queue wrapper
- supabase.ts — single export
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
*Phase: 01-foundation-polish*
*Context gathered: 2026-04-23*
