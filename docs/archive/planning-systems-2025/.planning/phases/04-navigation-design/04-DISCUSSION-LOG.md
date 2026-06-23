# Phase 4: Navigation & Design Consistency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 04-navigation-design
**Areas discussed:** Navigation polish (NAV-01), Gold theme gaps (NAV-02), Skeleton coverage (NAV-03)

---

## Navigation Polish (NAV-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Dark pill (current) | Dark gradient pill with gold icon text | |
| Gold border + transparent | Gold border + transparent background, text in gold-700 | ✓ |

**User's choice:** Gold border + transparent background, text in gold-700
**Notes:** Replaces current dark-pill active state. "Complete and intuitive" requires more gold presence than dark pill provides.

---

## Gold Theme Gaps (NAV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep #c9a05c | Current implementation, muted bronze-gold, "timeless not trendy" | ✓ |
| Switch to #d4af37 | Align with spec, brighter metallic gold | |
| Both | #d4af37 as accent, #c9a05c for backgrounds/borders | |

**User's choice:** Keep #c9a05c (gold-500) as primary gold
**Notes:** "Timeless, not trendy" aesthetic. #c9a05c is already implemented across header pills, footer dividers, and upload progress bars — works well, no need to change.

---

## Skeleton Coverage (NAV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Page-level skeletons | Each page shows skeleton outline while data loads, all public pages | ✓ |
| Content-specific skeletons | Gallery shows photo grid skeleton, Guestbook shows message list skeleton, etc. | |
| Just heavy pages | Gallery and Home only | |

**User's choice:** Page-level skeletons on all public pages (Gallery, Upload, Guestbook, Film, Home)
**Notes:** Covers both "skeleton screens" and "no layout shift" parts of NAV-03. Reuses existing Skeleton components. Lenis already wired — smooth scroll requirement already satisfied.

---

## Additional Notes

- Lenis smooth scroll (NAV-03) already wired in Layout.tsx with duration: 1.4, easing, gestureOrientation: vertical, smoothWheel: true — no additional work needed

## Deferred Ideas

None — discussion stayed within phase scope.