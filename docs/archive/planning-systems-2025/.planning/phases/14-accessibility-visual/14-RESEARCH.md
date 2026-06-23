# Phase 14: Animation & Visual Polish - Research

**Researched:** 2026-04-28
**Domain:** Animation duration standardization, border radius consistency, color token audit
**Confidence:** HIGH (context from prior phases, verified codebase state)

## Summary

Phase 14 addresses three cosmetic UX requirements for the v2.0 polish milestone: border radius standardization (UX-13), animation duration standardization (UX-14), and comprehensive color token audit (UX-15). The codebase has accumulated inconsistencies across 400+ components over multiple development phases. This research identifies the specific inconsistencies, quantifies the scope, and maps the locked decisions to implementation patterns.

**Primary recommendation:** Establish design token aliases for duration and radius in `designTokens.ts`, then sweep components with targeted greps replacing inconsistent values. The two-tier radius and three-tier duration decisions are already locked in CONTEXT.md.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Border Radius (UX-13):**
- **D-01:** Two-tier border radius system:
  - Tier 1 (`rounded-xl`) — buttons, inputs, small elements
  - Tier 2 (`rounded-2xl`) — cards, modals, feature panels
- **D-02:** No `rounded-3xl` as a standard tier — use `rounded-2xl` for large decorative containers

**Animation Duration (UX-14):**
- **D-03:** Three-tier animation duration system:
  - Micro: 150ms — hover states, button presses
  - Transitions: 300ms — theme toggle, modal open, page transitions
  - Animations: 500ms+ — complex entrance/exit animations
- **D-04:** DarkModeToggle stays at `duration: 0.3` (300ms) per Phase 13 — already correct

**Color Token Audit (UX-15):**
- **D-05:** Comprehensive sweep scope — find and fix every color usage that doesn't use design tokens correctly
- **D-06:** Audit includes hardcoded hex values, incorrect CSS variable references, and places where tokens exist but aren't being used

### Out of Scope

None — discussion stayed within phase scope.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-13 | Standardize border radius — pick standard values and apply consistently | Two-tier radius system identified; designTokens.ts component defaults mapped |
| UX-14 | Standardize animation durations — establish duration tiers | Three-tier duration baseline confirmed from Phase 13 UI-SPEC; DarkModeToggle verified at 300ms |
| UX-15 | Comprehensive color token audit — find and fix all color usages not using design tokens | Hex audit findings documented; CSS variable reference pattern established |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Border radius standardization | CSS / Utility Layer | Component-level | Tokens defined in index.css @theme; components apply via Tailwind classes |
| Animation duration standardization | CSS / Utility Layer | Component-level | Tailwind duration utilities; Framer Motion transition props |
| Color token audit | CSS / Utility Layer | Component-level | Design tokens in designTokens.ts; CSS variables in index.css; components consume both |

---

## Standard Stack

### Core (already in use)

| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Tailwind CSS v4 | Utility-first styling via @theme in index.css | Already configured; duration/radius utilities via Tailwind |
| Framer Motion | React animation library | Already in use across 20+ components |
| designTokens.ts | Source of truth for design values | Single source; already exports gold scale, typography, spacing, component defaults |

### Supporting Patterns

| Pattern | Purpose | Usage |
|---------|---------|-------|
| `transition-colors duration-300` | Tailwind CSS transitions | Standard for hover states |
| `transition={{ duration: 0.3 }}` | Framer Motion transitions | Already established pattern |

**No new libraries needed** — all tooling already present in project.

---

## Architecture Patterns

### System Architecture Diagram

```
Component File (JSX/TSX)
       |
       v
Tailwind Utility Class / Framer Motion prop
       |
       v
designTokens.ts (exports) --> index.css @theme (CSS variables)
       |                              |
       v                              v
CSS Custom Properties            Tailwind Theme Integration
(--color-gold-500)               (gold-500, rounded-*, duration-*)
       |
       v
Browser Rendering
```

### Border Radius System

**Current state:** Over 400 `rounded-*` occurrences across component files, inconsistent values:
- `rounded-xl` — 80+ occurrences (buttons, inputs, small containers)
- `rounded-2xl` — 50+ occurrences (cards, modals, panels)
- `rounded-3xl` — scattered (decorative containers)
- `rounded-full` — common (pills, avatars, badges)

**Decision D-01 mapping:**
| Element Type | Current Pattern | Target Pattern |
|-------------|-----------------|----------------|
| Buttons, inputs | `rounded-full`, `rounded-xl` | `rounded-xl` (standardize) |
| Cards, modals | `rounded-2xl` | `rounded-2xl` (keep) |
| Large decorative | `rounded-3xl` | `rounded-2xl` (per D-02) |
| Pills, avatars | `rounded-full` | `rounded-full` (keep — intentional) |

**Design token mapping from designTokens.ts:**
```typescript
export const components = {
  button: {
    radius: '9999px',  // rounded-full for pill buttons
  },
  card: {
    radius: '1rem',   // rounded-2xl equivalent
  },
}
```

### Animation Duration System

**Current Framer Motion duration distribution (verified via grep):**
| Duration | Occurrences | Current Use |
|----------|-------------|-------------|
| 0.15s (150ms) | 2 | Micro-interactions (keyboard shortcuts) |
| 0.2s (200ms) | 6 | Micro-interactions |
| 0.22s (220ms) | 2 | Micro-interactions (FaceRecognition) |
| 0.28s (280ms) | 2 | Transitions |
| 0.3s (300ms) | 8 | Transitions (reference value) |
| 0.35s (350ms) | 2 | Transitions |
| 0.4s (400ms) | 2 | Transitions |
| 0.5s (500ms) | 7 | Animations |
| 0.6s (600ms) | 7 | Animations |
| 0.8s (800ms) | 5 | Animations |
| 1.0s (1000ms) | 5 | Complex animations |
| 1.5s+ | 8 | Long animations |

**Decision D-03 mapping:**
| Tier | Duration | Tailwind Class | Framer Motion Value |
|------|----------|----------------|---------------------|
| Micro | 150ms | `duration-150` | `duration: 0.15` |
| Transitions | 300ms | `duration-300` | `duration: 0.3` |
| Animations | 500ms+ | `duration-500` | `duration: 0.5` |

**DarkModeToggle verification:** Already uses `duration: 0.3` — no action needed (D-04).

**Tailwind duration utilities available:** 75ms, 100ms, 150ms, 200ms, 300ms, 500ms, 700ms, 1000ms

### Color Token Audit Findings

**Hardcoded hex values found (UX-15 scope):**

| File | Hex Values | Should Use |
|------|-----------|------------|
| ToastContext.tsx | `#050508`, `#fff7eb` | CSS variables for cinematic dark theme |
| VideoPlayer.tsx | `#130e0b`, `#dbb880` | `--color-mocha-*` or gold scale |
| MapView.tsx | `#d2b178` | `--color-gold-400` |
| LoveTimeline.tsx | `#DC2626`, `#7F1D1D`, `#991B1B`, `#fff7eb`, `#f9a8d4` | Rose/red scale, candle colors |
| LocationMap.tsx | `#B08D46`, `#D4C4A8` | `--color-gold-600`, `--color-cream-*` |
| HalloweenEngagement.tsx | `#1a0f2e`, `#fb923c`, `#e5e5e5`, `#4a4a4a` | Conditional theme colors |
| ImmersiveView.tsx | `#050508`, `#141419` | Cinematic dark palette |
| BackgroundMusic.tsx | `#111`, `#333` | Cinematic dark palette |
| VideoSection.tsx | `#1a1a1a`, `#333` | Cinematic dark palette |
| PartyMemberModal.tsx, PersonCard.tsx | `#e5e5e5` | `--color-cream-100` |
| Home.tsx | `#f7efe3`, `#fff7eb` | `--color-cream-*` |

**Established patterns to enforce:**
- Focus ring: `focus:ring-(--color-gold)` (Phase 12 established)
- Gold brand: `#d4af37` maps to `--color-gold-500`
- CSS var reference in Tailwind: `bg-[var(--color-gold-500)]` not `bg-gold-500`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom radius classes | Define new Tailwind radius utilities | `rounded-xl` / `rounded-2xl` | Tailwind v4 has built-in radius scale |
| Custom duration classes | Create new animation timing utilities | Tailwind `duration-*` utilities | Built-in, consistent with design system |
| Custom color mappings | Define new color scales | Gold scale already in designTokens.ts | Brand gold established; adding alternatives causes drift |

**Key insight:** The project already has a design token system via `designTokens.ts` and Tailwind v4 @theme. The work is adoption and consistency, not creation.

---

## Common Pitfalls

### Pitfall 1: Over-standardizing Radii

**What goes wrong:** Replacing `rounded-full` (pills, avatars) with `rounded-xl` or `rounded-2xl` destroys intentional rounded-full design intent.

**Why it happens:** Grep replace without understanding element purpose.

**How to avoid:** Map element types first:
- Pills/badges/avatars → `rounded-full` (keep)
- Buttons/inputs/small → `rounded-xl` (standardize)
- Cards/modals/panels → `rounded-2xl` (standardize)
- Decorative large containers → `rounded-2xl` per D-02

### Pitfall 2: Inconsistent CSS Variable Syntax

**What goes wrong:** Using `bg-gold-500` instead of `bg-[var(--color-gold-500)]` when referring to CSS variables in certain contexts.

**Why it happens:** Tailwind v4 with @theme allows `bg-gold-500` shorthand, but some patterns like `focus:ring-(--color-gold)` require explicit CSS var reference.

**How to avoid:** When a pattern requires the CSS variable explicitly (focus rings, certain backdrop patterns), use `(--color-gold-*)` syntax. For standard backgrounds/borders/text, the Tailwind shorthand works.

### Pitfall 3: Animation Duration Mismatch with Tailwind Transitions

**What goes wrong:** Using `duration-300` in Tailwind (300ms) but `duration: 0.5` in Framer Motion (500ms) for similar effects.

**Why it happens:** Two different animation systems with different conventions.

**How to avoid:** Map Framer Motion seconds to Tailwind milliseconds:
- `duration: 0.15` ↔ `duration-150`
- `duration: 0.3` ↔ `duration-300`
- `duration: 0.5` ↔ `duration-500`

### Pitfall 4: Forgetting Conditional Themes

**What goes wrong:** Replacing hardcoded hex in files like `HalloweenEngagement.tsx` that use conditional color schemes.

**Why it happens:** Single-theme audit doesn't account for intentional multi-theme color usage.

**How to avoid:** In conditional theme components, verify if hex is intentional (spooky vs. normal mode) before replacing.

---

## Code Examples

### Border Radius Application

```typescript
// Buttons, inputs, small elements -> rounded-xl
<button className="px-4 py-2 rounded-xl bg-gold-500 text-white">
  Submit
</button>

// Cards, modals, feature panels -> rounded-2xl
<div className="p-6 rounded-2xl bg-cream-50 shadow-lg">
  Content card
</div>

// Large decorative containers -> rounded-2xl (per D-02)
<div className="p-8 rounded-2xl border border-gold-200">
  Feature panel
</div>

// Pills, avatars, badges -> rounded-full (keep)
<span className="px-3 py-1 rounded-full bg-gold-100 text-gold-700">
  Badge
</span>
```

### Animation Duration Application

```typescript
// Micro-interactions (150ms)
<motion.button
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
>
  Press me
</motion.button>

// Transitions (300ms)
<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Modal content
</motion.div>

// Complex animations (500ms+)
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
>
  Page transition
</motion.div>
```

### Color Token Audit Patterns

```typescript
// Focus ring - established pattern
<button className="focus:outline-none focus:ring-2 focus:ring-(--color-gold)">
  Interactive
</button>

// CSS var reference for complex patterns
<div className="bg-[var(--color-gold-500)]">
  Gold background
</div>

// Tailwind shorthand for standard cases
<div className="text-gold-500 bg-gold-100 border-gold-300">
  Standard gold token usage
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mixed `rounded-xl/2xl/3xl` | Two-tier `rounded-xl`/`rounded-2xl` | Phase 14 | Consistent radius scale |
| Random animation durations | Three-tier (150ms/300ms/500ms+) | Phase 14 | Predictable animation timing |
| Hardcoded hex scattered | Design token references | Phases 11-14 | Unified color system |

**Deprecated/outdated:**
- `rounded-3xl` — no longer standard tier per D-02
- Inline hardcoded hex values — replaced with design tokens as encountered

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4 `duration-*` utilities include 150ms, 300ms, 500ms values | Animation Duration | LOW — Tailwind standard scale; verify via npm or docs |
| A2 | DesignTokens.ts component.button.radius `9999px` maps to `rounded-full` not a pixel value | Border Radius | LOW — consistent with Tailwind full radius |
| A3 | No new animation libraries needed beyond existing Framer Motion | Animation Duration | LOW — project already has Framer Motion |

**If this table is empty:** All claims were verified or cited.

---

## Open Questions

1. **Should duration token aliases be added to designTokens.ts?**
   - What we know: Tailwind duration utilities are ad-hoc; Framer Motion uses raw numbers.
   - What's unclear: Whether to create a `tokens/animation.ts` with named durations.
   - Recommendation: No new file — document tier mapping in index.css comments. Implementation uses raw Framer Motion values aligned to tiers.

2. **Should Tailwind radius utilities be added to @theme for custom radii?**
   - What we know: Current designTokens.ts has component radius values.
   - What's unclear: Whether to add custom radii beyond Tailwind's built-in scale.
   - Recommendation: Use Tailwind built-in (`rounded-xl`, `rounded-2xl`, `rounded-full`) — no custom addition needed.

---

## Environment Availability

**Step 2.6: SKIPPED** — Phase is code/style changes only, no external dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

### Phase Requirements - Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|---------------|
| UX-13 | Border radius consistency | Smoke | Grep-based audit (no unit test) | N/A |
| UX-14 | Animation duration consistency | Smoke | Grep-based audit (no unit test) | N/A |
| UX-15 | Color token usage | Smoke | Grep-based audit (no unit test) | N/A |

### Sampling Rate
- **Per task commit:** N/A (cosmetic audit)
- **Per wave merge:** `npm run lint` (style check)
- **Phase gate:** `npm run lint && npm run test -- --run`

### Wave 0 Gaps
None — Phase 14 is a cosmetic consistency sweep. No new test files needed.

---

## Security Domain

**Note:** No security implications for cosmetic/style-only changes.

---

## Sources

### Primary (HIGH confidence)
- `.planning/REQUIREMENTS.md` — UX-13, UX-14, UX-15 requirements
- `.planning/phases/14-accessibility-visual/14-CONTEXT.md` — Phase decisions D-01 through D-06
- `.planning/phases/13-accessibility-motion/13-UI-SPEC.md` — Animation baseline durations, focus ring pattern
- `.planning/phases/13-accessibility-motion/13-CONTEXT.md` — Phase 13 context
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color #d4af37
- `src/designTokens.ts` — Component radius and color definitions
- `src/index.css` — @theme CSS variables, reduced-motion handling, keyframe animations

### Secondary (MEDIUM confidence)
- Grep output: 400+ `rounded-*` occurrences across component files
- Grep output: Framer Motion duration distribution (0.15s through 2s)
- Grep output: Hardcoded hex values in 15+ component files

### Tertiary (LOW confidence)
- Tailwind v4 duration utility values — should verify via npm or docs if planning uses specific Tailwind classes

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in project; no new dependencies
- Architecture: HIGH — pattern already established; this is consistency work
- Pitfalls: HIGH — scope well-defined via prior phases

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (cosmetic consistency phase, slow-moving domain)
