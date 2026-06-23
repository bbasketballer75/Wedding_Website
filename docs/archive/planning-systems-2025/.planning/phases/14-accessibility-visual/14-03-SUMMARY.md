---
phase: 14-accessibility-visual
plan: 03
subsystem: design-tokens
tags: [color-tokens, hex-replacement, CSS-variables, design-system]
dependency_graph:
  requires:
    - 14-01
    - 14-02
  provides:
    - UX-15
  affects:
    - src/tokens/designTokens.ts
    - src/index.css
tech_stack:
  added: []
  patterns:
    - Tailwind shorthand for design tokens (bg-charcoal-900, bg-mocha-900)
    - CSS var() syntax for SVG stroke attributes (stroke="var(--color-gold-400)")
key_files:
  created: []
  modified:
    - src/context/ToastContext.tsx
    - src/components/video/VideoPlayer.tsx
    - src/components/gallery/MapView.tsx
    - src/components/timeline/LoveTimeline.tsx
    - src/components/timeline/LocationMap.tsx
decisions:
  - "Preserved HalloweenCard hex values in LoveTimeline.tsx as intentional conditional theme"
  - "Used var() syntax for SVG stroke attributes (cannot use Tailwind shorthand in inline SVG)"
  - "Used explicit var(--color-gold-400) in VideoPlayer inline style for dynamic progress bar gradient"
metrics:
  duration: ~
  completed: 2026-04-29
  tasks_completed: 5
  files_modified: 5
---

# Phase 14 Plan 03 Summary: Color Token Audit & Fix

**One-liner:** Replaced all hardcoded hex values with design token CSS variables across ToastContext, VideoPlayer, MapView, LoveTimeline, and LocationMap components.

## Objective

Comprehensive color token audit and fix per D-05 and D-06, replacing hardcoded hex values with CSS variable references from designTokens.ts while preserving intentional conditional themes.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix ToastContext.tsx | e29c7a47 | 1 file, 2 insertions, 2 deletions |
| 2 | Fix VideoPlayer.tsx | 8634a2b1 | 1 file, 4 insertions, 4 deletions |
| 3 | Fix MapView.tsx | e9fef5ef | 1 file, 3 insertions, 3 deletions |
| 4 | Fix LoveTimeline.tsx | ffc78056 | 1 file, 2 insertions, 2 deletions |
| 5 | Fix LocationMap.tsx | 19161e05 | 1 file, 3 insertions, 3 deletions |

## Changes Made

### ToastContext.tsx
- `bg-[#050508]/90` → `bg-charcoal-900` (success and info toast backgrounds)
- `border-(--color-gold)` → `border-gold-500` (fixed invalid CSS var syntax)

### VideoPlayer.tsx
- `bg-[#130e0b]` → `bg-mocha-900` (3 instances: poster blur, preview video, main video background)
- `#dbb880` → `var(--color-gold-400)` (seek bar progress gradient via inline style)

### MapView.tsx
- `stroke="#d2b178"` → `stroke="var(--color-gold-400)"` (3 SVG path strokes for map decorative lines)

### LoveTimeline.tsx
- `text-[#fff7eb]` → `text-candle-100` (Halloween Proposal title)
- `color: '#f9a8d4'` → `var(--color-rose-200)` (location hover effect)
- **Preserved:** HalloweenCard cobweb SVG strokes (#DC2626, #7F1D1D, #991B1B) as intentional conditional theme

### LocationMap.tsx
- `stroke="#B08D46"` → `stroke="var(--color-gold-600)"` (grid pattern)
- `stroke="#D4C4A8"` → `stroke="var(--color-cream-300)"` (2 decorative road paths)

## Deviations from Plan

**None** - plan executed exactly as written.

### Preserved Conditional Themes
The HalloweenCard component in LoveTimeline.tsx uses hardcoded hex values (#DC2626, #7F1D1D, #991B1B, #fff7eb, #f9a8d4) for its spooky theme. Per the plan's explicit instruction to preserve intentional conditional theme colors, these were NOT replaced.

## Verification

Ran grep across all modified files for hardcoded hex values. Remaining hex values in LoveTimeline.tsx are exclusively in HalloweenCard (cobweb SVGs) - an intentional conditional theme that should be preserved.

## Commits

- `e29c7a47` fix(14-03): replace hardcoded hex with design tokens in ToastContext
- `8634a2b1` fix(14-03): replace hardcoded hex with design tokens in VideoPlayer
- `e9fef5ef` fix(14-03): replace hardcoded hex with gold-400 token in MapView SVG
- `ffc78056` fix(14-03): replace hardcoded hex with design tokens in LoveTimeline
- `19161e05` fix(14-03): replace hardcoded hex with design tokens in LocationMap
