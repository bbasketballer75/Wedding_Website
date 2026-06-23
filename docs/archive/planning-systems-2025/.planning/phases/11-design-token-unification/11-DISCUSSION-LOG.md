# Phase 11: Design Token Unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 11-design-token-unification
**Areas discussed:** shadow-gold resolution, site-wide hex audit, Avatar gradient, color system conflicts

---

## Area: shadow-gold Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Define shadow-gold in designTokens.ts | Add new token with gold shadow value | |
| Replace with defined token equivalent | Use existing gold tokens + custom shadow | ✓ |
| No action (not found in codebase) | Verify no shadow-gold usage exists | ✓ |

**User's choice:** shadow-gold NOT FOUND in current codebase — no action needed
**Notes:** Avatar.tsx has no shadow-gold usage. The issue may have been in an earlier version or already fixed.

---

## Area: Hardcoded Hex Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix only Footer.tsx and Home sections (per UX-03/04) | Narrow scope as specified in requirements | ✓ |
| Fix all 12 files with #d4af37 | Expand scope to site-wide | |

**User's choice:** Stay within UX-03/UX-04 scope (Footer + Home sections) — don't expand to all 12 files
**Notes:** UX-03 and UX-04 specify Footnote and Home sections. Other files with hardcoded hex are incidental findings — handle naturally during implementation if encountered, but don't expand scope.

---

## Area: Avatar Gradient Standardization

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current gradient (from-gold-100 to-gold-200) | Already consistent, just standardize all usages | ✓ |
| Define new gradient in designTokens.ts | Add explicit gradient token | |

**User's choice:** Keep current gradient — it's already working correctly
**Notes:** Avatar uses `bg-gradient-to-br from-gold-100 to-gold-200 text-gold-800` which produces a soft gold gradient for initials. This is the standard to preserve.

---

## Area: Color System Conflicts

| Option | Description | Selected |
|--------|-------------|----------|
| Align designTokens.ts gold-500 to #d4af37 | Make design tokens match themes/index.ts brand gold | ✓ |
| Keep separate (different purposes) | Accept two gold systems | |

**User's choice:** Align designTokens.ts gold-500 to match themes/index.ts `#d4af37`
**Notes:** The brand gold used throughout the site (80+ files) is `#d4af37`. The current designTokens.ts value `#c9a05c` is not widely referenced. Align to `#d4af37` for consistency.

---

## Canonical References Discovered During Discussion

- `src/themes/index.ts` — Defines `--color-gold-500: '#d4af37'` as the brand gold
- `src/tokens/designTokens.ts` — Currently has gold-500 = '#c9a05c' (to be aligned)
- `src/index.css` — Tailwind v4 theme integration with CSS variables
- 80+ files use `gold-500` color class — this IS the brand gold

---

*Phase: 11-design-token-unification*
*Discussion completed: 2026-04-28*