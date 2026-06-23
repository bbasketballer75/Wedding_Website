# Phase 17: Download Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 17-download-management
**Areas discussed:** Multi-Select Activation, Queue Panel UI, Batch Download, FAB Position & Trigger, Long-Press Threshold

---

## Multi-Select Activation

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox column in grid header | Choose dedicated checkbox column approach — clearer but takes more space | |
| Long-press + tap to select | Long-press triggers selection mode, then tap to select multiple | |
| Both activation methods | Both — long-press on mobile, checkbox on desktop | ✓ |

**User's choice:** Both activation methods
**Notes:** Mobile uses long-press, desktop uses checkbox toggle

---

## Queue Panel UI

| Option | Description | Selected |
|--------|-------------|----------|
| Side drawer (right) | Slides in from right, shows selected photos as thumbnails with remove option | |
| Top bar with expandable drawer | Fixed bar at top showing count + expand button, expands to full panel | |
| Floating action button | Floating pill showing count, expands to full panel | ✓ |

**User's choice:** Floating action button
**Notes:** FAB in bottom-right is standard, easy to reach on mobile

---

## Batch Download

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side only (JSZip) | Use client-side JSZip for all batches — simpler, works offline | |
| Hybrid (JSZip + Edge for large) | Use JSZip for small batches, Edge Function for large (>20) to avoid memory issues | ✓ |
| Server-side only (Edge Function) | Always use Edge Function — consistent performance, handles any batch size | |

**User's choice:** Hybrid (JSZip + Edge for large)
**Notes:** Edge Function for >20 photos to avoid client memory issues

---

## FAB Position & Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-right (default) | Standard position, easy to reach on mobile with thumb | ✓ |
| Bottom-center | Center-bottom, more balanced but might interfere with content | |
| Top-right corner | Top-right near header, more visible but less thumb-friendly | |

**User's choice:** Bottom-right (default)

---

## FAB Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Tap FAB to expand | Tap the FAB itself to toggle the panel open/closed | |
| Tap count to expand | Tap count badge to expand, FAB still opens lightbox | |
| Whole pill tappable | Entire pill is tappable and expands inline | ✓ |

**User's choice:** Whole pill tappable

---

## Long-Press Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 500ms (recommended) | 500ms — reliable, not too fast | ✓ |
| 300ms | 300ms — faster but may cause accidental triggers | |
| 800ms | 800ms — more deliberate, feels slower | |

**User's choice:** 500ms (recommended)

---

## Claude's Discretion

None — all decisions made by user.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 17-download-management*
*Discussion date: 2026-04-30*