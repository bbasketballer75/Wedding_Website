# Milestones

## v3.0 Guest Experience Enhancements — 2026-05-01

**Status:** ✅ SHIPPED 2026-05-01
**Phases:** 5 (15-19) | **Plans:** 8 | **Tasks:** ~30
**Files:** 12 files changed, +1348/-47
**Git range:** Phase 15 → Phase 19 commits
**Timeline:** 2 days (2026-04-30 to 2026-05-01)

### Key Accomplishments

1. Activity Feed at /activity with Supabase Realtime updates and filter toggles
2. Lightbox pinch-to-zoom (1x-3x), double-tap toggle, zoom-aware swipe, EXIF display
3. Multi-select download queue with sessionStorage persistence and batch download
4. Email-based photo claiming with magic link and 6-digit code verification
5. Guest shared album links at /guest/:token and Order Prints button to Shutterfly

### Known Deferred Items

- SC-02 (face cluster claiming) — deferred to post-launch; email claiming (SC-01) is functional

### Requirements Coverage

All 13 v3.0 requirements mapped. 12/13 complete. SC-02 explicitly deferred.

---

## v2.0 UI/UX Polish Round 2 — 2026-04-30

**Shipped:** 2026-04-30
**Phases:** 5 (10-14) | **Plans:** 14 | **Tasks:** ~28
**Files:** 85 changed, +6820/-404
**Git range:** Phase 10 → Phase 14 commits
**Timeline:** 2 days

### Key Accomplishments

1. Fixed invalid Tailwind classes — `z-100` → `z-50`, `bg-(--color-gold)` → `bg-[var(--color-gold)]`
2. Design token unification — All hardcoded hex values replaced with design token references
3. Component consolidation — Duplicate LoadingSpinner removed, DarkModeToggle uses gold tokens
4. Accessibility — CustomCursor respects `prefers-reduced-motion`, aria-labels on interactive elements
5. Visual polish — Border radius standardized to `rounded-xl`, animation durations at 300ms
6. Focus ring consistency — All focus rings use `focus:ring-(--color-gold)` CSS variable

### Requirements Coverage

All 15 v2.0 requirements (UX-01 through UX-15) validated and complete.

---

## v1.0 MVP — 2026-04-25

**Shipped:** 2026-04-25
**Phases:** 4 | **Plans:** 12 | **Tasks:** ~20
**Git range:** 76c32335 → 504a10e5 (19 commits)
**Timeline:** 2 days

### Key Accomplishments

1. Auth stability — Race condition queue + single Supabase client
2. No white screens — Admin error boundaries on all admin pages
3. MediaReviewPanel — Decomposed from 1716 → 325 lines (5 components)
4. Gallery state — Zustand store with sessionStorage persistence
5. Progressive loading — LQIP blur placeholders, prefetch adjacent images
6. Upload polish — Determinate progress bar, 5 error types, retry capability
7. Navigation polish — Active state with gold border styling
8. Gold theme — Consistent across all interactive elements
9. Skeleton screens — Film and Gallery pages with loading states

### Requirements Coverage

All 18 v1 requirements validated and complete.

---