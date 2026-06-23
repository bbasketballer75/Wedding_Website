# Phase 11: Design Token Unification - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all hardcoded values with design token references for visual consistency across the wedding site. This phase addresses MAJOR issues blocking the site's unified aesthetic.

**Specific scope (from UX-03 through UX-06):**
- UX-03: Replace hardcoded hex in Footer.tsx
- UX-04: Replace hardcoded hex in Home page sections
- UX-05: Define or replace `shadow-gold` token
- UX-06: Standardize Avatar gradient

**Out of scope:** New capabilities — only fixes to existing files.

</domain>

<decisions>
## Implementation Decisions

### Color System Conflicts (D-01)
**Issue:** Two gold color systems exist that don't match:
- `designTokens.ts`: `gold-500 = '#c9a05c'`
- `themes/index.ts`: `--color-gold-500 = '#d4af37'`
- These produce VISUALLY DIFFERENT golds on the same site

**Decision:** Confirm which gold is correct. The themes/index.ts value `#d4af37` appears in 80+ component usages across the site. The designTokens.ts value `#c9a05c` is not widely referenced in components. **Recommended: Align designTokens.ts gold-500 to match themes/index.ts `#d4af37`** (the brand gold used throughout the site).

### Hardcoded Hex Audit Scope (D-02)
**Issue:** Found `#d4af37` in these files (not just Footer/Home):
- `src/components/sections/EngagementSection.css` (3 instances)
- `src/themes/index.ts` (intentional — defines theme variables)
- `src/components/sections/wedding-party/PartyMemberModal.tsx` (SVG stroke)
- `src/components/sections/wedding-party/PersonCard.tsx` (SVG stroke)
- `src/components/timeline/HalloweenEngagement.tsx` (conditional animation color)
- `src/components/timeline/LoveTimeline.tsx`
- `src/components/ui/Button.tsx`
- `src/components/gallery/components/GalleryHeader.tsx`
- `src/components/ui/LoadingSpinner.tsx`

**Decision:** UX-03/04 scope is Footer.tsx and Home sections per REQUIREMENTS.md. The additional files found are incidental — don't expand scope. However, when editing files during this phase, replace hardcoded hex with token if encountered naturally.

### shadow-gold Resolution (D-03)
**Status:** `shadow-gold` NOT FOUND in current codebase (Avatar.tsx has no shadow-gold usage). The issue may have been in an earlier version or the fix is already in place.

**Decision:** No action needed on shadow-gold. If planning finds usages during implementation, use `shadow-[0_4px_12px_rgba(212,175,55,0.25)]` as a defined approach.

### Avatar Gradient Standardization (D-04)
**Current state:** Avatar uses `bg-gradient-to-br from-gold-100 to-gold-200 text-gold-800` for fallback initials. This creates a soft gold gradient.

**Decision:** Keep current gradient (`from-gold-100 to-gold-200`) as the standard — it's already consistent in Avatar.tsx. The issue UX-06 may have been about ensuring all Avatar usages reference the same gradient definition rather than inline overrides.

### Site-Wide Color Consistency (D-05)
**Decision:** When replacing hardcoded values, use the gold token scale from designTokens.ts aligned to `#d4af37`:
- `bg-gold-500` or `text-gold-500` for primary brand gold
- `bg-gold-400` or `text-gold-400` for lighter gold accent
- `bg-gold-600` or `text-gold-600` for darker gold

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/tokens/designTokens.ts` — Primary design token definitions (colors, typography, spacing, component defaults)
- `src/themes/index.ts` — Theme configuration with CSS variable mappings (gold-500 = #d4af37)
- `src/index.css` — Tailwind v4 theme integration, CSS variable definitions

### Existing Components (token usage examples)
- `src/components/ui/Avatar.tsx` — Uses `from-gold-100 to-gold-200` gradient (confirmed pattern)
- `src/components/ui/Button.tsx` — Contains `#d4af37` hardcoded (to be replaced)
- `src/components/layout/Footer.tsx` — Contains hardcoded hex per UX-03 requirement
- `src/components/layout/BackgroundMusic.tsx` — Recently fixed z-index (prior phase)
- `src/components/error/ErrorBoundary.tsx` — Recently fixed gold tokens (prior phase)

### Requirements
- `.planning/REQUIREMENTS.md` — UX-03, UX-04, UX-05, UX-06 specifics

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `designTokens.ts` exports `colors.gold` scale (50-900) — use these instead of hex
- `themes/index.ts` maps design tokens to CSS variables for theme switching

### Established Patterns
- Component color usage: `text-gold-500`, `bg-gold-400`, `border-gold-300`
- Avatar gradient: `from-gold-100 to-gold-200` (confirmed working pattern)
- Gold brand color: `#d4af37` (used in 80+ files — THIS IS THE BRAND GOLD)

### Integration Points
- Footer.tsx, Home page sections — color references
- Avatar.tsx — gradient standardization
- themes/index.ts — must stay in sync with designTokens.ts

</code_context>

<specifics>
## Specific Ideas

- **Brand gold clarification:** `#d4af37` appears throughout the codebase and themes/index.ts. This IS the brand gold. The designTokens.ts value `#c9a05c` appears to be a secondary or alternative gold that isn't actively used.
- **Avatar gradient:** Already consistent — uses Tailwind gold scale, not hardcoded hex.
- **CSS files:** EngagementSection.css uses `#d4af37` — could be replaced with CSS variable referencing gold-500 theme variable.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-design-token-unification*
*Context gathered: 2026-04-28*