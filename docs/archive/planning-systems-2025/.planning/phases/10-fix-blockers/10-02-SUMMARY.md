---
phase: "10"
plan: "02"
subsystem: "ErrorBoundary"
tags:
  - "css-fix"
  - "tailwind"
  - "error-boundary"
dependency_graph:
  requires: []
  provides:
    - "ErrorBoundary.tsx with valid gold-500 CSS classes"
  affects:
    - "src/components/error/ErrorBoundary.tsx"
tech_stack:
  added:
    - "bg-gold-500 Tailwind class"
    - "focus:ring-gold-500 Tailwind class"
  patterns:
    - "CSS custom property → Tailwind arbitrary value conversion"
key_files:
  created: []
  modified:
    - "src/components/error/ErrorBoundary.tsx"
decisions:
  - "Replaced invalid bg-(--color-gold) CSS var syntax with bg-gold-500, using primary brand gold from designTokens.ts (gold-500 at #c9a05c)"
  - "Replaced invalid focus:ring-(--color-gold) with focus:ring-gold-500"
metrics:
  duration: "~1 minute"
  completed_date: "2026-04-28"
---

# Phase 10 Plan 02: Fix Invalid CSS Var Syntax in ErrorBoundary

## One-liner

Replaced invalid `bg-(--color-gold)` and `focus:ring-(--color-gold)` CSS var syntax with valid Tailwind `bg-gold-500` and `focus:ring-gold-500` classes.

## Task Summary

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Replace invalid CSS var syntax with valid gold-500 token | 47010f2a | src/components/error/ErrorBoundary.tsx |

## Changes Made

### 1. Task 1: Replace invalid CSS var syntax with valid gold-500 token

**Files modified:** `src/components/error/ErrorBoundary.tsx`

**Lines changed:**
- Line 26: `bg-(--color-gold)` → `bg-gold-500` (divider bar)
- Line 55: `bg-(--color-gold)` → `bg-gold-500` (Try Again button background)
- Line 55: `focus:ring-(--color-gold)` → `focus:ring-gold-500` (Try Again button focus ring)

**Verification:**
```
grep -n "bg-(--color-gold)" src/components/error/ErrorBoundary.tsx → No matches (PASS)
grep -n "focus:ring-(--color-gold)" src/components/error/ErrorBoundary.tsx → No matches (PASS)
grep -n "bg-gold-500" src/components/error/ErrorBoundary.tsx → Matches at lines 26, 55 (PASS)
grep -n "focus:ring-gold-500" src/components/error/ErrorBoundary.tsx → Match at line 55 (PASS)
```

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| None | ErrorBoundary.tsx | Simple CSS class correction with no security impact |

## Self-Check

- [x] bg-(--color-gold) not found in file
- [x] focus:ring-(--color-gold) not found in file
- [x] bg-gold-500 found at lines 26 and 55
- [x] focus:ring-gold-500 found at line 55
- [x] Commit 47010f2a exists in git log

## Self-Check: PASSED