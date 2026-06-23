# Phase 12: Component Consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 12-component-consolidation
**Areas discussed:** LoadingSpinner deduplication, DarkModeToggle gold token migration

---

## LoadingSpinner Deduplication (UX-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep src/components/ui/LoadingSpinner.tsx | More fully featured with size/color props, standard UI location | |
| Keep src/components/ui/spinners/LoadingSpinner.tsx | (not found — directory doesn't exist) | |
| You decide | Trust analysis of which is more widely used and better implemented | ✓ |

**User's choice:** You decide — trust analysis
**Notes:** Three spinners found: ui/LoadingSpinner.tsx (165 lines), layout/LoadingSpinner.tsx (72 lines), and inline in LazyLoad.tsx. ui/LoadingSpinner.tsx is most fully featured and in standard UI location.

---

## DarkModeToggle Gold Token Migration (UX-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep gray for structure, gold for accents only | DarkModeToggle is primarily structural/functional — gray tokens appropriate. Only gold accent (active selection) should be gold. | ✓ |
| Full gold token migration | Replace gray with muted gold tones throughout | |
| You decide approach | You decide | |

**User's choice:** Keep gray for structure, gold for accents only
**Notes:** This maintains wedding site's gold theme while keeping DarkModeToggle functionally neutral. Gray tokens for backgrounds/borders are appropriate for structural components.

---

## Claude's Discretion

- LoadingSpinner deduplication: Claude chose which spinner to keep (ui/LoadingSpinner.tsx based on feature completeness and location)

## Deferred Ideas

None — discussion stayed within phase scope.