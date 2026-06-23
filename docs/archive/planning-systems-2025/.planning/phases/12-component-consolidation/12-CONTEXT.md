# Phase 12: Component Consolidation - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate duplicate components and fix token usage for UI consistency. This phase addresses two UX requirements (UX-07, UX-08) for the v2.0 UI/UX Polish milestone.

**Specific scope (from UX-07, UX-08):**
- UX-07: Remove duplicate LoadingSpinner implementation — consolidate to one canonical version
- UX-08: Update DarkModeToggle to use gold tokens for accents (not gray tokens)

**Out of scope:** New capabilities — only component consolidation and token fixes.

</domain>

<decisions>
## Implementation Decisions

### LoadingSpinner Deduplication (UX-07)
**Issue:** Three LoadingSpinner implementations exist:
- `src/components/ui/LoadingSpinner.tsx` (165 lines, more fully featured with size/color props)
- `src/components/layout/LoadingSpinner.tsx` (72 lines, simpler)
- `src/components/ui/LazyLoad.tsx` (inline LoadingSpinner used as fallback)

**Decision:** Keep `src/components/ui/LoadingSpinner.tsx` as canonical — it's the most fully featured with size/color props, and located in the standard UI components directory. Remove the duplicate in `src/components/layout/LoadingSpinner.tsx` and redirect imports. The inline one in LazyLoad.tsx is appropriate for its fallback use case and can remain.

### DarkModeToggle Gold Token Migration (UX-08)
**Issue:** DarkModeToggle uses gray tokens for backgrounds, borders, text instead of wedding site's gold theme.

**Decision:** Keep gray for structural elements (backgrounds, borders, containers) — these are functional/neutral. Only use gold for accent/selection states:
- Active selection indicator: `text-(--color-gold)` (already in place)
- Hover/focus rings: `focus:ring-(--color-gold)` (already in place)
- Structural grays (bg-gray-100, text-gray-700, bg-gray-800) remain — appropriate for a structural component

This maintains the wedding site's gold accent theme while keeping DarkModeToggle functionally neutral.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Components
- `src/components/ui/LoadingSpinner.tsx` — Canonical spinner to keep (165 lines, size/color props)
- `src/components/layout/LoadingSpinner.tsx` — Duplicate to remove (72 lines)
- `src/components/ui/LazyLoad.tsx` — Contains inline LoadingSpinner (fallback use — leave as-is)
- `src/components/ui/DarkModeToggle.tsx` — Target for gold token accent fix

### Requirements
- `.planning/REQUIREMENTS.md` — UX-07, UX-08 specifics

### Prior Context
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold token standards (designTokens.ts aligned to #d4af37)
- `.planning/ROADMAP.md` — Phase 12 goal and success criteria

### Codebase
- `.planning/codebase/CONVENTIONS.md` — Import organization, component patterns
- `src/tokens/designTokens.ts` — Gold token definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/LoadingSpinner.tsx` — Full-featured spinner with `size` and `color` props, multiple variants
- `src/components/ui/DarkModeToggle.tsx` — Theme switcher with Sun/Moon/System icons (already uses `focus:ring-(--color-gold)` for focus)

### Established Patterns
- Design tokens use gold scale (gold-100 through gold-900) with brand gold #d4af37
- `focus:ring-(--color-gold)` already used in DarkModeToggle for focus states
- Gray tokens appropriate for structural/functional components (not accent/brand elements)

### Integration Points
- LoadingSpinner used in LazyLoad.tsx as fallback component
- DarkModeToggle uses useUIStore for theme state

</code_context>

<specifics>
## Specific Ideas

- **Which spinner wins:** `src/components/ui/LoadingSpinner.tsx` has more features (size variants, color prop, styled variants) — it's the better canonical choice
- **DarkModeToggle pattern:** The component already uses `text-(--color-gold)` for active state — no structural gray-to-gold change needed, just confirming the pattern is correct

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-component-consolidation*
*Context gathered: 2026-04-28*