# Phase 13: Accessibility & Motion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 13-accessibility-motion
**Areas discussed:** Reduced motion behavior, Focus ring color, Focus ring implementation, DarkModeToggle animation

---

## Reduced Motion Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide entirely | Remove custom cursor completely — fall back to system cursor when reduced-motion is preferred. Most accessible. | ✓ |
| Static gold circle | Keep small non-animated gold dot/ring at cursor position. Brand gold visible, no motion. | |
| Reduced spring animation | Keep cursor with gentler spring parameters (low stiffness/damping). Still animated but minimal motion. | |

**User's choice:** Hide entirely
**Notes:** User prefers the cleanest approach — no cursor at all for motion-sensitive users. Most accessible option.

---

## Focus Ring Color

| Option | Description | Selected |
|--------|-------------|----------|
| Gold (brand) | Use focus:ring-(--color-gold) throughout. Brand-consistent, matches DarkModeToggle. | ✓ |
| Neutral gray | Use focus:ring-gray-500 or similar. Higher contrast, more universally accessible. | |
| Conditional (theme-aware) | Gold on dark theme, gray on light theme. Adapts to background for better contrast. | |

**User's choice:** Gold (brand)
**Notes:** Brand-consistent gold focus rings throughout. Matches the existing DarkModeToggle pattern established in Phase 12.

---

## Focus Ring Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-component inline | Add focus:ring-(--color-gold) to each interactive element. Explicit but more files to touch. | ✓ |
| Global CSS base | CSS rule targeting :focus-visible on all interactive elements globally. Single file, automatic coverage. | |
| Utility class | Define .focus-ring-gold in CSS, apply via className. Centralized style, explicit per element. | |

**User's choice:** Per-component inline
**Notes:** Each component explicitly declares its focus ring style. More files to touch but clearest and most maintainable.

---

## DarkModeToggle Animation Duration

| Option | Description | Selected |
|--------|-------------|----------|
| 200ms (micro-interaction) | Snappy toggle feel — consistent with button state transitions. | |
| 300ms (transitional) | Slower, more graceful — the current 0.3s value. Feels more elegant for theme change. | ✓ |

**User's choice:** 300ms (transitional)
**Notes:** The 300ms transitional feel is preserved for the theme change animation. More elegant for this use case.

---

## Deferred Ideas

None — discussion stayed within phase scope.
