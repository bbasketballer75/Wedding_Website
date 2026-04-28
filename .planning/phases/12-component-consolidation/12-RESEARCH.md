# Phase 12: Component Consolidation - Research

**Researched:** 2026-04-28
**Domain:** React component deduplication and design token compliance
**Confidence:** HIGH

## Summary

Phase 12 addresses two UX requirements: consolidating duplicate LoadingSpinner implementations and verifying DarkModeToggle's gold token usage. Investigation reveals three LoadingSpinner locations but only two are actual implementations (the third is an inline fallback in LazyLoad). DarkModeToggle already correctly uses gold tokens for accent states while keeping structural grays. No other duplicate components were discovered that would warrant inclusion in this phase.

**Primary recommendation:** Execute UX-07 as planned (remove `src/components/layout/LoadingSpinner.tsx`). UX-08 is already correctly implemented - confirm and close.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**LoadingSpinner Deduplication (UX-07):**
- Keep `src/components/ui/LoadingSpinner.tsx` as canonical (165 lines, more fully featured with size/color props)
- Remove `src/components/layout/LoadingSpinner.tsx` (72 lines, simpler)
- Leave `src/components/ui/LazyLoad.tsx` inline LoadingSpinner as-is (appropriate for fallback use case)

**DarkModeToggle Gold Token Migration (UX-08):**
- Keep gray for structural elements (backgrounds, borders, containers)
- Use gold for accent/selection states only:
  - Active selection indicator: `text-(--color-gold)` (already in place)
  - Hover/focus rings: `focus:ring-(--color-gold)` (already in place)

### Claude's Discretion
- Verify actual import usage before deletion
- Confirm DarkModeToggle token usage matches specification

### Deferred Ideas
None — discussion stayed within phase scope.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-07 | Remove duplicate LoadingSpinner implementation | Found 2 implementations; canonical version identified |
| UX-08 | Update DarkModeToggle to use gold tokens for accents | Already correctly implemented per code inspection |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LoadingSpinner deduplication | Frontend / Client | — | React component consolidation only |
| DarkModeToggle token verification | Frontend / Client | — | CSS token usage verification |

---

## Standard Stack

No new libraries required. This is a component consolidation and token verification task within existing React 19 + Tailwind v4 project.

---

## Investigation Findings

### 1. LoadingSpinner Usages

**File locations:**
| File | Lines | Type | Status |
|------|-------|------|--------|
| `src/components/ui/LoadingSpinner.tsx` | 165 | Full implementation | KEEP (canonical) |
| `src/components/layout/LoadingSpinner.tsx` | 72 | Simplified implementation | REMOVE |
| `src/components/ui/LazyLoad.tsx` | 9-23 | Inline fallback component | LEAVE AS-IS |

**Import audit:** No files in `src/` import either LoadingSpinner via named import. Both component files are self-contained with no downstream consumers (verified via `grep -r "import.*LoadingSpinner" src/`).

**`src/components/ui/LoadingSpinner.tsx` exports:**
- `LoadingSpinner` (default) — props: `size` ('sm'|'md'|'lg'|'xl'), `color` ('primary'|'secondary'|'white'|'current'), `className`, `label`
- `LoadingOverlay` — full-screen loading overlay with children
- `PageLoading` — standalone page-level loading state
- `LoadingButton` — button with loading state

**`src/components/layout/LoadingSpinner.tsx` exports:**
- `LoadingSpinner` (default) — props: `size` ('sm'|'md'|'lg'), `variant` ('spinner'|'skeleton'), `text`, `skeletonType` ('card'|'list'|'gallery'|'text')
- Uses inline styles with CSS animation, references `colors.gold[500]` from designTokens

### 2. DarkModeToggle Token Usage

**File:** `src/components/ui/DarkModeToggle.tsx`

**Current gold token usage (correct):**
- Line 71: `focus:ring-(--color-gold)` — focus ring for the toggle button
- Line 147: `text-(--color-gold)` — active theme selection indicator in dropdown

**Structural grays (appropriate):**
- Line 49: `bg-gray-200 dark:bg-gray-700` — mount guard placeholder
- Line 71: `bg-gray-100 dark:bg-gray-800` — toggle button background
- Line 79: `text-gray-700 dark:text-gray-300` — icon color
- Line 86: `bg-gray-900 dark:bg-gray-100` — tooltip background
- Line 108: `bg-gray-100 dark:bg-gray-800` — dropdown trigger background
- Line 118: `text-gray-700 dark:text-gray-300` — label text
- Line 137: `border-gray-200 dark:border-gray-700` — dropdown border

**Finding:** DarkModeToggle already implements the correct pattern. Gold tokens are used for active/selection states while structural grays are used for neutral container elements. **UX-08 is already correctly implemented** — no changes required.

### 3. Related Component Patterns

**No additional duplicate components found.** Search for similar component pairs did not reveal other duplicate implementations requiring consolidation in this phase.

### 4. Component Deprecation Patterns

**Established pattern from CONVENTIONS.md:**
- Barrel files at `src/components/ui/index.ts` and `src/components/layout/index.ts` export named components
- Named exports preferred over default exports for components
- Direct file imports via `@/` alias (e.g., `@/components/ui/LoadingSpinner`)

**For removal:**
1. Delete the duplicate file
2. No barrel file updates needed (neither spinner is exported from index files)
3. No import redirects needed (no consumers found)

---

## Don't Hand-Roll

Not applicable — this is consolidation, not new functionality.

---

## Common Pitfalls

### Pitfall 1: Deleting components with hidden consumers
**What goes wrong:** Removing a component that is imported by files not found in initial search (dynamic imports, optional code paths).
**How to avoid:** Verified via exhaustive grep across entire `src/` directory. Found zero imports of either spinner.
**Warning signs:** N/A — confirmed zero imports.

### Pitfall 2: Forgetting inline component definitions
**What goes wrong:** Removing a standalone component but missing an inline definition of similar functionality.
**How to avoid:** Confirmed LazyLoad.tsx inline spinner is appropriate as fallback pattern, per CONTEXT decision to leave as-is.
**Warning signs:** N/A — intentional leave-as-is decision.

---

## Code Examples

### LoadingSpinner canonical version (to keep)
```typescript
// src/components/ui/LoadingSpinner.tsx
// Full-featured with size/color props, Framer Motion animation
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'current'
  className?: string
  label?: string
}
```

### LoadingSpinner duplicate version (to remove)
```typescript
// src/components/layout/LoadingSpinner.tsx
// Simpler, uses inline styles, references designTokens.colors directly
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'spinner' | 'skeleton'
  text?: string
  skeletonType?: 'card' | 'list' | 'gallery' | 'text'
}
```

### DarkModeToggle gold token pattern (already correct)
```tsx
// src/components/ui/DarkModeToggle.tsx:71
<button
  onClick={handleCycleTheme}
  className='... focus:ring-2 focus:ring-offset-2 focus:ring-(--color-gold)' // Gold focus ring
>
```

```tsx
// src/components/ui/DarkModeToggle.tsx:147
{theme === value
  ? 'bg-gray-100 dark:bg-gray-700 text-(--color-gold)' // Gold active indicator
  : 'text-gray-700 dark:text-gray-300'
}
```

---

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No dynamic imports of layout/LoadingSpinner | Investigation | LOW — exhaustive grep confirms zero imports |
| A2 | LazyLoad inline spinner should remain | UX-07 decision | LOW — explicit in CONTEXT.md |

**If this table is empty:** All claims were verified via grep, code inspection, or cited from official sources.

---

## Open Questions

1. **Should the removed LoadingSpinner be preserved in a deprecated folder?**
   - What we know: No consumers exist, it's fully superseded by the ui version
   - What's unclear: Project conventions for deprecated component archival
   - Recommendation: Delete outright — no consumers, clean removal

2. **Does UX-08 require any action?**
   - What we know: DarkModeToggle already uses gold tokens correctly per CONTEXT decision
   - What's unclear: Whether verification-only constitutes "completing" the requirement
   - Recommendation: Mark UX-08 as verified/implemented as-is

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — purely file deletion and verification task)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|---------------|
| UX-07 | Duplicate LoadingSpinner removed | Smoke/verify | Manual file existence check | N/A |
| UX-08 | DarkModeToggle uses gold tokens | Manual review | Code inspection | N/A |

### Sampling Rate
- **Per task commit:** N/A (no automated tests for this phase)
- **Per wave merge:** N/A
- **Phase gate:** Verify both requirements addressed

### Wave 0 Gaps
None — this is a cleanup phase, no new test infrastructure needed.

---

## Security Domain

Not applicable — component deduplication and CSS token verification does not involve security-relevant changes.

---

## Sources

### Primary (HIGH confidence)
- `src/components/ui/LoadingSpinner.tsx` — inspected 2026-04-28
- `src/components/layout/LoadingSpinner.tsx` — inspected 2026-04-28
- `src/components/ui/DarkModeToggle.tsx` — inspected 2026-04-28
- `src/components/ui/LazyLoad.tsx` — inspected 2026-04-28

### Secondary (MEDIUM confidence)
- `.planning/phases/12-component-consolidation/12-CONTEXT.md` — user decisions
- `.planning/requirements.md` — UX-07, UX-08 requirements

### Tertiary (LOW confidence)
- N/A

---

## Metadata

**Confidence breakdown:**
- LoadingSpinner usage investigation: HIGH — exhaustive grep confirmed zero imports
- DarkModeToggle token verification: HIGH — code inspection confirms correct implementation
- Duplicate component audit: HIGH — searched entire src/ directory

**Research date:** 2026-04-28
**Valid until:** 30 days (stable — simple deletion task)