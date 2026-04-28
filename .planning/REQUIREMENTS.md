# Requirements: v2.0 UI/UX Polish Round 2

## Categories

- **UX**: UI/UX Consistency (13 requirements)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 10 | Pending |
| UX-02 | Phase 10 | Pending |
| UX-03 | Phase 11 | Pending |
| UX-04 | Phase 11 | Pending |
| UX-05 | Phase 11 | Pending |
| UX-06 | Phase 11 | Pending |
| UX-07 | Phase 12 | Pending |
| UX-08 | Phase 12 | Pending |
| UX-09 | Phase 13 | Pending |
| UX-10 | Phase 13 | Pending |
| UX-11 | Phase 13 | Pending |
| UX-12 | Phase 13 | Pending |
| UX-13 | Phase 14 | Pending |
| UX-14 | Phase 14 | Pending |
| UX-15 | Phase 14 | Pending |

---

## UX: UI/UX Consistency

### UX-01: Fix invalid z-100 in BackgroundMusic.tsx

**Priority**: BLOCKER

**Description**: BackgroundMusic.tsx uses invalid `z-100` Tailwind class. The max z-index value in Tailwind is `z-50`. This causes build warnings and potential styling issues.

**Fix**: Replace `z-100` with appropriate z-index value using valid Tailwind classes (e.g., `z-50`) or define a custom z-index in tailwind config if higher value is needed.

**Files**: src/components/layout/BackgroundMusic.tsx

**Phase**: 10

---

### UX-02: Fix invalid bg-(--color-gold) in ErrorBoundary.tsx

**Priority**: BLOCKER

**Description**: ErrorBoundary.tsx uses invalid `bg-(--color-gold)` CSS var syntax. CSS custom properties cannot be used directly in Tailwind color classes this way - need to use bg-[var(--color-gold)] or use theme colors.

**Fix**: Replace with valid Tailwind class using either bg-gold (if defined), bg-[var(--color-gold)], or fixed color token.

**Files**: src/components/error/ErrorBoundary.tsx

**Phase**: 10

---

### UX-03: Replace hardcoded hex in Footer.tsx

**Priority**: MAJOR

**Description**: Footer.tsx contains hardcoded hex values (e.g., #d4af37) instead of using design token references. This creates inconsistency when design tokens are updated.

**Fix**: Replace all hardcoded hex values in Footer.tsx with references to designTokens.ts color variables.

**Files**: src/components/layout/Footer.tsx

**Phase**: 11

---

### UX-04: Replace hardcoded hex in Home page sections

**Priority**: MAJOR

**Description**: Home page sections contain hardcoded hex values instead of using design token references. This affects visual consistency across the site.

**Fix**: Replace all hardcoded hex values in Home page section components with design token references.

**Files**: src/components/sections/* (Home page sections)

**Phase**: 11

---

### UX-05: Define or replace shadow-gold token

**Priority**: MAJOR

**Description**: `shadow-gold` is referenced in components but not defined in designTokens.ts, causing undefined shadow styles.

**Fix**: Either add `shadow-gold` to designTokens.ts with appropriate gold shadow value, or replace all `shadow-gold` usages with defined token equivalent.

**Files**: Multiple components

**Phase**: 11

---

### UX-06: Standardize Avatar gradient

**Priority**: MAJOR

**Description**: Avatar components use inconsistent gradient definitions across different usages, creating visual inconsistency.

**Fix**: Define a consistent gradient for Avatar component in design tokens and update all usages to use it.

**Files**: src/components/ui/Avatar.tsx and usages throughout

**Phase**: 11

---

### UX-07: Remove duplicate LoadingSpinner

**Priority**: MAJOR

**Description**: Two LoadingSpinner implementations exist:
- src/components/ui/LoadingSpinner.tsx
- src/components/ui/spinners/LoadingSpinner.tsx

This causes confusion, maintenance burden, and potential inconsistencies.

**Fix**: Identify which implementation is canonical, then remove the duplicate. Redirect imports accordingly.

**Files**: src/components/ui/LoadingSpinner.tsx, src/components/ui/spinners/LoadingSpinner.tsx

**Phase**: 12

---

### UX-08: DarkModeToggle uses gray tokens instead of gold

**Priority**: COSMETIC

**Description**: DarkModeToggle component uses gray color tokens instead of gold tokens that match the wedding site theme.

**Fix**: Update DarkModeToggle to use gold color tokens to maintain visual consistency with site theme.

**Files**: src/components/ui/DarkModeToggle.tsx

**Phase**: 12

---

### UX-09: Add aria-labels to interactive elements

**Priority**: MINOR

**Description**: Multiple interactive elements lack aria-labels, reducing accessibility for screen reader users.

**Fix**: Add descriptive aria-labels to all interactive elements that lack them (buttons, links, icons with click handlers).

**Files**: Multiple components

**Phase**: 13

---

### UX-10: CustomCursor respects prefers-reduced-motion

**Priority**: MINOR

**Description**: CustomCursor component ignores user preference for reduced motion, causing accessibility and performance issues.

**Fix**: Add check for `prefers-reduced-motion` media query and disable cursor animation/effects when user prefers reduced motion.

**Files**: src/components/ui/CustomCursor.tsx

**Phase**: 13

---

### UX-11: Standardize focus ring color

**Priority**: MINOR

**Description**: Focus ring color is inconsistent across different components (some use gold, some use neutral gray).

**Fix**: Define a consistent focus ring style in design tokens and apply to all focusable elements via global CSS or component base styles.

**Files**: Global CSS, multiple components

**Phase**: 13

---

### UX-12: Standardize theme toggle animation

**Priority**: MINOR

**Description**: Theme toggle button has animation timing that differs from other UI animations, creating visual inconsistency.

**Fix**: Update DarkModeToggle animation duration to match other UI component animations (typically 200-300ms).

**Files**: src/components/ui/DarkModeToggle.tsx

**Phase**: 13

---

### UX-13: Standardize border radius

**Priority**: COSMETIC

**Description**: Border radius is inconsistent across components - some use `rounded-xl`, others use `rounded-2xl` or `rounded-3xl`.

**Fix**: Define standard border radius values in design tokens and update all components to use consistent values (recommend `rounded-xl` as standard).

**Files**: Multiple components

**Phase**: 14

---

### UX-14: Standardize animation durations

**Priority**: COSMETIC

**Description**: Animation durations vary significantly across components (some use 150ms, others 300ms, 500ms, etc.).

**Fix**: Define standard animation duration tokens (e.g., fast: 150ms, normal: 200ms, slow: 300ms) and update components to use consistent values.

**Files**: Multiple components, Framer Motion usage

**Phase**: 14

---

### UX-15: Audit and fix all remaining color token inconsistencies

**Priority**: COSMETIC

**Description**: Beyond specific issues identified, audit all components for any remaining color token inconsistencies and fix systematically.

**Fix**: Run comprehensive audit of all component color usages, identify any remaining hardcoded values or inconsistent token usage, and fix systematically.

**Files**: All component files

**Phase**: 14