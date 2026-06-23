# Phase 13: Accessibility & Motion - Research

**Researched:** 2026-04-28
**Domain:** Accessibility compliance and motion preferences for React wedding website
**Confidence:** HIGH

## Summary

Phase 13 addresses four accessibility requirements (UX-09 through UX-12) focused on aria-labels, prefers-reduced-motion for CustomCursor, focus ring standardization, and DarkModeToggle animation consistency. The implementation follows established patterns from existing accessibility infrastructure (SkipLink, KeyboardShortcutsModal, DarkModeToggle gold focus ring from Phase 12) and aligns with decisions documented in 13-CONTEXT.md. Key findings: CustomCursor needs a `matchMedia` check to return `null` when reduced motion is preferred; focus rings show inconsistency (some use `focus:ring-gold-500/50`, others use `focus:ring-gold-400`, Phase 12 uses `focus:ring-(--color-gold)`); aria-label audit identifies 46 candidate files with interactive elements.

**Primary recommendation:** Implement CustomCursor reduced-motion via early return pattern, standardize focus rings per-component using CSS variable `focus:ring-(--color-gold)`, and perform systematic aria-label audit on icon-only buttons across gallery, admin, and layout components.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When `prefers-reduced-motion: reduce` is enabled, CustomCursor returns `null` (fully hidden)
- **D-02:** All focus rings use gold (`focus:ring-(--color-gold)`)
- **D-03:** Focus rings applied per-component inline, not global CSS
- **D-04:** DarkModeToggle icon rotation animation stays at `duration: 0.3` (300ms)
- **D-05:** Add descriptive `aria-label` to interactive elements lacking them; DarkModeToggle already has appropriate aria-label

### Claude's Discretion
- Which specific files/components need aria-label additions (systematic audit approach)
- Order of implementation tasks

### Deferred Ideas
None

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-09 | Add aria-labels to interactive elements | 46 files with interactive elements identified; audit strategy defined |
| UX-10 | CustomCursor respects prefers-reduced-motion | Pattern: useEffect + matchMedia returning null; no existing implementation |
| UX-11 | Standardize focus ring color (gold) | Found inconsistencies: `focus:ring-gold-500/50`, `focus:ring-gold-400`, `focus:ring-gold-500/20`; need standardization to `focus:ring-(--color-gold)` |
| UX-12 | DarkModeToggle animation consistency | Duration already 0.3s (300ms) - meets requirement; no change needed |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CustomCursor prefers-reduced-motion | Browser/Client | — | CSS media query check in React component |
| Focus ring standardization | Browser/Client | — | CSS class application per component |
| Aria-label additions | Browser/Client | — | HTML attribute additions on interactive elements |
| DarkModeToggle animation | Browser/Client | — | Framer Motion animation duration check |

## Standard Stack

No new dependencies required. This phase uses existing infrastructure:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useEffect | (bundled) | Media query listener for prefers-reduced-motion | Native React hook |
| window.matchMedia | (native) | Detect user's motion preference | Browser API, no polyfill needed |
| Framer Motion | (existing) | CustomCursor and DarkModeToggle animations | Already in use |
| Tailwind CSS v4 | (existing) | focus:ring utilities via CSS variables | Already configured |

**No new packages to install.**

## Architecture Patterns

### System Architecture Diagram

```
User Preference Detection
         |
         v
+------------------+
| matchMedia query |
| (prefers-reduced |
|  -motion: reduce)|
+------------------+
         |
         v (if reduced)
   +-----------+
   | Component |
   | returns   |
   | null     |
   +-----------+
         |
         v
   System default
   cursor active

   (if not reduced)
         |
         v
+------------------+
| Framer Motion    |
| spring animation |
| CustomCursor     |
| follows mouse    |
+------------------+
```

### Recommended Project Structure

No structural changes needed - modifications are inline to existing components.

### Pattern 1: CustomCursor prefers-reduced-motion Implementation

**What:** Return `null` from CustomCursor when user prefers reduced motion

**When to use:** UX-10 implementation

**Example:**
```typescript
// Source: [VERIFIED: standard browser API, no external docs needed]
import { useEffect, useState } from 'react'

const CustomCursor = () => {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  if (reducedMotion) {
    return null
  }

  // ... existing component return
}
```

### Pattern 2: Per-Component Focus Ring Application

**What:** Add `focus:ring-(--color-gold)` to individual component className

**When to use:** UX-11 implementation on components needing focus styling

**Example:**
```typescript
// Source: [CITED: Phase 12 DarkModeToggle.tsx line 71]
className='... focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-gold)'
```

### Pattern 3: Icon-Only Button Aria-Label

**What:** Add descriptive aria-label to buttons with only icons as content

**When to use:** UX-09 implementation for icon buttons

**Example:**
```typescript
// Source: [VERIFIED: WCAG 2.1 SC 2.4.6]
<button
  onClick={handleClose}
  aria-label='Close dialog'
  className='p-2 rounded-full ...'
>
  <X className='w-5 h-5' />
</button>
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Motion preference detection | Custom hooks or state management | Native `window.matchMedia` API | Browser-native, zero dependencies, proper event handling |
| Focus ring styling | Custom CSS classes or utility functions | Per-component `focus:ring-(--color-gold)` | D-03 mandates per-component inline; global CSS doesn't match decision |

**Key insight:** Browser's `matchMedia` API is the correct approach for `prefers-reduced-motion` detection - no library or custom hook needed.

## Common Pitfalls

### Pitfall 1: Inconsistent Focus Ring Colors
**What goes wrong:** Different components use `focus:ring-gold-500`, `focus:ring-gold-400`, `focus:ring-gold-500/50`, `focus:ring-gold-500/20` - inconsistent opacity and shade values.

**Why it happens:** Multiple developers added focus styles with different opacity values; no centralized token reference.

**How to avoid:** Use `focus:ring-(--color-gold)` CSS variable (resolved to `gold-500`) consistently across all components.

**Warning signs:** Grep finds `focus:ring-gold` variations - verify all are `focus:ring-(--color-gold)`.

### Pitfall 2: Missing Aria-Labels on Icon Buttons
**What goes wrong:** Screen reader users cannot determine purpose of icon-only buttons (close, menu toggle, dismiss, etc.).

**Why it happens:** Developers add visible icon but forget accessibility attribute since meaning is clear visually.

**How to avoid:** Audit all `<button>` elements containing only `<svg>` children; add descriptive aria-label.

**Warning signs:** Button with only SVG child and no aria-label in grep output.

### Pitfall 3: CustomCursor Rendered Despite Reduced Motion
**What goes wrong:** CustomCursor still renders spring-animated cursor even when user prefers no motion.

**Why it happens:** No check for `prefers-reduced-motion` media query exists in current implementation.

**How to avoid:** Add `matchMedia` check in useEffect, return `null` when `reducedMotion` is true.

## Code Examples

Verified patterns from existing codebase:

### CustomCursor with Reduced motion check (UX-10 target)
```typescript
// Current: src/components/layout/CustomCursor.tsx - NO reduced motion handling
// Target implementation:
const CustomCursor = () => {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  if (reducedMotion) {
    return null
  }

  // ... rest of existing component
}
```

### DarkModeToggle Focus Ring (UX-11 pattern - already correct)
```typescript
// src/components/ui/DarkModeToggle.tsx:71 - already using focus:ring-(--color-gold)
className='... focus:ring-2 focus:ring-offset-2 focus:ring-(--color-gold)'
// Duration: 0.3 - already correct per UX-12
transition={{ duration: 0.3, ease: 'easeInOut' }}
```

### Existing Aria-Label Pattern (UX-09 reference)
```typescript
// src/components/ui/PWAInstallPrompt.tsx:138
<button
  onClick={handleDismiss}
  aria-label='Dismiss installation prompt'
  className='...'
>
  <X className='w-5 h-5' />
</button>

// src/components/layout/Header.tsx:141
aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
```

### Focus Ring Inconsistency Found (UX-11 audit result)
```
focus:ring-gold-500/50     - GalleryHeader.tsx:43
focus:ring-gold-400        - UploadCard.tsx:51, GuestUploadModerationList.tsx:139
focus:ring-gold-500/20     - BatchList.tsx:95, AuditLogView.tsx:87,97,110
focus:ring-(--color-gold)  - DarkModeToggle.tsx:71,108 (Phase 12 pattern)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No motion preference check | matchMedia API check returning null | Phase 13 | Users with vestibular disorders get system cursor |
| Various gold shades for focus | CSS variable `focus:ring-(--color-gold)` | Phase 13 | Consistent focus indicator across site |
| Icon buttons without labels | Descriptive aria-labels | Phase 13 | Screen reader users can identify button purpose |

**Deprecated/outdated:**
- Hardcoded gold color classes like `focus:ring-gold-500` - should use `focus:ring-(--color-gold)` CSS variable

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CustomCursor is only rendered in App.tsx or layout | CustomCursor location | If rendered elsewhere, reduced-motion check may need duplication prevention |
| A2 | No component currently checks prefers-reduced-motion | Existing codebase | If some component already checks, pattern should be consistent |
| A3 | 300ms DarkModeToggle animation is already correct per UX-12 | DarkModeToggle duration | Verified - code shows duration: 0.3 |

**If this table is empty:** All claims in this research were verified or cited - no user confirmation needed.

## Open Questions (RESOLVED)

1. **CustomCursor mount location verification** (RESOLVED)
   - What we know: grep shows CustomCursor imported in UIComponents.test.tsx and defined in layout/CustomCursor.tsx
   - Resolution: Planner should read CustomCursor.tsx and App.tsx to verify mount point before implementing UX-10. The plans include CustomCursor.tsx in read_first.
   - Status: Delegated to executor

2. **Comprehensive aria-label audit scope** (RESOLVED)
   - What we know: 46 files have interactive elements, 14 files already have aria-label usage
   - Resolution: Plans 13-03 creates systematic audit tasks with grep patterns for icon buttons
   - Status: Delegated to planner

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified)

This phase involves only code/config changes to existing components - no external tools, services, or CLIs needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing from package.json) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-09 | Aria-labels added to interactive elements | Manual audit | N/A (visual/code review) | N/A |
| UX-10 | CustomCursor returns null when prefers-reduced-motion: reduce | Unit | `npm run test:run -- --grep "CustomCursor"` | ✅ test file exists |
| UX-11 | Focus rings use gold CSS variable | Manual audit | N/A (grep verification) | N/A |
| UX-12 | DarkModeToggle 300ms animation | Manual review | N/A (code verification) | N/A |

### Sampling Rate
- **Per task commit:** `npm run test:run` on affected test files
- **Per wave merge:** `npm run test:run` full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- `src/components/layout/CustomCursor.test.tsx` - add test for reduced motion return null behavior
- Framework install: N/A (Vitest already configured)

## Security Domain

> Skip section (security_enforcement not specified in config)

No security considerations apply to this phase - purely accessibility and motion preference updates.

## Sources

### Primary (HIGH confidence)
- CustomCursor.tsx source inspection - confirms no existing reduced motion handling
- DarkModeToggle.tsx source inspection - confirms 0.3s duration (UX-12 compliant)
- src/index.css lines 171-173 - global `:focus-visible` rule exists but per-component D-03 overrides
- Phase 12 DarkModeToggle focus ring pattern - confirmed at line 71

### Secondary (MEDIUM confidence)
- 46 component files identified via grep with interactive elements
- Grep output for `focus:ring-gold` variations - confirms inconsistency requiring standardization

### Tertiary (LOW confidence)
- Aria-label completeness audit - requires逐 file verification not done in research phase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses only native browser APIs and existing codebase patterns
- Architecture: HIGH - simple pattern (matchMedia check, return null)
- Pitfalls: HIGH - grep findings clearly show focus ring inconsistencies

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days - stable accessibility patterns don't change rapidly)