# Phase 13: Accessibility & Motion - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve accessibility compliance and respect user motion preferences for the wedding site. This phase addresses four UX requirements (UX-09 through UX-12) for the v2.0 UI/UX Polish milestone.

**Specific scope:**
- UX-09: Add aria-labels to interactive elements that lack them
- UX-10: CustomCursor respects `prefers-reduced-motion` media query
- UX-11: Standardize focus ring color (gold) across all focusable elements
- UX-12: DarkModeToggle animation is consistent with other UI animations

**Out of scope:** New capabilities — only a11y compliance fixes.

</domain>

<decisions>
## Implementation Decisions

### Reduced Motion Behavior (UX-10)
- **D-01:** When `prefers-reduced-motion: reduce` is enabled, CustomCursor is fully hidden — the component returns `null`. Users get the system default cursor with no custom cursor overlay at all. No static fallback, no reduced animation — completely hidden.

### Focus Ring Color (UX-11)
- **D-02:** All focus rings use gold (`focus:ring-(--color-gold)`) throughout the site. Brand-consistent with the wedding site's gold accent theme. Aligns with the existing DarkModeToggle focus ring pattern established in Phase 12.

### Focus Ring Implementation (UX-11)
- **D-03:** Focus rings are applied per-component inline — add `focus:ring-(--color-gold)` to each interactive element that needs it. Not global CSS, not a utility class. Each component explicitly declares its focus ring style.

### DarkModeToggle Animation Duration (UX-12)
- **D-04:** DarkModeToggle icon rotation animation stays at `duration: 0.3` (300ms, easeInOut). This is the transitional feel — the 300ms value is preserved as it provides a more graceful theme transition feel for this component.

### Aria Labels (UX-09)
- **D-05:** Add descriptive `aria-label` attributes to all interactive elements that lack them. This includes icon-only buttons, clickable icons, and any interactive element where the purpose is not already clear from visible text. DarkModeToggle already has appropriate aria-label — no change needed there.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UX-09, UX-10, UX-11, UX-12 specifics

### Prior Context
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color #d4af37, designTokens alignment
- `.planning/phases/12-component-consolidation/12-CONTEXT.md` — DarkModeToggle gold focus ring pattern, focus:ring-(--color-gold)
- `.planning/ROADMAP.md` — Phase 13 goal and success criteria

### Components
- `src/components/layout/CustomCursor.tsx` — Target for prefers-reduced-motion fix (UX-10)
- `src/components/ui/DarkModeToggle.tsx` — Already has aria-label, focus ring, 0.3s animation (UX-11, UX-12)
- `src/index.css` — Where global CSS and Tailwind theme integration lives

### Codebase
- `src/tokens/designTokens.ts` — Gold color definitions
- `src/themes/index.ts` — CSS variable mappings (--color-gold-500 = #d4af37)
- `src/components/accessibility/SkipLink.tsx` — Existing a11y component as reference pattern
- `src/components/accessibility/KeyboardShortcutsModal.tsx` — Existing a11y component as reference pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/accessibility/SkipLink.tsx` — Existing accessibility infrastructure
- `src/components/accessibility/KeyboardShortcutsModal.tsx` — Existing accessibility infrastructure
- `useUIStore` from `src/stores/uiStore.ts` — Theme state used by DarkModeToggle
- `colors.gold` from `designTokens.ts` — Gold color scale for cursor and focus rings

### Established Patterns
- `focus:ring-(--color-gold)` is the established focus ring pattern (Phase 12 DarkModeToggle)
- Gold brand color: `#d4af37` via `--color-gold-500` CSS variable
- Framer Motion is used for animations (CustomCursor, DarkModeToggle)
- `prefers-reduced-motion` check not currently implemented anywhere in the codebase — new pattern to introduce

### Integration Points
- CustomCursor is rendered in `App.tsx` or layout — check where it mounts
- DarkModeToggle in Header — existing component
- Interactive elements scattered across: gallery, admin, sections, layout components
- CSS variables defined in `src/index.css` via Tailwind v4

</code_context>

<specifics>
## Specific Ideas

- **CustomCursor prefers-reduced-motion:** Use a `useEffect` + `window.matchMedia('(prefers-reduced-motion: reduce)')` check. Return `null` from the component when true. No spring animation at all for these users.
- **Aria-label audit:** Use the grep output from codebase scout to find files with interactive elements. Focus on icon-only buttons (GalleryHeader, PhotoItem, Toast actions) and any clickable elements without visible text labels.
- **Focus ring consistency:** The grep showed `focus:ring-gold-500`, `focus:ring-gold-400`, `focus:ring-gold-500/50` — these are not all using the CSS variable. Standardize to `focus:ring-(--color-gold)` everywhere.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 13-accessibility-motion*
*Context gathered: 2026-04-28*
