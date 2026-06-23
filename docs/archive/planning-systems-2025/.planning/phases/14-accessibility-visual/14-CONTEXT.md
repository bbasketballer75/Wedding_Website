# Phase 14: Animation & Visual Polish - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize animation timings and visual properties for a cohesive feel across the wedding site. This phase addresses UX-13 (border radius), UX-14 (animation durations), and UX-15 (color token audit) for the v2.0 UI/UX Polish milestone.

**Specific scope:**
- UX-13: Standardize border radius — pick standard values and apply consistently
- UX-14: Standardize animation durations — establish duration tiers
- UX-15: Comprehensive color token audit — find and fix all color usages not using design tokens

**Out of scope:** New capabilities — only consistency fixes.

</domain>

<decisions>
## Implementation Decisions

### Border Radius (UX-13)
- **D-01:** Two-tier border radius system:
  - Tier 1 (`rounded-xl`) — buttons, inputs, small elements
  - Tier 2 (`rounded-2xl`) — cards, modals, feature panels
- **D-02:** No `rounded-3xl` as a standard tier — use `rounded-2xl` for large decorative containers

### Animation Duration (UX-14)
- **D-03:** Three-tier animation duration system:
  - Micro: 150ms — hover states, button presses
  - Transitions: 300ms — theme toggle, modal open, page transitions
  - Animations: 500ms+ — complex entrance/exit animations
- **D-04:** DarkModeToggle stays at `duration: 0.3` (300ms) per Phase 13 — already correct

### Color Token Audit (UX-15)
- **D-05:** Comprehensive sweep scope — find and fix every color usage that doesn't use design tokens correctly
- **D-06:** Audit includes hardcoded hex values, incorrect CSS variable references, and places where tokens exist but aren't being used

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UX-13, UX-14, UX-15 specifics

### Prior Context
- `.planning/phases/13-accessibility-motion/13-CONTEXT.md` — Animation baseline durations (150ms micro, 300ms transitions, 500ms animations)
- `.planning/phases/13-accessibility-motion/13-UI-SPEC.md` — UI-SPEC design contract with gold focus ring pattern
- `.planning/phases/12-component-consolidation/12-CONTEXT.md` — DarkModeToggle gold focus ring pattern established
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color #d4af37, designTokens alignment
- `.planning/ROADMAP.md` — Phase 14 goal and success criteria

### Components
- `src/tokens/designTokens.ts` — Gold color definitions (target for token audit)
- `src/index.css` — Where global CSS and Tailwind theme integration lives
- `src/components/ui/DarkModeToggle.tsx` — Already correct animation duration (300ms)

### Codebase
- `src/themes/index.ts` — CSS variable mappings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `designTokens.ts` — Gold color scale, established design token definitions
- `DarkModeToggle.tsx` — Reference for correct animation duration pattern

### Established Patterns
- `focus:ring-(--color-gold)` — established focus ring pattern from Phase 12
- Gold brand color: `#d4af37` via `--color-gold-500` CSS variable
- Framer Motion for animations (CustomCursor, DarkModeToggle)

### Animation Duration Baseline (from Phase 13 UI-SPEC.md)
| Type | Duration | Usage |
|------|----------|-------|
| Micro-interactions | 150ms | Hover states, button presses |
| Transitions | 300ms | Theme toggle, modal open, page transitions |
| Animations | 500ms+ | Complex entrance/exit animations |

### Integration Points
- Components scattered across: gallery, admin, sections, layout components
- CSS variables defined in `src/index.css` via Tailwind v4

</code_context>

<specifics>
## Specific Ideas

- **Border radius audit:** Find all `rounded-*` classes across components. Assign to tier 1 or tier 2 based on element type.
- **Animation audit:** Find all `duration:` values across Framer Motion transitions. Standardize to the three tiers.
- **Color token sweep:** Grep for hardcoded hex values (`#[0-9a-fA-F]{3,6}`) that should use CSS variables. Also check for incorrect `gold-*` references that should use `(--color-gold-*)`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 14-accessibility-visual*
*Context gathered: 2026-04-28*
