# docs/rebuild — greenfield rebuild workbench

Canonical planning home for the 2026 teardown/rebuild of the Poradas archive. Legacy planning
systems (`docs/plans/`, `docs/archive/planning-systems-2025/`, `conductor/`) are historical;
new work lives here.

## Start here

| Doc | What it is |
|---|---|
| [PRODUCT_CONTRACT.md](./PRODUCT_CONTRACT.md) | The north star and the invariants that must survive the rebuild |
| [RULES_OF_ENGAGEMENT.md](./RULES_OF_ENGAGEMENT.md) | How the team works: scopes, freeze, serialization, evidence |
| [RISK_REGISTER.md](./RISK_REGISTER.md) | Live risks, mitigations, environment facts |
| [PARITY.md](./PARITY.md) | What pixel parity means, tolerances, allowlist governance (parity-eng) |
| [BASELINE.md](./BASELINE.md) | Measured baseline of the frozen app (metrics-eng) |
| [plans/2026-11-08-workbench.md](./plans/2026-11-08-workbench.md) | The approved Wave 0 plan |
| [audit/A1…A7](./audit/) | The audit that decides the stack |
| [STACK_DECISION.md](./STACK_DECISION.md) | Wave 0 gate: recommendation + tradeoffs (Lead) |
| [checkpoints/](./checkpoints/) | Per-wave evidence packages for owner review |

Contracts (the rebuild's input) live in [`contracts/`](../../contracts/README.md).

## What Wave 0 delivers

1. Frozen legacy oracle: tag `legacy-freeze-2026-11-08`, branch `rebuild/greenfield`, freeze
   checker that fails on any legacy edit.
2. Stack-neutral contracts: routes, features, UI matrix, SEO/PWA, content, fixtures, media, and
   the real database schema (generated from a clean local Supabase reset, not from stale SQL).
3. Deterministic parity harness: legacy-vs-rebuild screenshot + text comparison, proven by a
   0-pixel self-check.
4. Measured baseline: bundle, Lighthouse, coverage, timings.
5. Audit A1–A7 → a stack recommendation with weighted tradeoffs and reversal cost.
6. Independent CI (`rebuild.yml`) that gates the workbench and later the greenfield app.

## What comes next (after owner approval of the stack)

Waves 1–9: scaffold/shell → design system → data layer → content pages → gallery → guest
interactions → admin → SEO/PWA/perf → parity sweep + cutover. Each wave gets its own detailed
plan at its start, ends with a parity gate, and stops at a checkpoint.

## Non-negotiables

- Legacy source frozen (only `package.json`, `package-lock.json`, `eslint.config.js`,
  `.prettierignore`, `.gitignore`, `AGENTS.md` are editable).
- One branch, one checkout, no worktrees.
- No production writes, no secrets, no media copies.
- Evidence before claims: every checkpoint cites commands and artifacts.

## Operations and cutover (Wave 8/9)

Runbooks for deploying, backing up, and rolling back the archive, plus the Wave 9 readiness package.
All are documentation-only until the owner authorises the cutover:

| Doc | What it is |
|---|---|
| [ops/ENVIRONMENT.md](./ops/ENVIRONMENT.md) | Every env var: layer, visibility, setter, failure mode, greenfield deltas |
| [ops/DEPLOY.md](./ops/DEPLOY.md) | Preconditions, preview/staging deploy, smoke checks, production promote + DNS switch |
| [ops/ROLLBACK.md](./ops/ROLLBACK.md) | Static hosting, data, media, auth/RLS rollback + the dry-run rehearsal script |
| [ops/BACKUP_RESTORE.md](./ops/BACKUP_RESTORE.md) | What must be backed up, how, restore verification queries, owner-only actions |
| [CUTOVER.md](./CUTOVER.md) | Wave 9 readiness package: parity/gate status, open owner decisions, go/no-go, **owner must authorise** (DNS switch, production migration, prod data writes) |
