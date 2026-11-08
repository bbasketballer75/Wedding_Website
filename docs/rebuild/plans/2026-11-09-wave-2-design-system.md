# Wave 2 Plan — Design-system primitives, harness edge tolerance, a11y smoke

> Status: in progress. Owner: Lead. Branch: `rebuild/greenfield`. Predecessor: Wave 1.

## Goal

Give the feature waves a parity-safe primitive library and remove the two mobile parity
allowances by making the harness tolerant of 1px raster phase (not of real differences). Add the
first browser-level a11y gate.

## Exit criteria

1. Live legacy `components/ui/*` primitives are ported into `rebuild/src/shared/ui/**` with the
   frozen class contracts (Button all variants/sizes, Card, Badge, Input, Textarea, Label, Avatar,
   Skeleton, plus whatever A1/A4 mark live and needed by content pages), each with colocated tests.
2. `npm run lint / format:check / typecheck / typecheck:ts6 / test:coverage / build` green.
3. Harness gains a documented edge-raster tolerance (default off; enabled only where justified),
   with a proof that it does not hide real changes (perturbation still detected) and that the two
   mobile 404 allowlist entries can be deleted.
4. Legacy-vs-rebuild 404 parity passes with **no allowlist for `/` or `/*`** (home/film Wave 0
   entries also re-checked).
5. Playwright axe smoke on the 404 shell (zero critical/serious violations).
6. Checkpoint with evidence.

## Work packages

| ID | Owner | Deliverable | Acceptance |
|---|---|---|---|
| W2-1 | design-eng | `rebuild/src/shared/ui/**` primitive ports + tests | classes match frozen source; unit tests; gates green |
| W2-2 | parity-eng | edge tolerance mode + allowance removal + re-run | selfcheck green; 404 mobile passes without allowance; perturbation still detected |
| W2-3 | shell-eng | Playwright axe smoke for 404 + focus path | `npm run test:e2e` green; zero critical/serious |
| W2-4 | Lead | CI e2e step + checkpoint | rebuild workflow runs e2e; docs updated |

## Rules

- Primitive class strings are copied from the frozen `src/components/ui/*`, adapted only for TanStack
  Router and the rebuild's import boundaries.
- No new dependencies without Lead approval; pixel parity remains the oracle for shell routes.
- Mobile allowances are removed only when the tolerance change proves it cannot mask real diffs.
